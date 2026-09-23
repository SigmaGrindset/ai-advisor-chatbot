"""Database tables."""

import uuid
from collections.abc import Sequence
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _values(enum: type[StrEnum]) -> Sequence[str]:
    """Store an enum by its value, so the database reads as the domain speaks."""
    return [member.value for member in enum]


class Traveler(Base):
    """Whoever is asking. Everything else hangs off one, and goes with it."""

    __tablename__ = "traveler"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    #: How a Guest is known again: the hash of the token their browser holds,
    #: never the token, so a copy of this table identifies nobody.
    guest_token_hash: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    #: The next number to list a Profile Fact under, counted here so a number
    #: is never handed out twice — see `Trip.next_item_ref`.
    next_fact_ref: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class FactSubject(StrEnum):
    """What a Profile Fact can be about.

    Three the traveler has exactly one of, and one collection for the rest.
    That is how a correction lands: recording a nationality again replaces the
    one there rather than standing a contradiction beside it.
    """

    NATIONALITY = "nationality"
    HOME_CITY = "home_city"
    COMPANIONS = "companions"
    NOTE = "note"


class ProfileFact(Base):
    """One entry in the Traveler Profile.

    A row of its own because the traveler reads them and deletes them one at a
    time (ADR-0001, ADR-0004); as a document, "delete this line" would be a
    read-modify-write of everything the advisor knows.
    """

    __tablename__ = "profile_fact"
    #: The advisor points at a fact by its number in the prompt.
    __table_args__ = (UniqueConstraint("traveler_id", "ref", name="profile_fact_ref"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    traveler_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traveler.id", ondelete="cascade"), nullable=False
    )
    ref: Mapped[int] = mapped_column(Integer, nullable=False)
    subject: Mapped[FactSubject] = mapped_column(
        Enum(FactSubject, name="fact_subject", values_callable=_values), nullable=False
    )
    #: In the words the traveler would recognise it in.
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), nullable=False
    )


class PromptVersion(Base):
    """A saved revision of the Advisor Instructions.

    A row per revision rather than one written over in place, because every
    advisor Message records the version that produced it.

    Only the editable part is stored; what is composed around it is whatever
    `advisor/instructions.py` says at the time of the turn, so a version is
    never a stale copy of rules nobody edited.

    The instructions in force are the last saved. None is deleted on its own —
    a version a Message points at explains that Message.
    """

    __tablename__ = "prompt_version"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    traveler_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traveler.id", ondelete="cascade"), nullable=False
    )
    #: Counted by the database, and the highest is the one in force. Not
    #: `created_at`: which instructions the advisor is given is not a question
    #: to answer by inference from a clock, nor to tie-break at random.
    revision: Mapped[int] = mapped_column(Integer, Identity(), nullable=False)
    #: The advisor's persona and its rules.
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    #: Provenance rather than order.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), nullable=False
    )


class Trip(Base):
    """One journey the traveler is planning, and its one Trip Plan.

    The Trip *is* the plan: columns rather than keys in a document, which is
    what field-level patching needs. As one JSON document, every
    patch would be a read-modify-write, and a manual edit between two turns
    would be written over by the next one.

    Every column is nullable: a Trip is born the moment the advisor learns the
    first thing about it.
    """

    __tablename__ = "trip"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    traveler_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traveler.id", ondelete="cascade"), nullable=False
    )
    destination: Mapped[str | None] = mapped_column(Text, nullable=True)
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    #: How many people are travelling, the traveler included.
    party_size: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    #: Two columns rather than one string: a figure the traveler can be shown
    #: adding up has to be a number.
    budget_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    #: ISO 4217, upper case.
    budget_currency: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Counted here rather than from the entries, so a number is never handed
    #: out twice: an advisor working from the plan it was shown at the top of
    #: the turn must not remove whatever replaced what it removed a moment ago.
    next_item_ref: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    next_question_ref: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), nullable=False
    )


class PartOfDay(StrEnum):
    """Roughly when in a day something happens, which is as exact as a plan gets."""

    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"


class ItineraryItem(Base):
    """One thing planned for a particular day of a Trip.

    The day is a number rather than a date, so moving a Trip a week later is
    one patch to `starts_on` rather than a rewrite of every item.
    """

    __tablename__ = "itinerary_item"
    #: A number rather than a UUID: the advisor is shown all of them every turn.
    __table_args__ = (UniqueConstraint("trip_id", "ref", name="itinerary_item_ref"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trip.id", ondelete="cascade"), nullable=False
    )
    ref: Mapped[int] = mapped_column(Integer, nullable=False)
    #: Day 1 is the first day of the Trip.
    day: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    #: Null for a day with no time in mind, which is what the traveler adds.
    part_of_day: Mapped[PartOfDay | None] = mapped_column(
        Enum(PartOfDay, name="part_of_day", values_callable=_values), nullable=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), nullable=False
    )


class OpenQuestion(Base):
    """Something a Trip Plan still needs decided."""

    __tablename__ = "open_question"
    __table_args__ = (UniqueConstraint("trip_id", "ref", name="open_question_ref"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trip.id", ondelete="cascade"), nullable=False
    )
    ref: Mapped[int] = mapped_column(Integer, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), nullable=False
    )


class Conversation(Base):
    """One continuous thread of Messages between the traveler and the advisor."""

    __tablename__ = "conversation"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    traveler_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traveler.id", ondelete="cascade"), nullable=False
    )
    #: Null until something in it is worth planning. Several Conversations
    #: point at one Trip, so deleting one leaves the Trip alone.
    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trip.id", ondelete="set null"), nullable=True
    )
    #: Named after its first exchange. Null until there has been one.
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: The rolling summary Compaction keeps, standing in for the older stretch
    #: in the prompt once sending it whole costs more than it is worth.
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: How many Messages from the first the summary stands in for; the rest are
    #: sent verbatim. A count rather than a marker on each Message, because
    #: Messages are only appended and the traveler still reads every one.
    summarised_messages: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    #: clock_timestamp() for the reason Message uses it, below.
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
    #: One entry per source fetched this turn, in order; a web search leaves
    #: one per page it read. Empty when the turn looked nothing up.
    citations: Mapped[list[dict[str, str | None]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    #: Null on a traveler Message, which no prompt produced, and null again
    #: once the version has gone with everything else the traveler deleted.
    prompt_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_version.id", ondelete="set null"), nullable=True
    )
    #: What OpenRouter charged, from its own figures rather than a later poll.
    cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(18, 10), nullable=True)
    #: Why the turn did not finish — its kind and what the traveler is told.
    #: A failed turn leaves an advisor Message holding whatever had arrived of
    #: the reply, and this marker is what tells an empty one apart from an
    #: advisor with nothing to say. Kept here rather than in the browser so a
    #: reload still finds the question and the way to ask it again.
    failure: Mapped[dict[str, str] | None] = mapped_column(JSONB, nullable=True)
    #: clock_timestamp() rather than now(): now() is the transaction timestamp,
    #: so Messages written inside one transaction would lose their order.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), nullable=False
    )
