"""The Conversation queries, in one place rather than inside the routes.

Nothing here raises an HTTP anything. A query that found nothing answers with
nothing, and what that absence means — a 404, an empty list, a Conversation to
create — is the caller's to decide.
"""

import uuid
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .tables import SOLE_TRAVELER_ID, Conversation, Message, MessageRole, Trip

#: How many other Conversations the advisor is told about — a bound, so the
#: prompt does not grow without end. The most recently spoken in are the ones
#: a trip is still being planned across.
MOST_RECENT_OTHERS = 10

#: The moment of the last Message, or the Conversation's beginning while it has
#: none. Derived rather than stored, so a timestamp cannot drift from what was
#: actually said.
LAST_ACTIVITY = func.coalesce(
    select(func.max(Message.created_at))
    .where(Message.conversation_id == Conversation.id)
    .correlate(Conversation)
    .scalar_subquery(),
    Conversation.created_at,
)


async def conversations_by_activity(
    session: AsyncSession,
) -> Sequence[tuple[Conversation, datetime]]:
    """Every Conversation the traveler has, the most recently active first."""
    rows = await session.execute(
        select(Conversation, LAST_ACTIVITY.label("last_activity_at"))
        .where(Conversation.traveler_id == SOLE_TRAVELER_ID)
        # By id second, so a tie in activity still comes back settled.
        .order_by(LAST_ACTIVITY.desc(), Conversation.id)
    )
    return [(conversation, last_activity_at) for conversation, last_activity_at in rows]


async def last_activity_in(session: AsyncSession, conversation: Conversation) -> datetime:
    """When something was last said in this Conversation, or when it was started.

    The same reckoning the list is ordered by, asked of one row.
    """
    activity = await session.scalar(
        select(LAST_ACTIVITY).where(Conversation.id == conversation.id)
    )
    # Coalesced in the database, so there is always one; narrowed here for the
    # type checker.
    return activity if activity is not None else conversation.created_at


async def conversations_apart_from(
    session: AsyncSession, conversation: Conversation | None
) -> Sequence[tuple[str, str | None]]:
    """Every *other* Conversation that has been spoken in, named and placed.

    A title and its Trip's destination — never a word of what was said. Ones
    with no title are left out: they have none because nothing has been said
    in them, and an empty one is not another Conversation about the journey.

    At most `MOST_RECENT_OTHERS`. With no Conversation named, every one of
    them is another one.
    """
    apart = (
        select(Conversation.title, Trip.destination)
        .outerjoin(Trip, Conversation.trip_id == Trip.id)
        .where(Conversation.traveler_id == SOLE_TRAVELER_ID)
        .where(Conversation.title.is_not(None))
        .order_by(LAST_ACTIVITY.desc(), Conversation.id)
        .limit(MOST_RECENT_OTHERS)
    )
    if conversation is not None:
        apart = apart.where(Conversation.id != conversation.id)
    rows = await session.execute(apart)
    # Narrowed for the type checker rather than filtered: the where clause is
    # what makes every title here a string.
    return [(title, destination) for title, destination in rows if title is not None]


async def fold_into_summary(
    session: AsyncSession, conversation: Conversation, *, summary: str, summarised: int
) -> None:
    """Record what Compaction folded away, and how much it covers.

    Only the Conversation row moves; not a Message is touched, which is what
    CONTEXT.md promises about Compaction.
    """
    conversation.summary = summary
    conversation.summarised_messages = summarised
    await session.commit()


async def begin_conversation(session: AsyncSession) -> Conversation:
    """A new Conversation, belonging to the one traveler there is."""
    conversation = Conversation(traveler_id=SOLE_TRAVELER_ID)
    session.add(conversation)
    await session.commit()
    return conversation


async def remove_conversation(session: AsyncSession, conversation: Conversation) -> None:
    """Delete a Conversation and everything said in it: no flag and no hidden
    row, the Messages going with it on the database's own cascade."""
    await session.delete(conversation)
    await session.commit()


async def find_conversation(
    session: AsyncSession, conversation_id: uuid.UUID
) -> Conversation | None:
    """The traveler's Conversation with this identifier, if they have one."""
    conversation = await session.get(Conversation, conversation_id)
    if conversation is None or conversation.traveler_id != SOLE_TRAVELER_ID:
        return None
    return conversation


async def retitle_conversation(
    session: AsyncSession, conversation: Conversation, title: str
) -> None:
    """Give a Conversation its name."""
    conversation.title = title
    await session.commit()


async def record_message(
    session: AsyncSession,
    conversation: Conversation,
    *,
    role: MessageRole,
    content: str,
    prompt_version_id: uuid.UUID | None = None,
    cost_usd: Decimal | None = None,
    citations: Sequence[dict[str, str | None]] = (),
    failure: dict[str, str] | None = None,
) -> Message:
    """Keep something that was said, and answer with it as it was kept.

    Committed rather than left pending: both callers need it to have survived
    before they go on. The Prompt Version is the one the turn composed from,
    left out on a traveler Message; the failure is left out on every Message
    whose turn finished.
    """
    message = Message(
        conversation_id=conversation.id,
        role=role,
        content=content,
        prompt_version_id=prompt_version_id,
        cost_usd=cost_usd,
        citations=list(citations),
        failure=failure,
    )
    session.add(message)
    await session.commit()
    return message


async def discard_message(session: AsyncSession, message: Message) -> None:
    """Take a Message back out of a Conversation.

    Only for running a failed turn again. Nothing else removes a single
    Message: a Conversation goes whole or not at all.
    """
    await session.delete(message)
    await session.commit()


async def messages_in(session: AsyncSession, conversation: Conversation) -> list[Message]:
    """Everything said in this Conversation, in the order it was said."""
    messages = await session.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at, Message.id)
    )
    return list(messages)
