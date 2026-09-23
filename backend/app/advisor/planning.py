"""The Trip Plan tools: what the advisor calls when the trip itself changes.

A separate collection from the Live-data Tools next door, which fetch and
never write. Separate catalogues down separate branches of the loop is what
makes it structurally impossible for a fetch to cause a write (ADR-0004).

Every tool here patches one field or one entry. There is no whole-document
write, so an edit the traveler made by
hand between two turns is not read back and written over by the next one.

Nothing here touches the database — a call is read into a typed change, and
`services/plans.py` knows how to apply one.
"""

import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Protocol

from openai.types.chat import ChatCompletionToolParam

from .calls import Tool, Unusable, read_call, words, whole

#: A destination is a place, an itinerary line is a line, a question a question.
MAX_DESTINATION = 120
MAX_DESCRIPTION = 200
MAX_QUESTION = 200

#: What a party and an itinerary may run to. Not a rule about travel — a bound,
#: so a model that has misread a number cannot ask for the thousandth day.
MAX_PARTY = 50
MAX_DAY = 60

#: Roughly when in a day something happens, as the advisor may say it.
PARTS_OF_DAY = ("morning", "afternoon", "evening")


# ---- What the advisor can ask for ----------------------------------------- #


@dataclass(frozen=True, slots=True)
class JoinTrip:
    """Attach this Conversation to a Trip the traveler already has."""

    trip_id: uuid.UUID


@dataclass(frozen=True, slots=True)
class SetDestination:
    destination: str


@dataclass(frozen=True, slots=True)
class SetTripDates:
    """Either end of the date range, and only the ends that were given."""

    starts_on: date | None
    ends_on: date | None


@dataclass(frozen=True, slots=True)
class SetPartySize:
    party_size: int


@dataclass(frozen=True, slots=True)
class SetBudget:
    amount: Decimal
    #: ISO 4217, upper case.
    currency: str


@dataclass(frozen=True, slots=True)
class AddItineraryItem:
    day: int
    part_of_day: str | None
    description: str


@dataclass(frozen=True, slots=True)
class RemoveItineraryItem:
    #: The item's number within its Trip, as the plan in the prompt shows it.
    item: int


@dataclass(frozen=True, slots=True)
class AddOpenQuestion:
    question: str


@dataclass(frozen=True, slots=True)
class SettleOpenQuestion:
    question: int


#: A change to the plan itself. Every one of these starts a Trip for a
#: Conversation that has none, because a plan is what a Trip is.
PlanEdit = (
    SetDestination
    | SetTripDates
    | SetPartySize
    | SetBudget
    | AddItineraryItem
    | RemoveItineraryItem
    | AddOpenQuestion
    | SettleOpenQuestion
)

#: One thing the advisor can ask for, read out of a tool call. Joining is not
#: a plan edit and is kept apart from them: it changes which plan this
#: Conversation is keeping rather than anything in one.
PlanChange = JoinTrip | PlanEdit


@dataclass(frozen=True, slots=True)
class Changed:
    """What became of a change: what the advisor is told, and what moved."""

    #: The tool result, in our own voice. *Not* wrapped in untrusted markers:
    #: this is our account of a write we performed, not something somebody on
    #: the internet said.
    told: str
    #: What the traveler sees highlighted, named the way the interface names
    #: it: a scalar by its own name, a collection entry by its identifier.
    fields: Sequence[str] = ()
    #: Whether the plan on screen is now out of date. True whenever anything
    #: was written, including a join, which highlights nothing. False for a
    #: change refused, and for one the plan already satisfied.
    revised: bool = False


class Plan(Protocol):
    """Whatever can actually apply a change to the Trip Plan.

    Implemented above this layer, where the database is, so the loop can be
    handed one without `advisor/` learning what a session is.
    """

    async def change(self, asked: PlanChange) -> Changed: ...


# ---- The plan as the advisor is shown it ---------------------------------- #


@dataclass(frozen=True, slots=True)
class Item:
    """One Itinerary Item, as the prompt and the interface are shown it."""

    #: What the interface addresses it by. The advisor never sees this one.
    id: uuid.UUID
    #: Its number within the Trip, which is how the advisor refers to it.
    ref: int
    day: int
    part_of_day: str | None
    description: str


@dataclass(frozen=True, slots=True)
class Question:
    id: uuid.UUID
    ref: int
    question: str


@dataclass(frozen=True, slots=True)
class TripPlan:
    """A whole Trip Plan, read out of storage and ready to be shown or sent."""

    trip_id: uuid.UUID
    destination: str | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    party_size: int | None = None
    budget_amount: Decimal | None = None
    budget_currency: str | None = None
    items: Sequence[Item] = ()
    questions: Sequence[Question] = ()


@dataclass(frozen=True, slots=True)
class TripSummary:
    """A Trip as it appears in the list the advisor may join one from."""

    trip_id: uuid.UUID
    destination: str | None
    starts_on: date | None
    ends_on: date | None


# ---- The plan, in words, for the prompt ----------------------------------- #


def describe(plan: TripPlan | None) -> str:
    """The Trip Plan as the advisor is shown it at the top of a turn.

    Every entry carries the number the tools take: a plan the advisor can read
    but not point at is one it can only rewrite.
    """
    if plan is None:
        return (
            "This conversation has no Trip yet. The first change you make to the plan "
            "starts one, so there is nothing to create first."
        )
    lines = [
        "The Trip Plan for this conversation, which you keep up to date as you talk:",
        f"Destination: {plan.destination or 'not decided'}",
        f"Dates: {_when(plan)}",
        f"Party: {plan.party_size if plan.party_size is not None else 'not decided'}",
        f"Budget: {_budget(plan)}",
        "Itinerary:",
        *(_itinerary(plan.items) or ["  nothing planned into any day yet"]),
        "Open questions:",
        *(
            [f"  [{question.ref}] {question.question}" for question in plan.questions]
            or ["  none recorded yet"]
        ),
    ]
    return "\n".join(lines)


def describe_briefly(plan: TripPlan) -> str:
    """A joined Trip's plan in a line, so the advisor knows what it just took on."""
    where = plan.destination or "no destination yet"
    when = "" if plan.starts_on is None else f", from {plan.starts_on.isoformat()}"
    return (
        f"It is: {where}{when}, with {len(plan.items)} itinerary items and "
        f"{len(plan.questions)} open questions."
    )


def describe_trips(trips: Sequence[TripSummary]) -> str:
    """The Trips the advisor may join this Conversation to."""
    if not trips:
        return "The traveler has no other Trips to join this conversation to."
    listed = "\n".join(f"  {trip.trip_id} — {_summary(trip)}" for trip in trips)
    return (
        "Trips the traveler is already planning. If this conversation is plainly about "
        "one of them, call join_trip with its identifier before changing anything:\n"
        f"{listed}"
    )


def _summary(trip: TripSummary) -> str:
    where = trip.destination or "destination not decided"
    when = _between(trip.starts_on, trip.ends_on)
    return f"{where}, {when}" if when else where


def _when(plan: TripPlan) -> str:
    between = _between(plan.starts_on, plan.ends_on)
    if between == "":
        return "not decided"
    if plan.starts_on is None or plan.ends_on is None:
        return between
    nights = (plan.ends_on - plan.starts_on).days
    return f"{between} ({nights + 1} days)"


def _between(starts_on: date | None, ends_on: date | None) -> str:
    if starts_on is not None and ends_on is not None:
        return f"{starts_on.isoformat()} to {ends_on.isoformat()}"
    if starts_on is not None:
        return f"from {starts_on.isoformat()}, return not decided"
    if ends_on is not None:
        return f"back on {ends_on.isoformat()}, departure not decided"
    return ""


def _budget(plan: TripPlan) -> str:
    if plan.budget_amount is None or plan.budget_currency is None:
        return "not decided"
    return f"{plan.budget_amount} {plan.budget_currency} for the whole trip"


def _itinerary(items: Sequence[Item]) -> list[str]:
    lines: list[str] = []
    for day in sorted({item.day for item in items}):
        lines.append(f"  Day {day}")
        for item in items:
            if item.day != day:
                continue
            when = f"{item.part_of_day} — " if item.part_of_day else ""
            lines.append(f"    [{item.ref}] {when}{item.description}")
    return lines


# ---- Reading a call ------------------------------------------------------- #


#: One plan tool, as the model is offered it. The shape is shared with the
#: Traveler Profile's catalogue next door — see `calls.py`.
PlanTool = Tool[PlanChange]


def offers(name: str) -> bool:
    """Whether this call is one of ours rather than a Live-data Tool's."""
    return name in _BY_NAME


def offered() -> list[ChatCompletionToolParam]:
    """What the model is told it can change."""
    return [tool.offered() for tool in CATALOGUE]


async def change(plan: Plan, name: str, arguments: str) -> Changed:
    """Read one call and apply it, answering with what to tell the advisor.

    Never raises: bad arguments become something the advisor is told about and
    can correct, rather than something that ends the turn.
    """
    asked = read_call(_BY_NAME, name, arguments)
    if isinstance(asked, Unusable):
        return Changed(told=asked.complaint)
    return await plan.change(asked)


def _read_join_trip(given: Mapping[str, Any]) -> PlanChange | Unusable:
    asked = given.get("trip_id")
    if not isinstance(asked, str):
        return Unusable("Joining a Trip needs the identifier of one, as it is listed for you.")
    try:
        trip_id = uuid.UUID(asked.strip())
    except ValueError:
        return Unusable(
            f"{asked!r} is not one of the Trip identifiers you were shown. Use one of those "
            "exactly, or change the plan directly and a Trip will be started for you."
        )
    return JoinTrip(trip_id)


def _read_destination(given: Mapping[str, Any]) -> PlanChange | Unusable:
    destination = words(given.get("destination"), longest=MAX_DESTINATION)
    if destination is None:
        return Unusable("A destination has to be somewhere, said in a few words.")
    return SetDestination(destination)


def _read_trip_dates(given: Mapping[str, Any]) -> PlanChange | Unusable:
    starts_on = _day(given.get("starts_on"))
    ends_on = _day(given.get("ends_on"))
    if starts_on is None and ends_on is None:
        return Unusable(
            "Trip dates need at least one of starts_on and ends_on, each as a calendar "
            "date written YYYY-MM-DD."
        )
    if starts_on is not None and ends_on is not None and ends_on < starts_on:
        return Unusable("A trip cannot end before it starts. Check which date is which.")
    return SetTripDates(starts_on=starts_on, ends_on=ends_on)


def _read_party_size(given: Mapping[str, Any]) -> PlanChange | Unusable:
    party_size = whole(given.get("party_size"), least=1, most=MAX_PARTY)
    if party_size is None:
        return Unusable(f"A party size is a whole number of people, from 1 to {MAX_PARTY}.")
    return SetPartySize(party_size)


def _read_budget(given: Mapping[str, Any]) -> PlanChange | Unusable:
    amount = _money(given.get("amount"))
    currency = _currency(given.get("currency"))
    if amount is None or currency is None:
        return Unusable(
            "A budget needs an amount as a number and a three-letter ISO 4217 currency code."
        )
    return SetBudget(amount=amount, currency=currency)


def _read_add_itinerary_item(given: Mapping[str, Any]) -> PlanChange | Unusable:
    day = whole(given.get("day"), least=1, most=MAX_DAY)
    description = words(given.get("description"), longest=MAX_DESCRIPTION)
    if day is None or description is None:
        return Unusable(
            f"An itinerary item needs a day from 1 to {MAX_DAY} and a short description "
            "of what happens on it."
        )
    part_of_day = given.get("part_of_day")
    if part_of_day is not None and part_of_day not in PARTS_OF_DAY:
        return Unusable(f"A part of day is one of {', '.join(PARTS_OF_DAY)}, or left out.")
    return AddItineraryItem(day=day, part_of_day=part_of_day, description=description)


def _read_remove_itinerary_item(given: Mapping[str, Any]) -> PlanChange | Unusable:
    item = whole(given.get("item"), least=1)
    if item is None:
        return Unusable("Removing an itinerary item needs its number, as the plan lists it.")
    return RemoveItineraryItem(item)


def _read_add_open_question(given: Mapping[str, Any]) -> PlanChange | Unusable:
    question = words(given.get("question"), longest=MAX_QUESTION)
    if question is None:
        return Unusable("An open question is one short question about the trip.")
    return AddOpenQuestion(question)


def _read_settle_open_question(given: Mapping[str, Any]) -> PlanChange | Unusable:
    question = whole(given.get("question"), least=1)
    if question is None:
        return Unusable("Settling an open question needs its number, as the plan lists it.")
    return SettleOpenQuestion(question)


# ---- Reading arguments ----------------------------------------------------- #
# The ones only a plan needs. A short line of text and a whole number are
# `calls.py`'s, because the profile's tools read those too.


def _day(value: object) -> date | None:
    """A calendar date written the one way, or None."""
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None


def _money(value: object) -> Decimal | None:
    """An amount of money, never negative, kept to the cent."""
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None
    try:
        amount = Decimal(str(value).strip())
    except InvalidOperation:
        return None
    if not amount.is_finite() or amount < 0:
        return None
    return amount.quantize(Decimal("0.01"))


def _currency(value: object) -> str | None:
    """A three-letter ISO 4217 code and nothing else, ever."""
    if not isinstance(value, str):
        return None
    code = value.strip().upper()
    return code if len(code) == 3 and code.isalpha() and code.isascii() else None


CATALOGUE: Sequence[PlanTool] = (
    PlanTool(
        name="join_trip",
        description=(
            "Attach this conversation to a Trip the traveler is already planning, from "
            "the list of their Trips you were shown. Call this when what they are talking "
            "about is plainly one of those journeys rather than a new one. Do not call it "
            "to start a Trip — changing the plan starts one by itself."
        ),
        arguments={
            "type": "object",
            "properties": {
                "trip_id": {
                    "type": "string",
                    "description": "The identifier of the Trip, exactly as it was listed.",
                },
            },
            "required": ["trip_id"],
            "additionalProperties": False,
        },
        read=_read_join_trip,
    ),
    PlanTool(
        name="set_destination",
        description=(
            "Record where this trip is going. Call it as soon as the traveler has settled "
            "on somewhere, and again if they change their mind."
        ),
        arguments={
            "type": "object",
            "properties": {
                "destination": {
                    "type": "string",
                    "maxLength": MAX_DESTINATION,
                    "description": "Where they are going, as they would say it: 'Lisbon'.",
                },
            },
            "required": ["destination"],
            "additionalProperties": False,
        },
        read=_read_destination,
    ),
    PlanTool(
        name="set_trip_dates",
        description=(
            "Record when the trip runs. Pass whichever end they have settled; the other "
            "is left as it is, so a traveler who knows only when they fly out keeps what "
            "was already recorded for their return."
        ),
        arguments={
            "type": "object",
            "properties": {
                "starts_on": {
                    "type": "string",
                    "format": "date",
                    "description": "The first day of the trip, written YYYY-MM-DD.",
                },
                "ends_on": {
                    "type": "string",
                    "format": "date",
                    "description": "The last day of the trip, written YYYY-MM-DD.",
                },
            },
            "additionalProperties": False,
        },
        read=_read_trip_dates,
    ),
    PlanTool(
        name="set_party_size",
        description="Record how many people are travelling, the traveler included.",
        arguments={
            "type": "object",
            "properties": {
                "party_size": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_PARTY,
                    "description": "How many people are going.",
                },
            },
            "required": ["party_size"],
            "additionalProperties": False,
        },
        read=_read_party_size,
    ),
    PlanTool(
        name="set_budget",
        description=(
            "Record what the whole trip is meant to cost. Use the currency the traveler "
            "said it in rather than converting it for them."
        ),
        arguments={
            "type": "object",
            "properties": {
                "amount": {
                    "type": "number",
                    "minimum": 0,
                    "description": "The budget for the whole trip, for the whole party.",
                },
                "currency": {
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 3,
                    "pattern": "^[A-Za-z]{3}$",
                    "description": "ISO 4217 code of the currency it is said in, e.g. EUR.",
                },
            },
            "required": ["amount", "currency"],
            "additionalProperties": False,
        },
        read=_read_budget,
    ),
    PlanTool(
        name="add_itinerary_item",
        description=(
            "Add one thing to a day of the trip. One item is one thing — three suggestions "
            "for a morning are three calls, so the traveler can remove the one they do not "
            "want. Days are numbered from 1, so an item moves with the trip if the dates "
            "change."
        ),
        arguments={
            "type": "object",
            "properties": {
                "day": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_DAY,
                    "description": "Which day of the trip, counting the first day as 1.",
                },
                "part_of_day": {
                    "type": "string",
                    "enum": list(PARTS_OF_DAY),
                    "description": "Roughly when in the day. Leave it out if it does not matter.",
                },
                "description": {
                    "type": "string",
                    "maxLength": MAX_DESCRIPTION,
                    "description": "What happens, in a line: 'Walk Alfama and take tram 28'.",
                },
            },
            "required": ["day", "description"],
            "additionalProperties": False,
        },
        read=_read_add_itinerary_item,
    ),
    PlanTool(
        name="remove_itinerary_item",
        description=(
            "Take one thing off the itinerary, by the number the plan lists it under. Call "
            "this when the traveler has ruled something out, never to tidy up after "
            "yourself."
        ),
        arguments={
            "type": "object",
            "properties": {
                "item": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "The item's number, as the plan you were shown lists it.",
                },
            },
            "required": ["item"],
            "additionalProperties": False,
        },
        read=_read_remove_itinerary_item,
    ),
    PlanTool(
        name="add_open_question",
        description=(
            "Record something the plan still needs decided. These are what you drive the "
            "conversation towards, and the traveler can click one to ask about it, so "
            "write each as a question about their trip rather than a note to yourself."
        ),
        arguments={
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "maxLength": MAX_QUESTION,
                    "description": "The question, in a line: 'Which airport to fly into?'",
                },
            },
            "required": ["question"],
            "additionalProperties": False,
        },
        read=_read_add_open_question,
    ),
    PlanTool(
        name="settle_open_question",
        description=(
            "Take a question off the list, by the number the plan lists it under, once the "
            "traveler has decided it. Record what they decided with the tool that holds it."
        ),
        arguments={
            "type": "object",
            "properties": {
                "question": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "The question's number, as the plan you were shown lists it.",
                },
            },
            "required": ["question"],
            "additionalProperties": False,
        },
        read=_read_settle_open_question,
    ),
)

_BY_NAME = {tool.name: tool for tool in CATALOGUE}
