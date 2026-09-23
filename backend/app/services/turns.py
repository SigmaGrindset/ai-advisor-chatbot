"""One turn, from the prompt to everything the turn leaves behind.

The advisor's loop knows nothing about the database and the routes know nothing
about the model. This is where the two meet: it drives the loop, records what
comes back, and names the Conversation if this is the exchange that earned it.

What it yields is what happened, not what to send. The wire format stays in
`api/`, so the events below can grow a tool call or a Trip Plan patch without
the shape of the HTTP response being decided in here.
"""

import logging
import traceback
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass

from openai import APIError, AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor import failures
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
from ..advisor.failures import Failure
from ..config import Settings
from ..db.conversations import record_message, retitle_conversation
from ..db.tables import Conversation, Message, MessageRole, PromptVersion, Traveler
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

    The loop reports *that* it moved; reading it back is this layer's, since
    the loop has no database. The whole plan rather than the patch, because a
    Conversation's first patch starts a Trip and the traveler may be holding
    no plan at all rather than an older one.
    """

    plan: TripPlan
    #: What to highlight. Empty when the Conversation was attached to a
    #: different Trip, which changes everything and highlights nothing.
    changed: Sequence[str]


@dataclass(frozen=True, slots=True)
class ProfileRevised:
    """The Traveler Profile has changed mid-turn, and this is what it says now.

    The whole profile rather than the fact that moved: a correction *replaces*
    a fact, so a patch would have to say which one it replaced.
    """

    profile: Sequence[Fact]


@dataclass(frozen=True, slots=True)
class Titled:
    """The Conversation has a title, which it did not have a moment ago."""

    title: str


@dataclass(frozen=True, slots=True)
class Failed:
    """The turn did not answer, and this is what is left of it.

    A Message either way, so the traveler can come back to it: it holds
    whatever had arrived of the reply, and carries the failure as its marker.
    """

    message: Message
    failure: Failure


#: Everything a turn can produce. The loop's own events are passed along
#: rather than copied into twins of themselves.
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
    traveler: Traveler,
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
    prompt was composed from, rather than whatever is in force by the time the
    reply is written down.

    A failed turn leaves a Message behind rather than only an event, so what
    the traveler is looking at survives a reload and can be run again.
    """
    # Kept as it is passed on, so a turn dying halfway can still leave the
    # half the traveler watched being written.
    written: list[str] = []
    # Whether the reply is already a Message. What is left after that is work
    # the traveler never sees, and a failure in it is not a failure of the turn.
    answered = False
    try:
        async for event in run_turn(
            model,
            model_name=settings.conversation_model,
            prompt=prompt,
            tools=tools,
            # Built here, because everything they need is already here: the
            # plan tools write to this Conversation's Trip, or the one they
            # start for it, and the profile tools to this traveler's profile.
            plan=TripPlanning(session, traveler, conversation),
            profile=Remembering(session, traveler),
        ):
            if isinstance(event, ReplyFragment):
                written.append(event.text)
                yield event
                continue

            if isinstance(event, (Consulting, Consulted)):
                yield event
                continue

            if isinstance(event, Patched):
                plan = await plan_of(session, traveler, conversation)
                # Only ever None if the Trip went away between the write and
                # this read, which nothing in a turn does.
                if plan is not None:
                    yield PlanRevised(plan, event.changed)
                continue

            if isinstance(event, Remembered):
                yield ProfileRevised(await read_profile(session, traveler))
                continue

            advisor_message = await record_message(
                session,
                conversation,
                role=MessageRole.ADVISOR,
                content=event.content,
                prompt_version_id=prompt_version.id,
                cost_usd=event.cost_usd,
                # Kept with the Message rather than the turn: a Citation is
                # still under the answer when the traveler reads it tomorrow.
                citations=[citation.recorded() for citation in event.citations],
            )
            # The figure and the Conversation, and not a word of what was said:
            # the log is not a second copy of the conversation.
            logger.info(
                "A turn answered in conversation %s, costing %s",
                conversation.id,
                "an unreported amount"
                if event.cost_usd is None
                else f"{event.cost_usd} USD",
            )
            answered = True
            yield Recorded(advisor_message)

            # Last, because naming is another round trip to another model: the
            # traveler's turn is over, so a slow one costs them nothing.
            named = await _name_unless_named(
                session, conversation, traveler_message, advisor_message, model, settings
            )
            if named is not None:
                yield Titled(named)
    except APIError as error:
        failed = failures.of(error)
        # The kind is the thing worth grepping for: a log full of
        # `configuration` is one machine that was never given a key.
        logger.warning("A turn failed: %s (%s)", failed.kind.value, type(error).__name__)
        if not answered:
            yield await _failed(session, conversation, prompt_version, written, failed)
    except Exception as error:
        # Anything not the provider's doing is ours, and is reported as such:
        # the point of the distinction is that one of them is a bug. The type
        # and line but not the message — a database error carries the statement
        # that failed and the parameters bound into it.
        logger.error(
            "A turn failed unexpectedly: %s at %s", type(error).__name__, _where(error)
        )
        if not answered:
            yield await _failed(
                session, conversation, prompt_version, written, failures.UNEXPECTED
            )


async def _failed(
    session: AsyncSession,
    conversation: Conversation,
    prompt_version: PromptVersion,
    written: Sequence[str],
    failed: Failure,
) -> Failed:
    """Keep what the turn had written, marked with what stopped it.

    Stamped with the Prompt Version like any other advisor Message: a reply
    that stopped halfway is still a reply those instructions produced.
    """
    return Failed(
        await record_message(
            session,
            conversation,
            role=MessageRole.ADVISOR,
            content="".join(written),
            prompt_version_id=prompt_version.id,
            failure=failed.recorded(),
        ),
        failed,
    )


def _where(failure: BaseException) -> str:
    """The file and line a failure came from, and nothing in scope there.

    Enough to tell a bug from a misconfiguration at a glance. A traceback
    would say the same and carry the exception's message with it.
    """
    frames = traceback.extract_tb(failure.__traceback__)
    if not frames:
        return "an unknown place"
    return f"{frames[-1].filename}:{frames[-1].lineno}"


async def _name_unless_named(
    session: AsyncSession,
    conversation: Conversation,
    traveler_message: Message,
    advisor_message: Message,
    model: AsyncOpenAI,
    settings: Settings,
) -> str | None:
    """Name a Conversation after the first exchange that completed in it.

    None when it already had a name — written once, never rewritten under a
    traveler who has learnt to recognise it — or when this exchange left
    nothing to name it by.
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
