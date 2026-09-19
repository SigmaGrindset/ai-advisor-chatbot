"""One turn of a Conversation: a Message goes out, a reply streams back, both last."""

import httpx2
import pytest

from app.advisor.instructions import DEFAULT_ADVISOR_INSTRUCTIONS
from app.config import Settings

from .conftest import ApiFactory
from .fakes.canned_model import KEEP_ALIVE, CannedModel, content, finish, replying
from .fakes.canned_transport import Responder
from .fakes.talking import send, start, transcript


async def test_both_messages_are_still_there_after_a_reload(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = replying("April in Lisbon is mild and bright.")

    await send(api, conversation, "What is Lisbon like in April?")

    assert await transcript(api, conversation) == [
        ("traveler", "What is Lisbon like in April?"),
        ("advisor", "April in Lisbon is mild and bright."),
    ]


async def test_the_reply_reaches_the_browser_in_pieces_as_it_is_written(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = replying("April ", "in Lisbon ", "is mild.")

    events = await send(api, conversation, "What is Lisbon like in April?")
    reply = [event for event in events if event["type"] in {"fragment", "advisor_message"}]

    assert events[0]["type"] == "traveler_message"
    assert [event["text"] for event in reply if event["type"] == "fragment"] == [
        "April ",
        "in Lisbon ",
        "is mild.",
    ]
    assert reply[-1]["message"]["content"] == "April in Lisbon is mild."


async def test_a_reply_arriving_as_fragments_across_chunks_is_stored_whole(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
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

    await send(api, conversation, "Is three days enough for Lisbon?")

    assert await transcript(api, conversation) == [
        ("traveler", "Is three days enough for Lisbon?"),
        ("advisor", sentence),
    ]


async def test_upstream_keep_alive_lines_never_reach_the_traveler(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = CannedModel(
        KEEP_ALIVE,
        KEEP_ALIVE,
        content("Sintra is worth a day."),
        KEEP_ALIVE,
        finish(),
    )

    events = await send(api, conversation, "Is Sintra worth a day?")

    assert [event["text"] for event in events if event["type"] == "fragment"] == [
        "Sintra is worth a day."
    ]
    assert await transcript(api, conversation) == [
        ("traveler", "Is Sintra worth a day?"),
        ("advisor", "Sintra is worth a day."),
    ]


async def test_what_the_turn_cost_is_taken_from_the_final_chunk_and_kept(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = replying("Lisbon it is.", cost=0.0000362)

    await send(api, conversation, "Lisbon, then?")
    reopened = await api.get(f"/api/conversations/{conversation}")

    traveler, advisor = reopened.json()["messages"]
    assert advisor["cost_usd"] == 0.0000362
    assert traveler["cost_usd"] is None


async def test_the_advisor_is_sent_its_instructions_and_the_conversation_so_far(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    model = replying("April is mild.")
    outbound_routes["openrouter.ai"] = model
    await send(api, conversation, "What is Lisbon like in April?")

    outbound_routes["openrouter.ai"] = later = replying("Four, with Sintra.")
    await send(api, conversation, "How many days?")

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

    await send(api, await start(api), "Anything at all.")

    assert model.sent["model"] == "a/conversation-model"
