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


#: The application has exactly one traveler, implicitly — there are no accounts.
#: Every other table still carries a real traveler reference, so supporting more
#: than one later is a middleware change rather than a migration.
SOLE_TRAVELER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class Traveler(Base):
    __tablename__ = "traveler"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    #: The next number to list a Profile Fact of this Traveler under, counted
    #: here for the same reason a Trip counts its own — see `Trip.next_item_ref`.
    #: An advisor working from the profile it was shown at the top of the turn
    #: must not be able to delete whatever has taken the place of something it
    #: deleted a moment ago.
    next_fact_ref: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class FactSubject(StrEnum):
    """What a Profile Fact can be about.

    Three the traveler has exactly one of, and one collection for everything a
    fixed set could not anticipate. The difference is the whole of how a
    correction lands: recording a nationality again replaces the nationality
    that was there, rather than standing a contradiction beside it.
    """

    NATIONALITY = "nationality"
    HOME_CITY = "home_city"
    COMPANIONS = "companions"
    NOTE = "note"


class ProfileFact(Base):
    """One entry in the Traveler Profile.

    A row of its own rather than a column on the Traveler, because the traveler
    reads them back one at a time and deletes them one at a time (ADR-0001,
    ADR-0004). A profile kept as a document would make "delete this line" a
    read-modify-write of everything the advisor knows.
    """

    __tablename__ = "profile_fact"
    #: The advisor refers to a fact by its number, because that is what it can
    #: point at in a prompt it is shown every turn.
    __table_args__ = (UniqueConstraint("traveler_id", "ref", name="profile_fact_ref"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    traveler_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traveler.id", ondelete="cascade"), nullable=False
    )
    ref: Mapped[int] = mapped_column(Integer, nullable=False)
    subject: Mapped[FactSubject] = mapped_column(
        Enum(FactSubject, name="fact_subject", values_callable=_values), nullable=False
    )
    #: The fact itself, in the words the traveler would recognise it in.
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp(), nullable=False
    )


class Trip(Base):
    """One journey the traveler is planning, and its one Trip Plan.

    The Trip *is* the plan: destination, dates, party and budget are columns
    here rather than keys in a document, and the Itinerary Items and Open
    Questions are their own tables below. That is what ADR-0002's field-level
    patching needs — a single JSON document would make every patch a
    read-modify-write of the whole plan, and a manual edit made between two
    turns would be read back and written over by the next one.

    Every column is nullable because a Trip is born the moment the advisor
    learns the first thing about it, and knows nothing else yet.
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
    #: What the whole trip is meant to cost, in the currency beside it. The two
    #: are separate columns rather than one string because a figure the
    #: traveler can be shown adding up has to be a number.
    budget_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    #: ISO 4217, upper case.
    budget_currency: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: The next number to list an Itinerary Item and an Open Question of this
    #: Trip under. Counted here rather than from the entries themselves so a
    #: number is never handed out twice: an advisor working from the plan it
    #: was shown at the top of the turn must not be able to remove whatever
    #: has taken the place of something it removed a moment ago.
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

    The day is a number rather than a date, so that moving a Trip a week later
    is one patch to `starts_on` rather than a rewrite of every item. What day 2
    falls on is arithmetic the interface does when there is a start date to do
    it from.
    """

    __tablename__ = "itinerary_item"
    #: The advisor refers to an item by its number within its Trip, because a
    #: UUID in a prompt is thirty-six characters of noise per item and the
    #: advisor has to be shown all of them every turn.
    __table_args__ = (UniqueConstraint("trip_id", "ref", name="itinerary_item_ref"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trip.id", ondelete="cascade"), nullable=False
    )
    ref: Mapped[int] = mapped_column(Integer, nullable=False)
    #: Day 1 is the first day of the Trip.
    day: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    #: Null for something planned for the day without a time in mind, which is
    #: what the traveler adds when they add one themselves.
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
    #: The Trip this thread is refining, and null until something in it is
    #: worth planning. Several Conversations point at one Trip (ADR-0002), so
    #: deleting one of them leaves the Trip and its plan where they are.
    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trip.id", ondelete="set null"), nullable=True
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
    #: source, in the order they were fetched, and a web search leaves one per
    #: page it read. Empty on a traveler Message and on an advisor Message that
    #: looked nothing up.
    citations: Mapped[list[dict[str, str | None]]] = mapped_column(
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
