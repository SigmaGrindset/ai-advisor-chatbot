"""The Trip queries, beside the Conversation ones and in the same spirit.

Nothing here raises an HTTP anything, and nothing here decides what a change
means. A Trip Plan is rows: the scalar fields on the Trip, the Itinerary Items
and the Open Questions in tables of their own, each row addressable on its own
so that changing one leaves the rest exactly as it was (ADR-0002).
"""

import uuid
from collections.abc import Mapping, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .tables import (
    SOLE_TRAVELER_ID,
    Conversation,
    ItineraryItem,
    OpenQuestion,
    PartOfDay,
    Trip,
)

#: The order a day's items are read in: the morning before the evening, and
#: anything with no time in mind after everything that has one. Postgres sorts
#: an enum by the order its values were declared and puts nulls last on an
#: ascending sort, which is both of those without a case expression.
ITINERARY_ORDER = (
    ItineraryItem.day,
    ItineraryItem.part_of_day,
    ItineraryItem.created_at,
    ItineraryItem.id,
)


async def find_trip(session: AsyncSession, trip_id: uuid.UUID) -> Trip | None:
    """The traveler's Trip with this identifier, if they have one."""
    trip = await session.get(Trip, trip_id)
    if trip is None or trip.traveler_id != SOLE_TRAVELER_ID:
        return None
    return trip


async def trip_of(session: AsyncSession, conversation: Conversation) -> Trip | None:
    """The Trip this Conversation is refining, if it is refining one."""
    if conversation.trip_id is None:
        return None
    return await find_trip(session, conversation.trip_id)


async def trips_by_age(session: AsyncSession) -> Sequence[Trip]:
    """Every Trip the traveler has, the most recently started first."""
    trips = await session.scalars(
        select(Trip)
        .where(Trip.traveler_id == SOLE_TRAVELER_ID)
        .order_by(Trip.created_at.desc(), Trip.id)
    )
    return list(trips)


async def start_trip(session: AsyncSession, conversation: Conversation) -> Trip:
    """A new Trip, belonging to the one traveler, with this Conversation on it.

    There is no separate "create a Trip" gesture anywhere: a Trip exists
    because something about a journey was worth recording, so it is born
    attached to the Conversation that recorded the first thing.
    """
    trip = Trip(traveler_id=SOLE_TRAVELER_ID)
    session.add(trip)
    await session.flush()
    conversation.trip_id = trip.id
    await session.commit()
    return trip


async def attach_conversation(
    session: AsyncSession, conversation: Conversation, trip: Trip | None
) -> None:
    """Point a Conversation at a Trip, or at none.

    Attaching is how several Conversations come to refine one plan; detaching
    is how one the advisor put on the wrong journey is taken off it. Neither
    touches the Trip: a Trip with no Conversation left on it is still the
    traveler's and is still listed, because the plan is the durable thing here
    and the Conversations are how it got written.
    """
    conversation.trip_id = None if trip is None else trip.id
    await session.commit()


async def patch_trip(session: AsyncSession, trip: Trip, changes: Mapping[str, object]) -> None:
    """Write exactly the named fields and nothing else.

    The whole of why the plan is columns rather than a document: what is not
    named here is not read, not rewritten, and cannot be lost — including the
    field the traveler edited by hand a moment ago.
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

    Read rather than counted, because the only caller deletes them: the
    database would take them off this Trip on its own, and taking them off is
    exactly what it must not do when the traveler asked for them to go.
    """
    found = await session.scalars(select(Conversation).where(Conversation.trip_id == trip.id))
    return list(found)


async def remove_trip(session: AsyncSession, trip: Trip, *, with_conversations: bool) -> None:
    """Delete a Trip and its Trip Plan, and the Conversations on it if asked.

    The Itinerary Items and the Open Questions go with it on the database's
    own cascade, because they are not attached to the plan — they are the
    plan, and the plan is the Trip.

    The Conversations are the one part that is a question, so the traveler
    answers it. Kept, they come off this Trip and are listed under no Trip,
    which is where every Conversation starts and is what the foreign key does
    by itself. Deleted, everything said in them goes too, on the same cascade
    a Conversation deleted on its own rides — and they are deleted here,
    first, precisely because the alternative is the database quietly detaching
    the very rows that were meant to go.
    """
    if with_conversations:
        for conversation in await conversations_on(session, trip):
            await session.delete(conversation)
        await session.flush()
    await session.delete(trip)
    await session.commit()
