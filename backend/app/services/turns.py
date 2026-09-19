"""One turn, from the prompt to everything the turn leaves behind.

The advisor's loop knows nothing about the database and the routes know nothing
about the model. This is where the two meet: it drives the loop, records what
comes back, and names the Conversation if this is the exchange that earned it.

What it yields is what happened, not what to send. The wire format stays in
`api/`, so the events below can grow a tool call or a Trip Plan patch without
the shape of the HTTP response being decided in here.
"""

import logging
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass

from openai import APIError, AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor.loop import (
    Consulted,
    Consulting,
    Patched,
    Remembered,
    ReplyFragment,
    run_turn,
)
from ..advisor.planning import TripPlan
from ..advisor.remembering import Fact
from ..advisor.titles import name_conversation
from ..advisor.tools import LiveDataTools
from ..config import Settings
from ..db.conversations import record_message, retitle_conversation
from ..db.tables import Conversation, Message, MessageRole, PromptVersion
from .plans import TripPlanning, plan_of
from .profile import Remembering, read_profile

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class Recorded:
    """The reply, now a Message that will still be there after a reload."""

    message: Message


@dataclass(frozen=True, slots=True)
class PlanRevised:
    """The Trip Plan has changed mid-turn, and this is it.

    The loop reports *that* the plan moved and which parts; reading the plan
    back is this layer's, because the loop has no database. The whole plan
    rather than the patch: a Conversation's first patch starts a Trip, so
    there is a case where what the traveler is holding is not an older version
    of this plan but no plan at all.
    """

    plan: TripPlan
    #: What to highlight, named the way the interface names it. Empty when the
    #: Conversation was attached to a different Trip, which changes everything
    #: and highlights nothing.
    changed: Sequence[str]


@dataclass(frozen=True, slots=True)
class ProfileRevised:
    """The Traveler Profile has changed mid-turn, and this is what it says now.

    The whole profile rather than the fact that moved, and for a plainer reason
    than the plan's: a correction *replaces* a fact, so a patch would have to
    say which one it replaced. It is a short list, read whole.
    """

    profile: Sequence[Fact]


@dataclass(frozen=True, slots=True)
class Titled:
    """The Conversation has a title, which it did not have a moment ago."""

    title: str


@dataclass(frozen=True, slots=True)
class Failed:
    """The turn did not answer, and this is what the traveler should be told."""

    detail: str


#: Everything a turn can produce. The loop's own events are passed along
#: rather than copied into twins of themselves: the piece of text that arrives,
#: and the lookup that is running while it does, are the same facts whichever
#: layer is holding them.
Happening = (
    ReplyFragment
    | Consulting
    | Consulted
    | PlanRevised
    | ProfileRevised
    | Recorded
    | Titled
    | Failed
)


async def take_turn(
    session: AsyncSession,
    conversation: Conversation,
    traveler_message: Message,
    model: AsyncOpenAI,
    prompt: Sequence[ChatCompletionMessageParam],
    prompt_version: PromptVersion,
    tools: LiveDataTools,
    settings: Settings,
) -> AsyncIterator[Happening]:
    """Run the turn, recording what it produces as it produces it.

    The Prompt Version travels with the prompt because it is the one the
    prompt was composed from: what the reply is stamped with is the version
    that actually produced it, not whatever is in force by the time it is
    written down.
    """
    try:
        async for event in run_turn(
            model,
            model_name=settings.conversation_model,
            prompt=prompt,
            tools=tools,
            # Built here rather than passed in, because everything they need is
            # already here: the plan tools write to this Conversation's Trip,
            # and to the one they start for it if it has none, and the profile
            # tools write to the one profile there is.
            plan=TripPlanning(session, conversation),
            profile=Remembering(session),
        ):
            if isinstance(event, (ReplyFragment, Consulting, Consulted)):
                yield event
                continue

            if isinstance(event, Patched):
                plan = await plan_of(session, conversation)
                # Only ever None if the Trip went away between the write and
                # this read, which nothing in a turn does.
                if plan is not None:
                    yield PlanRevised(plan, event.changed)
                continue

            if isinstance(event, Remembered):
                yield ProfileRevised(await read_profile(session))
                continue

            advisor_message = await record_message(
                session,
                conversation,
                role=MessageRole.ADVISOR,
                content=event.content,
                prompt_version_id=prompt_version.id,
                cost_usd=event.cost_usd,
                # Kept with the Message rather than with the turn, because a
                # Citation outlives the turn: it is still under the answer when
                # the traveler comes back to read it tomorrow.
                citations=[citation.recorded() for citation in event.citations],
            )
            yield Recorded(advisor_message)

            # Last, because naming is another round trip to another model. The
            # traveler's turn is over by the time it starts, so a slow or failing
            # naming call costs them nothing but a title arriving a moment later.
            named = await _name_unless_named(
                session, conversation, traveler_message, advisor_message, model, settings
            )
            if named is not None:
                yield Titled(named)
    except APIError as failure:
        # Deliberately not the traveler's words or the model's: the log is not a
        # second copy of the conversation.
        logger.warning("The turn failed: %s", type(failure).__name__)
        yield Failed("The advisor could not answer.")


async def _name_unless_named(
    session: AsyncSession,
    conversation: Conversation,
    traveler_message: Message,
    advisor_message: Message,
    model: AsyncOpenAI,
    settings: Settings,
) -> str | None:
    """Name a Conversation after the first exchange that completed in it.

    Answers with the name if this turn is the one that earned it, and None
    otherwise — because the Conversation already had a name, which is written
    once and never rewritten underneath a traveler who has learnt to recognise
    it, or because this exchange left nothing to name it by.
    """
    if conversation.title is not None:
        return None
    named = await name_conversation(
        model,
        model_name=settings.utility_model,
        traveler_said=traveler_message.content,
        advisor_said=advisor_message.content,
    )
    if named is None:
        return None
    await retitle_conversation(session, conversation, named)
    return named
