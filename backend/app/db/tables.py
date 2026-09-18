"""Database tables."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _values(enum: type[StrEnum]) -> Sequence[str]:
    """Store an enum by its value, so the database reads as the domain speaks."""
    return [member.value for member in enum]


#: The application has exactly one traveler, implicitly — there are no accounts.
#: Every other table still carries a real traveler reference, so supporting more
#: than one later is a middleware change rather than a migration.
SOLE_TRAVELER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class Traveler(Base):
    __tablename__ = "traveler"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Conversation(Base):
    """One continuous thread of Messages between the traveler and the advisor."""

    __tablename__ = "conversation"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    traveler_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traveler.id", ondelete="cascade"), nullable=False
    )
    #: Named after its first exchange, so it is recognisable in the list. Null
    #: until there has been an exchange to name it after.
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: clock_timestamp() for the same reason Message uses it: now() is the
    #: transaction timestamp, so Conversations started inside one transaction
    #: would share a timestamp and lose their order.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), nullable=False
    )


class MessageRole(StrEnum):
    """Who a Message is from. The model's own vocabulary is a wire detail."""

    TRAVELER = "traveler"
    ADVISOR = "advisor"


class Message(Base):
    """A single turn in a Conversation."""

    __tablename__ = "message"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversation.id", ondelete="cascade"), nullable=False
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role", values_callable=_values), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    #: Where anything fetched during this turn came from — one entry per
    #: Live-data Tool answer, in the order they were fetched. Empty on a
    #: traveler Message and on an advisor Message that looked nothing up.
    citations: Mapped[list[dict[str, str]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    #: What OpenRouter charged for the turn that produced this Message, from its own
    #: figures rather than a later poll of the account. Null on a traveler Message,
    #: and on an advisor Message whose provider reported no cost.
    cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(18, 10), nullable=True)
    #: clock_timestamp() rather than now(): now() is the transaction timestamp, so
    #: Messages written inside one transaction — as the test harness does — would
    #: share a timestamp and lose their order.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), nullable=False
    )
