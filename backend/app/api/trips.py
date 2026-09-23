"""The Trip Plan as the browser reads it, and as the traveler edits it by hand.

Every route here answers with the whole plan, because every one of them
changed it and the pane beside the conversation is showing it. What they
*write* is only ever what was named: the same field-level patching the advisor
is held to, through the same rows.

A body that names a field with null is asking for it to be emptied, and a body
that leaves it out is not asking about it at all. Pydantic keeps those apart;
`exclude_unset` is where the difference is read.
"""

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor.planning import (
    MAX_DAY,
    MAX_DESCRIPTION,
    MAX_DESTINATION,
    MAX_PARTY,
    PARTS_OF_DAY,
    TripPlan,
)
from ..db import trips
from ..db.connection import get_session
from ..db.tables import PartOfDay, Traveler, Trip
from ..services.plans import read_plan, read_plans
from .asking import who_is_asking

router = APIRouter(tags=["trips"])

#: The same bounds the advisor's tools are held to. Both write the same
#: columns, so a limit applying to one of them would be a limit on nothing.
Destination = Annotated[str, Field(min_length=1, max_length=MAX_DESTINATION)]
PartySize = Annotated[int, Field(ge=1, le=MAX_PARTY)]
Money = Annotated[float, Field(ge=0)]
Currency = Annotated[str, Field(pattern="^[A-Za-z]{3}$")]
Day = Annotated[int, Field(ge=1, le=MAX_DAY)]
Description = Annotated[str, Field(min_length=1, max_length=MAX_DESCRIPTION)]
When = Annotated[str, Field(pattern=f"^({'|'.join(PARTS_OF_DAY)})$")]

#: Two words rather than a flag: a caller that forgets a flag gets `false` and
#: reads as though it meant it, and what is being defaulted is whether the
#: traveler's transcripts survive.
OnDeletingTrip = Literal["keep", "delete"]


class ItineraryItemView(BaseModel):
    """One thing planned for a particular day of the Trip."""

    id: uuid.UUID
    #: Day 1 is the first day of the Trip, whenever that turns out to be.
    day: int
    #: Null for something planned for a day without a time in mind.
    part_of_day: str | None
    description: str


class OpenQuestionView(BaseModel):
    id: uuid.UUID
    question: str


class TripPlanView(BaseModel):
    """A Trip Plan whole, which is what every change to one answers with."""

    trip_id: uuid.UUID
    destination: str | None
    starts_on: date | None
    ends_on: date | None
    party_size: int | None
    budget_amount: float | None
    #: ISO 4217, upper case.
    budget_currency: str | None
    items: list[ItineraryItemView]
    questions: list[OpenQuestionView]

    @classmethod
    def of(cls, plan: TripPlan) -> "TripPlanView":
        return cls(
            trip_id=plan.trip_id,
            destination=plan.destination,
            starts_on=plan.starts_on,
            ends_on=plan.ends_on,
            party_size=plan.party_size,
            budget_amount=None if plan.budget_amount is None else float(plan.budget_amount),
            budget_currency=plan.budget_currency,
            items=[
                ItineraryItemView(
                    id=item.id,
                    day=item.day,
                    part_of_day=item.part_of_day,
                    description=item.description,
                )
                for item in plan.items
            ],
            questions=[
                OpenQuestionView(id=question.id, question=question.question)
                for question in plan.questions
            ],
        )


class PlanPatch(BaseModel):
    """What the traveler changed by hand, and nothing they did not touch."""

    destination: Destination | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    party_size: PartySize | None = None
    budget_amount: Money | None = None
    budget_currency: Currency | None = None


class NewItineraryItem(BaseModel):
    day: Day
    part_of_day: When | None = None
    description: Description


class ItineraryItemPatch(BaseModel):
    """The one thing the traveler edits on an item in place.

    Not its day and not its part of day: there is no control for either, and
    an endpoint that accepts what nothing sends is a promise nothing keeps.
    """

    description: Description


@router.get("/trips")
async def list_trips(
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
) -> list[TripPlanView]:
    """Every Trip the traveler is planning, the most recently started first.

    One read serves both the page listing them and the switcher that moves a
    Conversation between them.
    """
    return [TripPlanView.of(plan) for plan in await read_plans(session, traveler)]


@router.delete("/trips/{trip_id}", status_code=204)
async def delete_trip(
    trip_id: uuid.UUID,
    conversations: OnDeletingTrip = "keep",
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
) -> Response:
    """Remove a Trip and its Trip Plan, for good.

    The Itinerary Items and Open Questions are the plan, so they go unasked.
    The Conversations are not, so the interface asks and the answer arrives
    here — `keep` unless they said otherwise, the irreversible reading of an
    ambiguous request being the wrong default.

    Kept, they are listed under no Trip and the advisor starts a fresh one the
    moment it records something about a journey again.
    """
    trip = await _trip(session, traveler, trip_id)
    await trips.remove_trip(session, trip, with_conversations=conversations == "delete")
    return Response(status_code=204)


@router.patch("/trips/{trip_id}")
async def change_plan(
    trip_id: uuid.UUID,
    patch: PlanPatch,
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
) -> TripPlanView:
    """Change the fields of a Trip Plan the traveler named, and only those."""
    trip = await _trip(session, traveler, trip_id)
    await trips.patch_trip(session, trip, patch.model_dump(exclude_unset=True))
    return await _plan(session, trip)


@router.post("/trips/{trip_id}/itinerary", status_code=201)
async def add_itinerary_item(
    trip_id: uuid.UUID,
    adding: NewItineraryItem,
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
) -> TripPlanView:
    """Put something of the traveler's own into a day of the Trip."""
    trip = await _trip(session, traveler, trip_id)
    await trips.add_itinerary_item(
        session,
        trip,
        day=adding.day,
        part_of_day=None if adding.part_of_day is None else PartOfDay(adding.part_of_day),
        description=adding.description,
    )
    return await _plan(session, trip)


@router.patch("/trips/{trip_id}/itinerary/{item_id}")
async def change_itinerary_item(
    trip_id: uuid.UUID,
    item_id: uuid.UUID,
    patch: ItineraryItemPatch,
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
) -> TripPlanView:
    trip = await _trip(session, traveler, trip_id)
    item = await trips.item_by_id(session, trip, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="No such Itinerary Item.")
    await trips.patch_itinerary_item(session, item, {"description": patch.description})
    return await _plan(session, trip)


@router.delete("/trips/{trip_id}/itinerary/{item_id}")
async def remove_itinerary_item(
    trip_id: uuid.UUID,
    item_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
) -> TripPlanView:
    trip = await _trip(session, traveler, trip_id)
    item = await trips.item_by_id(session, trip, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="No such Itinerary Item.")
    await trips.remove(session, item)
    return await _plan(session, trip)


@router.delete("/trips/{trip_id}/questions/{question_id}")
async def settle_open_question(
    trip_id: uuid.UUID,
    question_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
) -> TripPlanView:
    """Take a question off the plan because the traveler has decided it."""
    trip = await _trip(session, traveler, trip_id)
    question = await trips.question_by_id(session, trip, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="No such Open Question.")
    await trips.remove(session, question)
    return await _plan(session, trip)


async def _trip(session: AsyncSession, traveler: Traveler, trip_id: uuid.UUID) -> Trip:
    """The named Trip, or a refusal the interface can act on."""
    trip = await trips.find_trip(session, traveler, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="No such Trip.")
    return trip


async def _plan(session: AsyncSession, trip: Trip) -> TripPlanView:
    return TripPlanView.of(await read_plan(session, trip))
