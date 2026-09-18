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

from ..advisor.loop import ReplyFragment, run_turn
from ..advisor.titles import name_conversation
from ..config import Settings
from ..db.conversations import record_message, retitle_conversation
from ..db.tables import Conversation, Message, MessageRole

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class Recorded:
    """The reply, now a Message that will still be there after a reload."""

    message: Message


@dataclass(frozen=True, slots=True)
class Titled:
    """The Conversation has a title, which it did not have a moment ago."""

    title: str


@dataclass(frozen=True, slots=True)
class Failed:
    """The turn did not answer, and this is what the traveler should be told."""

    detail: str


#: Everything a turn can produce. A fragment is the loop's own event, passed
#: along rather than copied into a twin of itself: the piece of text that
#: arrives is the same fact whichever layer is holding it.
Happening = ReplyFragment | Recorded | Titled | Failed


async def take_turn(
    session: AsyncSession,
    conversation: Conversation,
    traveler_message: Message,
    model: AsyncOpenAI,
    prompt: Sequence[ChatCompletionMessageParam],
    settings: Settings,
) -> AsyncIterator[Happening]:
    """Run the turn, recording what it produces as it produces it."""
    try:
        async for event in run_turn(
            model, model_name=settings.conversation_model, prompt=prompt
        ):
            if isinstance(event, ReplyFragment):
                yield event
                continue

            advisor_message = await record_message(
                session,
                conversation,
                role=MessageRole.ADVISOR,
                content=event.content,
                cost_usd=event.cost_usd,
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
