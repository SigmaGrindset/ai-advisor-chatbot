"""Several Trips: listing them, and moving a Conversation between them.

The advisor decides which Trip a thread belongs to, and it can decide wrong,
so the interface has to be able to say otherwise (ADR-0002). Every test here
drives that through the API the way the browser does, and asserts on what the
traveler would see afterwards: which plan each Conversation reads back, and
what is listed.
"""

import json
from typing import Any

import httpx2

from .fakes.canned_model import CannedModel, calling, content, finish, wants_tools
from .fakes.canned_transport import Responder
from .fakes.talking import send, start


def _asking(*asks: tuple[str, dict[str, Any]], says: str = "Noted.") -> CannedModel:
    """A model that asks for these plan tools in one step, then answers."""
    chunks = [
        chunk
        for at, (name, arguments) in enumerate(asks)
        for chunk in calling(name, json.dumps(arguments), call_id=f"call-{at}", at=at)
    ]
    return CannedModel(*chunks, wants_tools(), then=[[content(says), finish()]])


async def _plan(api: httpx2.AsyncClient, conversation: str) -> dict[str, Any] | None:
    """The Trip Plan the browser reads back beside a Conversation."""
    reopened = await api.get(f"/api/conversations/{conversation}")
    assert reopened.status_code == 200
    plan: dict[str, Any] | None = reopened.json()["plan"]
    return plan


async def _trip_about(
    api: httpx2.AsyncClient,
    outbound_routes: dict[str, Responder],
    destination: str,
) -> tuple[str, str]:
    """A Conversation that has talked its way into a Trip, and that Trip."""
    conversation = await start(api)
    outbound_routes["openrouter.ai"] = _asking(("set_destination", {"destination": destination}))
    await send(api, conversation, f"We have settled on {destination}.")
    plan = await _plan(api, conversation)
    assert plan is not None
    trip_id: str = plan["trip_id"]
    return conversation, trip_id


async def _attach(api: httpx2.AsyncClient, conversation: str, trip_id: str | None) -> Any:
    response = await api.put(f"/api/conversations/{conversation}/trip", json={"trip_id": trip_id})
    assert response.status_code == 200, response.text
    return response.json()


async def test_two_conversations_attached_to_one_trip_see_the_same_trip_plan(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    """The whole point of a Trip owning the plan rather than a Conversation.

    One journey planned across two threads is one plan: what is written in
    either of them is what both of them are looking at.
    """
    first, trip = await _trip_about(api, outbound_routes, "Lisbon")
    second = await start(api)
    outbound_routes["openrouter.ai"] = _asking(
        ("set_party_size", {"party_size": 2}), says="Two of you."
    )
    await send(api, second, "Two of us are going somewhere in May.")

    # The second thread went and started a Trip of its own, which is exactly
    # the misattribution the traveler is here to correct.
    apart = await _plan(api, second)
    assert apart is not None
    assert apart["trip_id"] != trip

    await _attach(api, second, trip)

    # From here there is one plan, read from either end.
    here = await _plan(api, first)
    there = await _plan(api, second)
    assert here == there
    assert there is not None
    assert there["trip_id"] == trip
    assert there["destination"] == "Lisbon"

    # And a change made through one of them is a change to the other's plan.
    changed = await api.patch(f"/api/trips/{trip}", json={"party_size": 3})
    assert changed.status_code == 200
    refined = await _plan(api, first)
    assert refined is not None
    assert refined["party_size"] == 3
    assert refined == await _plan(api, second)


async def test_attaching_answers_with_the_plan_the_conversation_now_refines(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    """One round trip: the pane beside the Conversation has to show it at once."""
    _, trip = await _trip_about(api, outbound_routes, "Lisbon")
    second = await start(api)

    taken_on = await _attach(api, second, trip)

    assert taken_on["trip_id"] == trip
    assert taken_on["destination"] == "Lisbon"


async def test_a_conversation_moved_to_another_trip_leaves_the_first_one_as_it_was(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    lisbon_thread, lisbon = await _trip_about(api, outbound_routes, "Lisbon")
    _, oslo = await _trip_about(api, outbound_routes, "Oslo")

    moved = await _attach(api, lisbon_thread, oslo)

    assert moved["destination"] == "Oslo"
    # The Trip it came off is untouched, and is still there to go back to.
    listed = await api.get("/api/trips")
    assert {trip["trip_id"]: trip["destination"] for trip in listed.json()} == {
        lisbon: "Lisbon",
        oslo: "Oslo",
    }


async def test_a_conversation_can_be_taken_off_a_trip_without_taking_the_trip_with_it(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    """Detaching is about the thread, not about the journey."""
    conversation, trip = await _trip_about(api, outbound_routes, "Lisbon")

    detached = await _attach(api, conversation, None)

    assert detached is None
    assert await _plan(api, conversation) is None
    listed = await api.get("/api/trips")
    assert [trip["trip_id"] for trip in listed.json()] == [trip]


async def test_the_conversation_list_says_which_trip_each_thread_is_on(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    """What the chip on each row is drawn from."""
    attached, trip = await _trip_about(api, outbound_routes, "Lisbon")
    alone = await start(api)

    listed = await api.get("/api/conversations")

    assert listed.status_code == 200
    assert {row["id"]: row["trip_id"] for row in listed.json()} == {
        attached: trip,
        alone: None,
    }


async def test_every_trip_is_listed_with_what_its_plan_holds(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    """The page that lists Trips shows a summary of each, so it is sent one."""
    conversation, trip = await _trip_about(api, outbound_routes, "Lisbon")
    outbound_routes["openrouter.ai"] = _asking(
        ("set_trip_dates", {"starts_on": "2026-05-12", "ends_on": "2026-05-18"}),
        ("add_itinerary_item", {"day": 1, "description": "Alfama"}),
        ("add_open_question", {"question": "Which airport to fly into?"}),
        says="Noted.",
    )
    await send(api, conversation, "The 12th to the 18th of May.")

    listed = await api.get("/api/trips")

    assert listed.status_code == 200
    assert listed.json() == [
        {
            "trip_id": trip,
            "destination": "Lisbon",
            "starts_on": "2026-05-12",
            "ends_on": "2026-05-18",
            "party_size": None,
            "budget_amount": None,
            "budget_currency": None,
            "items": [
                {
                    "id": listed.json()[0]["items"][0]["id"],
                    "day": 1,
                    "part_of_day": None,
                    "description": "Alfama",
                }
            ],
            "questions": [
                {
                    "id": listed.json()[0]["questions"][0]["id"],
                    "question": "Which airport to fly into?",
                }
            ],
        }
    ]


async def test_the_trips_are_listed_most_recently_started_first(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    _, lisbon = await _trip_about(api, outbound_routes, "Lisbon")
    _, oslo = await _trip_about(api, outbound_routes, "Oslo")

    listed = await api.get("/api/trips")

    assert [trip["trip_id"] for trip in listed.json()] == [oslo, lisbon]


async def test_a_traveler_with_no_trips_is_told_so_rather_than_refused(
    api: httpx2.AsyncClient,
) -> None:
    listed = await api.get("/api/trips")

    assert listed.status_code == 200
    assert listed.json() == []


async def test_attaching_a_conversation_to_a_trip_that_does_not_exist_is_refused(
    api: httpx2.AsyncClient, conversation: str
) -> None:
    refused = await api.put(
        f"/api/conversations/{conversation}/trip",
        json={"trip_id": "00000000-0000-0000-0000-0000000000ff"},
    )

    assert refused.status_code == 404
    assert await _plan(api, conversation) is None


async def test_deleting_a_trip_takes_its_plan_and_leaves_its_conversations(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    kyoto, trip = await _trip_about(api, outbound_routes, "Kyoto")
    second = await start(api)
    await _attach(api, second, trip)

    deleted = await api.delete(f"/api/trips/{trip}")

    assert deleted.status_code == 204
    assert (await api.get("/api/trips")).json() == []
    # Both threads are still there, and now on no Trip at all — which is where
    # every Conversation starts.
    listed = (await api.get("/api/conversations")).json()
    assert {row["id"] for row in listed} == {kyoto, second}
    assert {row["trip_id"] for row in listed} == {None}
    assert await _plan(api, kyoto) is None


async def test_a_trip_takes_its_conversations_with_it_when_the_traveler_says_so(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    kyoto, trip = await _trip_about(api, outbound_routes, "Kyoto")
    lisbon, other = await _trip_about(api, outbound_routes, "Lisbon")

    deleted = await api.delete(f"/api/trips/{trip}?conversations=delete")

    assert deleted.status_code == 204
    assert (await api.get(f"/api/conversations/{kyoto}")).status_code == 404
    # The other journey is untouched: its plan is still listed and its thread
    # is still on it.
    assert [plan["trip_id"] for plan in (await api.get("/api/trips")).json()] == [other]
    assert (await _plan(api, lisbon) or {}).get("trip_id") == other


async def test_deleting_a_trip_that_does_not_exist_is_refused(api: httpx2.AsyncClient) -> None:
    refused = await api.delete("/api/trips/00000000-0000-0000-0000-0000000000ff")

    assert refused.status_code == 404
