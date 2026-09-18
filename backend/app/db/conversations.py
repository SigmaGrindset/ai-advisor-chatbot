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

from .tables import SOLE_TRAVELER_ID, Conversation, Message, MessageRole

#: The moment of the last Message, or the Conversation's own beginning while it
#: has none. Derived rather than stored, so there is one clock and no way for a
#: recorded timestamp to drift from what was actually said.
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
        # By id second, so Conversations whose last activity falls in the same
        # instant still come back in a settled order rather than an arbitrary one.
        .order_by(LAST_ACTIVITY.desc(), Conversation.id)
    )
    return [(conversation, last_activity_at) for conversation, last_activity_at in rows]


async def begin_conversation(session: AsyncSession) -> Conversation:
    """A new Conversation, belonging to the one traveler there is."""
    conversation = Conversation(traveler_id=SOLE_TRAVELER_ID)
    session.add(conversation)
    await session.commit()
    return conversation


async def remove_conversation(session: AsyncSession, conversation: Conversation) -> None:
    """Delete a Conversation and everything said in it.

    There is no flag and no hidden row: the Messages go with it, on the
    database's own cascade.
    """
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
    cost_usd: Decimal | None = None,
    citations: Sequence[dict[str, str]] = (),
) -> Message:
    """Keep something that was said, and answer with it as it was kept.

    Committed rather than left pending, because both callers need it to have
    survived before they go on: the traveler's words before the model is
    called, the advisor's before the browser is told they exist.
    """
    message = Message(
        conversation_id=conversation.id,
        role=role,
        content=content,
        cost_usd=cost_usd,
        citations=list(citations),
    )
    session.add(message)
    await session.commit()
    return message


async def messages_in(session: AsyncSession, conversation: Conversation) -> list[Message]:
    """Everything said in this Conversation, in the order it was said."""
    messages = await session.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at, Message.id)
    )
    return list(messages)
