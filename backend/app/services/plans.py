"""The Trip Plan: read for the prompt, and written by the tools that patch it.

The advisor's side of this lives in `advisor/planning.py` and knows nothing
about storage: a tool call is read there into a typed change, and this is what
knows how to apply one. What comes back is what the advisor is told, and which
parts of the plan moved — which is all the interface needs to highlight them.

A Conversation gets a Trip by the first patch starting one. There is no
"create a Trip" gesture anywhere, because there is no moment in a conversation
where a traveler would make one: a Trip exists because something about a
journey turned out to be worth recording.
"""

from collections.abc import Sequence
from typing import assert_never

from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor import planning
from ..advisor.planning import (
    AddItineraryItem,
    AddOpenQuestion,
    Changed,
    Item,
    JoinTrip,
    PlanChange,
    PlanEdit,
    Question,
    RemoveItineraryItem,
    SetBudget,
    SetDestination,
    SetPartySize,
    SetTripDates,
    SettleOpenQuestion,
    TripPlan,
    TripSummary,
)
from ..db import trips
from ..db.tables import Conversation, PartOfDay, Trip


async def plan_of(session: AsyncSession, conversation: Conversation) -> TripPlan | None:
    """The Trip Plan this Conversation is refining, if it is refining one."""
    trip = await trips.trip_of(session, conversation)
    return None if trip is None else await read_plan(session, trip)


async def read_plan(session: AsyncSession, trip: Trip) -> TripPlan:
    """A Trip and its two collections, as one thing to show or to send."""
    return TripPlan(
        trip_id=trip.id,
        destination=trip.destination,
        starts_on=trip.starts_on,
        ends_on=trip.ends_on,
        party_size=trip.party_size,
        budget_amount=trip.budget_amount,
        budget_currency=trip.budget_currency,
        items=[
            Item(
                id=item.id,
                ref=item.ref,
                day=item.day,
                part_of_day=None if item.part_of_day is None else item.part_of_day.value,
                description=item.description,
            )
            for item in await trips.itinerary_of(session, trip)
        ],
        questions=[
            Question(id=question.id, ref=question.ref, question=question.question)
            for question in await trips.questions_of(session, trip)
        ],
    )


async def read_plans(session: AsyncSession) -> list[TripPlan]:
    """Every Trip the traveler has, each with its plan, most recently first.

    Whole plans rather than a summary of each: the page that lists Trips shows
    what is in one, and the switcher beside the Conversation labels them from
    the same read. A second, thinner shape for a Trip Plan would be a second
    thing to keep true.
    """
    return [await read_plan(session, trip) for trip in await trips.trips_by_age(session)]


async def summarise_trips(session: AsyncSession) -> Sequence[TripSummary]:
    """Every Trip the traveler has, as the list `join_trip` picks out of."""
    return [
        TripSummary(
            trip_id=trip.id,
            destination=trip.destination,
            starts_on=trip.starts_on,
            ends_on=trip.ends_on,
        )
        for trip in await trips.trips_by_age(session)
    ]


class TripPlanning:
    """The advisor's plan tools, applied to this Conversation's Trip.

    Built for one turn, because it holds the Conversation whose Trip it is
    changing — including the moment that Conversation acquires one.
    """

    def __init__(self, session: AsyncSession, conversation: Conversation) -> None:
        self._session = session
        self._conversation = conversation

    async def change(self, asked: PlanChange) -> Changed:
        """Apply one change, and answer with what to tell the advisor."""
        if isinstance(asked, JoinTrip):
            return await self._joined(asked)

        trip = await trips.trip_of(self._session, self._conversation)
        started = trip is None
        if trip is None:
            # Taking something off a plan that does not exist is not a reason
            # to bring one into existence. Only a change that records
            # something starts a Trip.
            if isinstance(asked, (RemoveItineraryItem, SettleOpenQuestion)):
                return Changed(
                    told=(
                        "This conversation has no Trip Plan yet, so there is nothing on it "
                        "to take off."
                    )
                )
            trip = await trips.start_trip(self._session, self._conversation)

        changed = await self._applied(trip, asked)
        if not started:
            return changed
        # Said once, on the turn it happens. The advisor otherwise has no way
        # of knowing whether it is adding to a plan or beginning one, and a
        # traveler who is told "I have started a plan for this" twice has been
        # told something untrue the second time.
        return Changed(
            told=f"{changed.told} This conversation had no Trip, so one was started for it.",
            fields=changed.fields,
            revised=True,
        )

    async def _joined(self, asked: JoinTrip) -> Changed:
        trip = await trips.find_trip(self._session, asked.trip_id)
        if trip is None:
            return Changed(
                told=(
                    f"There is no Trip {asked.trip_id}. Use one of the identifiers you were "
                    "shown exactly, or change the plan directly and a Trip will be started."
                )
            )
        if self._conversation.trip_id == trip.id:
            return Changed(told="This conversation is already attached to that Trip.")
        await trips.attach_conversation(self._session, self._conversation, trip)
        plan = await read_plan(self._session, trip)
        # The whole plan, not a field of it: what the advisor was working from
        # a moment ago was a different Trip's, or none at all.
        return Changed(
            told=(
                "This conversation is now attached to that Trip, and its plan is the one "
                f"you are keeping from here.\n{planning.describe_briefly(plan)}"
            ),
            revised=True,
        )

    async def _applied(self, trip: Trip, asked: PlanEdit) -> Changed:
        if isinstance(asked, SetDestination):
            return await self._scalars(
                trip, {"destination": asked.destination}, f"The destination is {asked.destination}."
            )
        if isinstance(asked, SetTripDates):
            wanted: dict[str, object] = {}
            if asked.starts_on is not None:
                wanted["starts_on"] = asked.starts_on
            if asked.ends_on is not None:
                wanted["ends_on"] = asked.ends_on
            return await self._scalars(trip, wanted, "The dates are recorded.")
        if isinstance(asked, SetPartySize):
            return await self._scalars(
                trip,
                {"party_size": asked.party_size},
                f"The party is {asked.party_size} travelling.",
            )
        if isinstance(asked, SetBudget):
            return await self._scalars(
                trip,
                {"budget_amount": asked.amount, "budget_currency": asked.currency},
                f"The budget is {asked.amount} {asked.currency} for the whole trip.",
            )
        if isinstance(asked, AddItineraryItem):
            return await self._added_item(trip, asked)
        if isinstance(asked, RemoveItineraryItem):
            return await self._removed_item(trip, asked)
        if isinstance(asked, AddOpenQuestion):
            return await self._added_question(trip, asked)
        if isinstance(asked, SettleOpenQuestion):
            return await self._settled_question(trip, asked)
        assert_never(asked)

    async def _scalars(self, trip: Trip, wanted: dict[str, object], told: str) -> Changed:
        """Write the named fields, and only the ones that would actually move.

        A field already holding what it was asked to hold is left alone rather
        than written with the same value: the traveler watches changed fields
        light up, and a field lighting up for a change that was not one sends
        them looking for something that did not happen.
        """
        moved = {field: value for field, value in wanted.items() if getattr(trip, field) != value}
        if not moved:
            return Changed(told=f"{told} The plan already said so, so nothing changed.")
        await trips.patch_trip(self._session, trip, moved)
        return Changed(told=told, fields=list(moved), revised=True)

    async def _added_item(self, trip: Trip, asked: AddItineraryItem) -> Changed:
        item = await trips.add_itinerary_item(
            self._session,
            trip,
            day=asked.day,
            part_of_day=None if asked.part_of_day is None else PartOfDay(asked.part_of_day),
            description=asked.description,
        )
        return Changed(
            told=(
                f"Day {item.day} of the itinerary now has [{item.ref}] {item.description}. "
                f"Remove it with remove_itinerary_item item={item.ref}."
            ),
            fields=[str(item.id)],
            revised=True,
        )

    async def _removed_item(self, trip: Trip, asked: RemoveItineraryItem) -> Changed:
        item = await trips.item_by_ref(self._session, trip, asked.item)
        if item is None:
            return Changed(
                told=(
                    f"There is no itinerary item [{asked.item}] on this plan. It may have "
                    "been removed already, by you or by the traveler."
                )
            )
        description = item.description
        await trips.remove(self._session, item)
        return Changed(told=f"[{asked.item}] {description} is off the itinerary.", revised=True)

    async def _added_question(self, trip: Trip, asked: AddOpenQuestion) -> Changed:
        question = await trips.add_open_question(self._session, trip, asked.question)
        return Changed(
            told=(
                f"The plan now asks [{question.ref}] {question.question} "
                f"Settle it with settle_open_question question={question.ref}."
            ),
            fields=[str(question.id)],
            revised=True,
        )

    async def _settled_question(self, trip: Trip, asked: SettleOpenQuestion) -> Changed:
        question = await trips.question_by_ref(self._session, trip, asked.question)
        if question is None:
            return Changed(
                told=(
                    f"There is no open question [{asked.question}] on this plan. It may "
                    "have been settled already, by you or by the traveler."
                )
            )
        asking = question.question
        await trips.remove(self._session, question)
        return Changed(told=f"[{asked.question}] {asking} is settled.", revised=True)
