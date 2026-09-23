"""The Trip Plan: the advisor patching it, and the traveler editing it.

Every test drives a whole turn or a whole request through the API, the way the
browser does. What is asserted is what a traveler would see: the plan that
comes back beside the Conversation, what the pane is told to highlight, and
what is still there afterwards.
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
    """The Trip Plan as the browser reads it back when it opens a Conversation."""
    reopened = await api.get(f"/api/conversations/{conversation}")
    assert reopened.status_code == 200
    plan: dict[str, Any] | None = reopened.json()["plan"]
    return plan


def _revisions(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every time the turn told the browser the plan had moved."""
    return [event for event in events if event["type"] == "plan_revised"]


async def test_the_first_patch_starts_a_trip_and_the_plan_arrives_with_the_conversation(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """There is no create-a-Trip gesture: recording the first thing is the gesture."""
    assert await _plan(api, conversation) is None

    outbound_routes["openrouter.ai"] = _asking(("set_destination", {"destination": "Lisbon"}))
    await send(api, conversation, "We have settled on Lisbon.")

    plan = await _plan(api, conversation)
    assert plan is not None
    assert plan["destination"] == "Lisbon"
    assert plan["trip_id"] is not None


async def test_a_field_level_patch_leaves_every_other_field_as_it_was(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """The whole reason the plan is rows rather than a document.

    The traveler changes one field by hand, then the advisor patches another.
    Nothing else moves, including the field they just typed, which a
    whole-document write would have read back stale and put straight back.
    """
    outbound_routes["openrouter.ai"] = _asking(
        ("set_destination", {"destination": "Lisbon"}),
        ("set_trip_dates", {"starts_on": "2026-05-12", "ends_on": "2026-05-18"}),
        ("set_party_size", {"party_size": 2}),
        ("set_budget", {"amount": 2400, "currency": "EUR"}),
        ("add_itinerary_item", {"day": 1, "part_of_day": "morning", "description": "Alfama"}),
        ("add_open_question", {"question": "Which airport to fly into?"}),
    )
    await send(api, conversation, "Lisbon, 12th to 18th of May, two of us, about 2400 euros.")

    filled = await _plan(api, conversation)
    assert filled is not None
    trip = filled["trip_id"]

    # The traveler corrects the party size themselves, between two turns.
    by_hand = await api.patch(f"/api/trips/{trip}", json={"party_size": 3})
    assert by_hand.status_code == 200

    # And the advisor then patches something else entirely.
    outbound_routes["openrouter.ai"] = _asking(
        ("set_destination", {"destination": "Porto"}), says="Porto it is."
    )
    await send(api, conversation, "Actually, make it Porto.")

    after = await _plan(api, conversation)
    assert after is not None
    assert after["destination"] == "Porto"
    # Everything the second turn did not name, exactly as it was — the
    # traveler's own edit included.
    assert after["party_size"] == 3
    assert after["starts_on"] == "2026-05-12"
    assert after["ends_on"] == "2026-05-18"
    assert after["budget_amount"] == 2400.0
    assert after["budget_currency"] == "EUR"
    assert [item["description"] for item in after["items"]] == ["Alfama"]
    assert [asked["question"] for asked in after["questions"]] == ["Which airport to fly into?"]


async def test_itinerary_items_and_open_questions_are_records_of_their_own(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """Each entry is addressable, so removing one leaves the rest untouched."""
    outbound_routes["openrouter.ai"] = _asking(
        ("add_itinerary_item", {"day": 1, "part_of_day": "morning", "description": "Alfama"}),
        ("add_itinerary_item", {"day": 1, "part_of_day": "evening", "description": "Fado"}),
        ("add_itinerary_item", {"day": 2, "description": "Belém"}),
    )
    await send(api, conversation, "Sketch me two days.")

    plan = await _plan(api, conversation)
    assert plan is not None
    # In the order the days run, and the morning before the evening within one.
    assert [(item["day"], item["description"]) for item in plan["items"]] == [
        (1, "Alfama"),
        (1, "Fado"),
        (2, "Belém"),
    ]

    # The advisor takes the second one off by the number it was listed under.
    outbound_routes["openrouter.ai"] = _asking(
        ("remove_itinerary_item", {"item": 2}), says="Fado is off."
    )
    await send(api, conversation, "Drop the fado.")

    after = await _plan(api, conversation)
    assert after is not None
    assert [item["description"] for item in after["items"]] == ["Alfama", "Belém"]
    # And the two that stayed are the same records, not rewritten copies.
    assert [item["id"] for item in after["items"]] == [
        plan["items"][0]["id"],
        plan["items"][2]["id"],
    ]


async def test_the_browser_is_told_what_moved_as_it_moves(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """What drives the highlight beside the conversation."""
    outbound_routes["openrouter.ai"] = _asking(
        ("set_destination", {"destination": "Lisbon"}),
        ("set_budget", {"amount": 2400, "currency": "EUR"}),
    )

    events = await send(api, conversation, "Lisbon, about 2400 euros.")

    revisions = _revisions(events)
    assert [revision["changed"] for revision in revisions] == [
        ["destination"],
        ["budget_amount", "budget_currency"],
    ]
    # Each carries the plan as it stood at that moment, so the pane never has
    # to ask for it.
    assert revisions[0]["plan"]["destination"] == "Lisbon"
    assert revisions[0]["plan"]["budget_amount"] is None
    assert revisions[-1]["plan"]["budget_amount"] == 2400.0


async def test_a_patch_that_changes_nothing_is_not_reported_as_a_change(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """A field lighting up for a change that was not one sends them hunting."""
    outbound_routes["openrouter.ai"] = _asking(("set_destination", {"destination": "Lisbon"}))
    await send(api, conversation, "Lisbon.")

    outbound_routes["openrouter.ai"] = model = _asking(
        ("set_destination", {"destination": "Lisbon"}), says="It already says Lisbon."
    )
    events = await send(api, conversation, "Lisbon, I said.")

    assert _revisions(events) == []
    (told,) = [
        message["content"]
        for message in model.turns[1]["messages"]
        if message["role"] == "tool"
    ]
    assert "already said so" in told


async def test_a_conversation_joins_a_trip_the_traveler_is_already_planning(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """Two threads, one plan — which is why the Trip owns it."""
    outbound_routes["openrouter.ai"] = _asking(("set_destination", {"destination": "Lisbon"}))
    await send(api, conversation, "Lisbon in May.")
    first = await _plan(api, conversation)
    assert first is not None

    second = await start(api)
    outbound_routes["openrouter.ai"] = _asking(
        ("join_trip", {"trip_id": first["trip_id"]}),
        ("add_itinerary_item", {"day": 1, "description": "Alfama"}),
        says="Same trip, then.",
    )
    events = await send(api, second, "Back to the Lisbon trip — what about the first day?")

    # Joining revises the whole plan and highlights none of it: what the pane
    # was showing was a different Trip's, or nothing at all.
    assert _revisions(events)[0]["changed"] == []

    joined = await _plan(api, second)
    assert joined is not None
    assert joined["trip_id"] == first["trip_id"]
    assert joined["destination"] == "Lisbon"
    # And the first Conversation is looking at the item the second one added.
    refined = await _plan(api, conversation)
    assert refined is not None
    assert [item["description"] for item in refined["items"]] == ["Alfama"]


async def test_the_advisor_is_shown_the_plan_and_the_trips_it_could_join(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = _asking(
        ("set_destination", {"destination": "Lisbon"}),
        ("add_open_question", {"question": "Which airport to fly into?"}),
    )
    await send(api, conversation, "Lisbon in May.")

    outbound_routes["openrouter.ai"] = model = CannedModel(content("Faro, probably."), finish())
    await send(api, conversation, "So which airport?")

    system = str(model.prompt[0]["content"])
    assert "Destination: Lisbon" in system
    assert "[1] Which airport to fly into?" in system
    # The Trip is listed for `join_trip` by the identifier that tool takes.
    plan = await _plan(api, conversation)
    assert plan is not None
    assert plan["trip_id"] in system


async def test_the_traveler_edits_the_plan_by_hand(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """Adding and removing Itinerary Items, and clearing a field they emptied."""
    outbound_routes["openrouter.ai"] = _asking(
        ("set_destination", {"destination": "Lisbon"}),
        ("set_party_size", {"party_size": 2}),
        ("add_open_question", {"question": "Which airport to fly into?"}),
    )
    await send(api, conversation, "Lisbon, two of us.")
    plan = await _plan(api, conversation)
    assert plan is not None
    trip = plan["trip_id"]

    added = await api.post(
        f"/api/trips/{trip}/itinerary", json={"day": 1, "description": "Time-out market"}
    )
    assert added.status_code == 201
    (mine,) = added.json()["items"]
    assert mine["description"] == "Time-out market"
    assert mine["part_of_day"] is None

    edited = await api.patch(
        f"/api/trips/{trip}/itinerary/{mine['id']}", json={"description": "Time Out Market"}
    )
    assert [item["description"] for item in edited.json()["items"]] == ["Time Out Market"]
    assert edited.json()["party_size"] == 2

    # A field named as null is a field the traveler emptied, which is not the
    # same as a field they did not mention.
    cleared = await api.patch(f"/api/trips/{trip}", json={"party_size": None})
    assert cleared.json()["party_size"] is None
    assert cleared.json()["destination"] == "Lisbon"

    settled = await api.delete(f"/api/trips/{trip}/questions/{plan['questions'][0]['id']}")
    assert settled.json()["questions"] == []

    removed = await api.delete(f"/api/trips/{trip}/itinerary/{mine['id']}")
    assert removed.json()["items"] == []


async def test_deleting_a_conversation_leaves_the_trip_plan_where_it_was(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """Deleting one of several threads must not gut the trip being planned."""
    outbound_routes["openrouter.ai"] = _asking(("set_destination", {"destination": "Lisbon"}))
    await send(api, conversation, "Lisbon in May.")
    plan = await _plan(api, conversation)
    assert plan is not None

    second = await start(api)
    outbound_routes["openrouter.ai"] = _asking(
        ("join_trip", {"trip_id": plan["trip_id"]}), says="Same trip."
    )
    await send(api, second, "The Lisbon trip again.")

    assert (await api.delete(f"/api/conversations/{conversation}")).status_code == 204

    survived = await _plan(api, second)
    assert survived is not None
    assert survived["trip_id"] == plan["trip_id"]
    assert survived["destination"] == "Lisbon"


async def test_a_plan_tool_the_advisor_got_wrong_is_explained_rather_than_applied(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = model = _asking(
        ("set_trip_dates", {"starts_on": "2026-05-18", "ends_on": "2026-05-12"}),
        ("set_party_size", {"party_size": 0}),
        ("remove_itinerary_item", {"item": 7}),
        says="Let me check those dates with you.",
    )
    events = await send(api, conversation, "The 18th to the 12th, none of us.")

    told = "\n".join(
        str(message["content"])
        for message in model.turns[1]["messages"]
        if message["role"] == "tool"
    )
    assert "cannot end before it starts" in told
    assert "whole number of people" in told
    assert "nothing on it to take off" in told
    # Nothing was written, so no Trip was started either.
    assert _revisions(events) == []
    assert await _plan(api, conversation) is None
