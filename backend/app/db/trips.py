"""The Trip queries, beside the Conversation ones and in the same spirit.

Nothing here raises an HTTP anything, and nothing here decides what a change
means. A Trip Plan is rows: the scalar fields on the Trip, the Itinerary Items
and the Open Questions in tables of their own, each row addressable on its own
so that changing one leaves the rest exactly as it was.
"""

import uuid
from collections.abc import Mapping, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .tables import (
    Conversation,
    ItineraryItem,
    OpenQuestion,
    PartOfDay,
    Traveler,
    Trip,
)

#: Morning before evening, and anything with no time in mind last. Postgres
#: sorts an enum by declaration order and puts nulls last ascending, which is
#: both of those without a case expression.
ITINERARY_ORDER = (
    ItineraryItem.day,
    ItineraryItem.part_of_day,
    ItineraryItem.created_at,
    ItineraryItem.id,
)


async def find_trip(session: AsyncSession, traveler: Traveler, trip_id: uuid.UUID) -> Trip | None:
    """The traveler's Trip with this identifier, if they have one."""
    trip = await session.get(Trip, trip_id)
    if trip is None or trip.traveler_id != traveler.id:
        return None
    return trip


async def trip_of(
    session: AsyncSession, traveler: Traveler, conversation: Conversation
) -> Trip | None:
    """The Trip this Conversation is refining, if it is refining one."""
    if conversation.trip_id is None:
        return None
    return await find_trip(session, traveler, conversation.trip_id)


async def trips_by_age(session: AsyncSession, traveler: Traveler) -> Sequence[Trip]:
    """Every Trip the traveler has, the most recently started first."""
    trips = await session.scalars(
        select(Trip)
        .where(Trip.traveler_id == traveler.id)
        .order_by(Trip.created_at.desc(), Trip.id)
    )
    return list(trips)


async def start_trip(
    session: AsyncSession, traveler: Traveler, conversation: Conversation
) -> Trip:
    """A new Trip, belonging to this traveler, with this Conversation on it.

    There is no separate "create a Trip" gesture: a Trip is born attached to
    the Conversation that recorded the first thing about a journey.
    """
    trip = Trip(traveler_id=traveler.id)
    session.add(trip)
    await session.flush()
    conversation.trip_id = trip.id
    await session.commit()
    return trip


async def attach_conversation(
    session: AsyncSession, conversation: Conversation, trip: Trip | None
) -> None:
    """Point a Conversation at a Trip, or at none.

    Neither touches the Trip: one with no Conversation left on it is still
    listed, the plan being the durable thing and the Conversations how it
    got written.
    """
    conversation.trip_id = None if trip is None else trip.id
    await session.commit()


async def patch_trip(session: AsyncSession, trip: Trip, changes: Mapping[str, object]) -> None:
    """Write exactly the named fields and nothing else.

    Why the plan is columns rather than a document: what is not named is not
    read, not rewritten and cannot be lost — including a field the traveler
    edited by hand a moment ago.
    """
    for field, value in changes.items():
        setattr(trip, field, value)
    await session.commit()


async def itinerary_of(session: AsyncSession, trip: Trip) -> list[ItineraryItem]:
    """Everything planned into a day of this Trip, in the order it happens."""
    items = await session.scalars(
        select(ItineraryItem).where(ItineraryItem.trip_id == trip.id).order_by(*ITINERARY_ORDER)
    )
    return list(items)


async def questions_of(session: AsyncSession, trip: Trip) -> list[OpenQuestion]:
    """What this Trip Plan still needs decided, in the order it was asked."""
    questions = await session.scalars(
        select(OpenQuestion)
        .where(OpenQuestion.trip_id == trip.id)
        .order_by(OpenQuestion.created_at, OpenQuestion.id)
    )
    return list(questions)


async def add_itinerary_item(
    session: AsyncSession,
    trip: Trip,
    *,
    day: int,
    part_of_day: PartOfDay | None,
    description: str,
) -> ItineraryItem:
    """Put one thing into one day of this Trip."""
    item = ItineraryItem(
        trip_id=trip.id,
        ref=trip.next_item_ref,
        day=day,
        part_of_day=part_of_day,
        description=description,
    )
    trip.next_item_ref += 1
    session.add(item)
    await session.commit()
    return item


async def add_open_question(session: AsyncSession, trip: Trip, question: str) -> OpenQuestion:
    """Record something this Trip Plan still needs decided."""
    asked = OpenQuestion(trip_id=trip.id, ref=trip.next_question_ref, question=question)
    trip.next_question_ref += 1
    session.add(asked)
    await session.commit()
    return asked


async def item_by_ref(session: AsyncSession, trip: Trip, ref: int) -> ItineraryItem | None:
    """The Itinerary Item the advisor knows by that number, if it is still there."""
    item: ItineraryItem | None = await session.scalar(
        select(ItineraryItem).where(ItineraryItem.trip_id == trip.id, ItineraryItem.ref == ref)
    )
    return item


async def item_by_id(
    session: AsyncSession, trip: Trip, item_id: uuid.UUID
) -> ItineraryItem | None:
    """The Itinerary Item the interface knows by its identifier."""
    item: ItineraryItem | None = await session.scalar(
        select(ItineraryItem).where(ItineraryItem.trip_id == trip.id, ItineraryItem.id == item_id)
    )
    return item


async def question_by_ref(session: AsyncSession, trip: Trip, ref: int) -> OpenQuestion | None:
    """The Open Question the advisor knows by that number, if it is still there."""
    question: OpenQuestion | None = await session.scalar(
        select(OpenQuestion).where(OpenQuestion.trip_id == trip.id, OpenQuestion.ref == ref)
    )
    return question


async def question_by_id(
    session: AsyncSession, trip: Trip, question_id: uuid.UUID
) -> OpenQuestion | None:
    """The Open Question the interface knows by its identifier."""
    question: OpenQuestion | None = await session.scalar(
        select(OpenQuestion).where(
            OpenQuestion.trip_id == trip.id, OpenQuestion.id == question_id
        )
    )
    return question


async def patch_itinerary_item(
    session: AsyncSession, item: ItineraryItem, changes: Mapping[str, object]
) -> None:
    """Write exactly the named fields of one Itinerary Item."""
    for field, value in changes.items():
        setattr(item, field, value)
    await session.commit()


async def remove(session: AsyncSession, row: ItineraryItem | OpenQuestion) -> None:
    """Take one entry off the plan, for good.

    The number it was listed under goes with it and is never handed out again
    — see `Trip.next_item_ref`.
    """
    await session.delete(row)
    await session.commit()


async def conversations_on(session: AsyncSession, trip: Trip) -> list[Conversation]:
    """Every Conversation refining this Trip, in no particular order.

    Read rather than counted, because the only caller deletes them: left to
    itself the database would merely detach them.
    """
    found = await session.scalars(select(Conversation).where(Conversation.trip_id == trip.id))
    return list(found)


async def remove_trip(session: AsyncSession, trip: Trip, *, with_conversations: bool) -> None:
    """Delete a Trip and its Trip Plan, and the Conversations on it if asked.

    The Itinerary Items and Open Questions go on the database's cascade: they
    are the plan, and the plan is the Trip.

    The Conversations are the traveler's question. Kept, the foreign key lists
    them under no Trip by itself. Deleted, they go here and first — otherwise
    the database quietly detaches the very rows that were meant to go.
    """
    if with_conversations:
        for conversation in await conversations_on(session, trip):
            await session.delete(conversation)
        await session.flush()
    await session.delete(trip)
    await session.commit()
