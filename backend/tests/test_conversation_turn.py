"""One turn of a Conversation: a Message goes out, a reply streams back, both last."""

import json
from typing import Any

import httpx2
import pytest

from app.config import Settings
from app.instructions import DEFAULT_ADVISOR_INSTRUCTIONS

from .canned_model import KEEP_ALIVE, CannedModel, content, finish, replying
from .canned_transport import Responder
from .conftest import ApiFactory


async def send(api: httpx2.AsyncClient, said: str) -> list[dict[str, Any]]:
    """Say something to the advisor and read back the stream, event by event."""
    events: list[dict[str, Any]] = []
    async with api.stream(
        "POST", "/api/conversation/messages", json={"content": said}
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line.removeprefix("data: ")))
    return events


async def test_both_messages_are_still_there_after_a_reload(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = replying("April in Lisbon is mild and bright.")

    await send(api, "What is Lisbon like in April?")
    reloaded = await api.get("/api/conversation")

    assert [
        (message["role"], message["content"]) for message in reloaded.json()["messages"]
    ] == [
        ("traveler", "What is Lisbon like in April?"),
        ("advisor", "April in Lisbon is mild and bright."),
    ]


async def test_the_reply_reaches_the_browser_in_pieces_as_it_is_written(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = replying("April ", "in Lisbon ", "is mild.")

    events = await send(api, "What is Lisbon like in April?")

    assert [event["type"] for event in events] == [
        "traveler_message",
        "fragment",
        "fragment",
        "fragment",
        "advisor_message",
    ]
    assert [event["text"] for event in events if event["type"] == "fragment"] == [
        "April ",
        "in Lisbon ",
        "is mild.",
    ]
    assert events[-1]["message"]["content"] == "April in Lisbon is mild."


async def test_a_reply_arriving_as_fragments_across_chunks_is_stored_whole(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    sentence = "Three days is enough for Lisbon, four if you want a day in Sintra."
    fragments = [sentence[at : at + 7] for at in range(0, len(sentence), 7)]
    outbound_routes["openrouter.ai"] = CannedModel(
        *(content(fragment) for fragment in fragments),
        finish(),
        # Cut the stream where the network would cut it — mid-line, rather than
        # conveniently between events.
        split_every=13,
    )

    await send(api, "Is three days enough for Lisbon?")
    reloaded = await api.get("/api/conversation")

    assert reloaded.json()["messages"][1]["content"] == sentence


async def test_upstream_keep_alive_lines_never_reach_the_traveler(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = CannedModel(
        KEEP_ALIVE,
        KEEP_ALIVE,
        content("Sintra is worth a day."),
        KEEP_ALIVE,
        finish(),
    )

    events = await send(api, "Is Sintra worth a day?")
    reloaded = await api.get("/api/conversation")

    assert [event["text"] for event in events if event["type"] == "fragment"] == [
        "Sintra is worth a day."
    ]
    assert reloaded.json()["messages"][1]["content"] == "Sintra is worth a day."


async def test_what_the_turn_cost_is_taken_from_the_final_chunk_and_kept(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = replying("Lisbon it is.", cost=0.0000362)

    await send(api, "Lisbon, then?")
    reloaded = await api.get("/api/conversation")

    traveler, advisor = reloaded.json()["messages"]
    assert advisor["cost_usd"] == 0.0000362
    assert traveler["cost_usd"] is None


async def test_the_advisor_is_sent_its_instructions_and_the_conversation_so_far(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    model = replying("April is mild.")
    outbound_routes["openrouter.ai"] = model
    await send(api, "What is Lisbon like in April?")

    outbound_routes["openrouter.ai"] = later = replying("Four, with Sintra.")
    await send(api, "How many days?")

    system, *exchange = later.prompt
    assert system["role"] == "system"
    assert DEFAULT_ADVISOR_INSTRUCTIONS in system["content"]
    assert exchange == [
        {"role": "user", "content": "What is Lisbon like in April?"},
        {"role": "assistant", "content": "April is mild."},
        {"role": "user", "content": "How many days?"},
    ]
    assert model.sent["model"] == "anthropic/claude-sonnet-5"
    assert model.sent["stream"] is True


async def test_the_conversation_model_is_named_by_the_environment(
    monkeypatch: pytest.MonkeyPatch,
    api_for: ApiFactory,
    settings: Settings,
    outbound_routes: dict[str, Responder],
) -> None:
    monkeypatch.setenv("CONVERSATION_MODEL", "a/conversation-model")
    configured = Settings(
        database_url=settings.database_url,
        openrouter_api_key=settings.openrouter_api_key,
        static_dir=settings.static_dir,
    )
    api = await api_for(configured)
    outbound_routes["openrouter.ai"] = model = replying("Cheaply said.")

    await send(api, "Anything at all.")

    assert model.sent["model"] == "a/conversation-model"


def test_the_utility_model_is_named_by_the_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Deliberately not driven through the API, unlike every other test here.

    Nothing consumes the utility model until Conversation titles need it, so
    there is no behaviour to observe yet — only that the variable is read under
    the name the documentation gives it.
    """
    monkeypatch.setenv("UTILITY_MODEL", "a/utility-model")

    assert Settings().utility_model == "a/utility-model"


async def test_without_a_key_the_turn_is_refused_and_nothing_is_kept(
    api_for: ApiFactory, settings: Settings
) -> None:
    api = await api_for(settings.model_copy(update={"openrouter_api_key": None}))

    refusal = await api.post("/api/conversation/messages", json={"content": "Lisbon?"})
    reloaded = await api.get("/api/conversation")

    assert refusal.status_code == 503
    assert reloaded.json()["messages"] == []


async def test_a_turn_that_fails_says_so_and_keeps_what_the_traveler_said(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = lambda request: httpx2.Response(
        500, json={"error": {"message": "upstream is unwell"}}
    )

    events = await send(api, "What is Lisbon like in April?")
    reloaded = await api.get("/api/conversation")

    assert events[-1]["type"] == "failed"
    assert [message["role"] for message in reloaded.json()["messages"]] == ["traveler"]
