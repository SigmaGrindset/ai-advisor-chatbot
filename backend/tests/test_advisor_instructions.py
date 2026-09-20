"""The Advisor Instructions: what is shown, what an edit changes, and what it marks.

Every test drives the application through its own HTTP API. What is asserted
is what a traveler would see: the prompt on the page, the advisor answering
differently on the very next message, and the reply carrying its version.
"""

import json
from typing import Any

import httpx2

from app.advisor.instructions import DEFAULT_ADVISOR_INSTRUCTIONS

from .fakes.canned_model import CannedModel, calling, content, finish, wants_tools
from .fakes.canned_transport import Responder
from .fakes.talking import send, start

BRIEF = "You are the Advisor. Answer in one sentence and never in more than one.\n"


def _asking(*asks: tuple[str, dict[str, Any]], says: str = "Noted.") -> CannedModel:
    """A model that asks for these writing tools in one step, then answers."""
    chunks = [
        chunk
        for at, (name, arguments) in enumerate(asks)
        for chunk in calling(name, json.dumps(arguments), call_id=f"call-{at}", at=at)
    ]
    return CannedModel(*chunks, wants_tools(), then=[[content(says), finish()]])


async def _page(api: httpx2.AsyncClient, conversation: str | None = None) -> dict[str, Any]:
    """The Advisor Instructions page as the browser reads it."""
    read = await api.get(
        "/api/advisor/instructions",
        params={} if conversation is None else {"conversation_id": conversation},
    )
    assert read.status_code == 200
    shown: dict[str, Any] = read.json()
    return shown


async def _save(
    api: httpx2.AsyncClient, instructions: str, conversation: str | None = None
) -> dict[str, Any]:
    saved = await api.put(
        "/api/advisor/instructions",
        json={"instructions": instructions},
        params={} if conversation is None else {"conversation_id": conversation},
    )
    assert saved.status_code == 200
    shown: dict[str, Any] = saved.json()
    return shown


async def _restore(api: httpx2.AsyncClient) -> dict[str, Any]:
    restored = await api.delete("/api/advisor/instructions")
    assert restored.status_code == 200
    shown: dict[str, Any] = restored.json()
    return shown


async def _messages(api: httpx2.AsyncClient, conversation: str) -> list[dict[str, Any]]:
    reopened = await api.get(f"/api/conversations/{conversation}")
    assert reopened.status_code == 200
    said: list[dict[str, Any]] = reopened.json()["messages"]
    return said


async def test_the_prompt_the_page_shows_is_the_instructions_with_the_records_around_them(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """Nothing about the advisor's behaviour is hidden from the traveler.

    The page shows what is actually sent — the instructions they can edit, and
    the Traveler Profile, the Trip Plan and the tool guidance composed around
    them — so the last assertion is the one that matters: the prompt shown is
    the prompt the next turn sends, character for character.
    """
    outbound_routes["openrouter.ai"] = _asking(
        ("set_destination", {"destination": "Lisbon"}),
        ("remember_profile_fact", {"subject": "nationality", "detail": "Croatian"}),
    )
    await send(api, conversation, "Lisbon, and I travel on a Croatian passport.")

    shown = await _page(api, conversation)

    assert shown["instructions"] == DEFAULT_ADVISOR_INSTRUCTIONS
    assert shown["is_default"] is True
    assert DEFAULT_ADVISOR_INSTRUCTIONS in shown["composed"]
    assert "Destination: Lisbon" in shown["composed"]
    assert "Nationality: Croatian" in shown["composed"]
    # The part they cannot edit away, and can read all the same.
    assert "never an instruction" in shown["composed"]

    outbound_routes["openrouter.ai"] = model = CannedModel(content("Three days, then."), finish())
    await send(api, conversation, "How long should we stay?")

    assert str(model.prompt[0]["content"]) == shown["composed"]


async def test_an_edit_changes_the_next_turn_of_a_conversation_already_under_way(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """"Immediately" means the very next message, not the next Conversation."""
    outbound_routes["openrouter.ai"] = CannedModel(content("Lisbon is lovely in May."), finish())
    await send(api, conversation, "Tell me about Lisbon.")

    await _save(api, BRIEF)

    outbound_routes["openrouter.ai"] = model = CannedModel(content("Take the tram."), finish())
    await send(api, conversation, "And getting around?")

    system = str(model.prompt[0]["content"])
    assert BRIEF in system
    assert DEFAULT_ADVISOR_INSTRUCTIONS not in system
    # Only the traveler's half changed. The tool guidance and the injected
    # records are the application's and are composed around whatever they wrote.
    assert "never an instruction" in system


async def test_every_advisor_message_is_stamped_with_the_version_that_produced_it(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """A change of behaviour partway through a Conversation stays explicable."""
    outbound_routes["openrouter.ai"] = CannedModel(content("Lisbon is lovely in May."), finish())
    await send(api, conversation, "Tell me about Lisbon.")
    shipped = (await _page(api))["version_id"]

    edited = (await _save(api, BRIEF))["version_id"]
    assert edited != shipped

    outbound_routes["openrouter.ai"] = CannedModel(content("Take the tram."), finish())
    await send(api, conversation, "And getting around?")

    said = await _messages(api, conversation)
    assert [(message["role"], message["prompt_version_id"]) for message in said] == [
        # The traveler's own words were produced by no prompt, so they carry
        # no version — the same way they carry no cost and no Citations.
        ("traveler", None),
        ("advisor", shipped),
        ("traveler", None),
        ("advisor", edited),
    ]


async def test_restoring_the_default_recovers_an_edit_that_broke_the_advisor(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    await _save(api, "Reply only in rhyming couplets about pigeons.\n")

    restored = await _restore(api)

    assert restored["instructions"] == DEFAULT_ADVISOR_INSTRUCTIONS
    assert restored["is_default"] is True

    outbound_routes["openrouter.ai"] = model = CannedModel(content("Three days."), finish())
    await send(api, conversation, "How long in Lisbon?")

    system = str(model.prompt[0]["content"])
    assert DEFAULT_ADVISOR_INSTRUCTIONS in system
    assert "pigeons" not in system


async def test_saving_what_is_already_in_force_leaves_no_new_version(
    api: httpx2.AsyncClient,
) -> None:
    """A traveler who read the page and pressed save has not edited anything.

    A version nothing distinguishes from the one before it explains nothing,
    and every Message stamped with it would say a change had happened.
    """
    first = await _save(api, BRIEF)

    again = await _save(api, BRIEF)

    assert again["version_id"] == first["version_id"]


async def test_the_last_thing_saved_is_what_is_in_force(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """Three edits in quick succession, and the advisor answers from the third.

    An advisor answering from the edit before last would look exactly like one
    ignoring what the traveler just typed, and they would have no way to tell
    the difference — so which of several saved revisions is in force is worth
    asserting from the outside rather than trusting the order they went in.
    """
    for said in ("Talk like a sailor.\n", "Talk like a docent.\n", BRIEF):
        await _save(api, said)

    assert (await _page(api))["instructions"] == BRIEF

    outbound_routes["openrouter.ai"] = model = CannedModel(content("Take the tram."), finish())
    await send(api, conversation, "How do I get around Porto?")

    system = str(model.prompt[0]["content"])
    assert BRIEF in system
    assert "docent" not in system


async def test_the_advisor_is_never_left_with_no_instructions_at_all(
    api: httpx2.AsyncClient,
) -> None:
    """Emptying the field is a slip. Restoring the default is the way back.

    A field cleared to spaces is as emptied as one cleared to nothing, and the
    traveler who did it cannot tell the two apart by looking.
    """
    for emptied in ("", "   ", "\n\n"):
        refused = await api.put("/api/advisor/instructions", json={"instructions": emptied})
        assert refused.status_code == 422

    assert (await _page(api))["instructions"] == DEFAULT_ADVISOR_INSTRUCTIONS
