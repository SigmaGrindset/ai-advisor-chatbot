"""Several Conversations: starting them, finding them, returning to them, deleting them."""

from typing import Any

import httpx2
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings

from .conftest import ApiFactory
from .fakes.canned_model import answering, replying, unwell
from .fakes.canned_transport import Responder
from .fakes.talking import send, start, transcript


async def test_a_started_conversation_appears_in_the_list(api: httpx2.AsyncClient) -> None:
    started = await api.post("/api/conversations")
    listed = await api.get("/api/conversations")

    assert started.status_code == 201
    assert [conversation["id"] for conversation in listed.json()] == [started.json()["id"]]


async def test_the_list_is_ordered_by_most_recent_activity(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = replying("Sintra is worth a day.")
    first = await start(api)
    second = await start(api)

    before = await listed(api)
    await send(api, first, "Is Sintra worth a day?")
    after = await listed(api)

    assert before == [second, first]
    assert after == [first, second]


async def test_a_reopened_conversation_continues_where_it_was_left(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    lisbon = await start(api)
    outbound_routes["openrouter.ai"] = replying("April in Lisbon is mild.")
    await send(api, lisbon, "What is Lisbon like in April?")

    oslo = await start(api)
    outbound_routes["openrouter.ai"] = replying("Oslo in April is still cold.")
    await send(api, oslo, "And Oslo?")

    outbound_routes["openrouter.ai"] = later = replying("Four days, with Sintra.")
    await send(api, lisbon, "How many days?")

    assert await transcript(api, lisbon) == [
        ("traveler", "What is Lisbon like in April?"),
        ("advisor", "April in Lisbon is mild."),
        ("traveler", "How many days?"),
        ("advisor", "Four days, with Sintra."),
    ]
    assert await transcript(api, oslo) == [
        ("traveler", "And Oslo?"),
        ("advisor", "Oslo in April is still cold."),
    ]
    # The other Conversation is not in the prompt either: keeping them apart is
    # what the traveler asked for by starting a second one.
    assert "Oslo" not in str(later.prompt)


async def test_a_conversation_that_is_not_there_is_refused_rather_than_invented(
    api: httpx2.AsyncClient,
) -> None:
    missing = "0f8d7b3e-0000-4000-8000-000000000000"

    assert (await api.get(f"/api/conversations/{missing}")).status_code == 404
    assert (
        await api.post(f"/api/conversations/{missing}/messages", json={"content": "Lisbon?"})
    ).status_code == 404


async def test_a_conversation_is_named_after_its_first_exchange_by_the_utility_model(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = model = replying(
        "April in Lisbon is mild and bright.", utility=answering("Three days in Lisbon")
    )

    events = await send(api, conversation, "What is Lisbon like in April?")

    assert await titles(api) == ["Three days in Lisbon"]
    # Named last, so that a naming call the traveler is not waiting on cannot hold
    # up the reply they are.
    assert [event["type"] for event in events][-2:] == ["advisor_message", "conversation_titled"]
    assert events[-1]["title"] == "Three days in Lisbon"

    naming = model.utility_calls[-1]
    assert naming["model"] == "anthropic/claude-haiku-4.5"
    shown = " ".join(message["content"] for message in naming["messages"])
    assert "What is Lisbon like in April?" in shown
    assert "April in Lisbon is mild and bright." in shown


async def test_the_title_falls_back_to_the_travelers_own_words_when_naming_fails(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = replying(
        "April in Lisbon is mild and bright.", utility=unwell()
    )

    await send(
        api,
        conversation,
        "What is Lisbon like in April, and is three days enough to see it properly?",
    )

    assert await titles(api) == ["What is Lisbon like in April, and is three days…"]
    # The turn itself is untouched by a naming that did not work.
    assert await transcript(api, conversation) == [
        (
            "traveler",
            "What is Lisbon like in April, and is three days enough to see it properly?",
        ),
        ("advisor", "April in Lisbon is mild and bright."),
    ]


async def test_a_short_first_message_is_the_fallback_title_whole(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = replying("It is mild.", utility=unwell())

    await send(api, conversation, "Lisbon in April?")

    assert await titles(api) == ["Lisbon in April?"]


async def test_an_exchange_with_nothing_to_name_it_by_leaves_it_unnamed(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """A title of the empty string would be a name nobody could read.

    Left unnamed, the Conversation can still be named by its next exchange; named
    the empty string, it never could be, and the list would show a blank row.
    """
    outbound_routes["openrouter.ai"] = replying(
        "I am not sure what you mean.", utility=answering(" ")
    )

    events = await send(api, conversation, "   ")

    assert await titles(api) == [None]
    assert [event["type"] for event in events if event["type"] == "conversation_titled"] == []


async def test_a_conversation_is_named_once_and_not_renamed_by_later_turns(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = model = replying(
        "April is mild.", utility=answering("Three days in Lisbon")
    )
    await send(api, conversation, "What is Lisbon like in April?")
    await send(api, conversation, "How many days?")

    assert await titles(api) == ["Three days in Lisbon"]
    assert len(model.utility_calls) == 1


async def test_the_utility_model_is_named_by_the_environment(
    monkeypatch: pytest.MonkeyPatch,
    api_for: ApiFactory,
    settings: Settings,
    outbound_routes: dict[str, Responder],
) -> None:
    monkeypatch.setenv("UTILITY_MODEL", "a/utility-model")
    api = await api_for(
        Settings(
            database_url=settings.database_url,
            openrouter_api_key=settings.openrouter_api_key,
            static_dir=settings.static_dir,
        )
    )
    outbound_routes["openrouter.ai"] = model = replying("April is mild.")

    await send(api, await start(api), "What is Lisbon like in April?")

    assert model.utility_calls[-1]["model"] == "a/utility-model"


async def test_deleting_a_conversation_removes_its_messages(
    api: httpx2.AsyncClient,
    conversation: str,
    session: AsyncSession,
    outbound_routes: dict[str, Responder],
) -> None:
    """Counted in the database, unlike every other test here.

    Deletion means there are no rows left, and rows the API can no longer reach
    are exactly what a soft delete would leave behind. There is nothing to ask the
    API that would tell the two apart, so this one test looks.
    """
    outbound_routes["openrouter.ai"] = replying("April in Lisbon is mild.")
    await send(api, conversation, "What is Lisbon like in April?")
    # Asserted before deleting, so that finding nothing afterwards means something.
    assert await rows(session, "conversation") == 1
    assert await rows(session, "message") == 2

    deleted = await api.delete(f"/api/conversations/{conversation}")

    assert deleted.status_code == 204
    assert await rows(session, "conversation") == 0
    assert await rows(session, "message") == 0
    assert (await api.get(f"/api/conversations/{conversation}")).status_code == 404


async def test_deleting_one_conversation_leaves_the_others_where_they_were(
    api: httpx2.AsyncClient, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = replying("April in Lisbon is mild.")
    lisbon = await start(api)
    await send(api, lisbon, "What is Lisbon like in April?")
    oslo = await start(api)
    outbound_routes["openrouter.ai"] = replying("Oslo is still cold.")
    await send(api, oslo, "And Oslo?")

    await api.delete(f"/api/conversations/{oslo}")

    assert await listed(api) == [lisbon]
    assert await transcript(api, lisbon) == [
        ("traveler", "What is Lisbon like in April?"),
        ("advisor", "April in Lisbon is mild."),
    ]


async def test_deleting_a_conversation_twice_is_refused_the_second_time(
    api: httpx2.AsyncClient, conversation: str
) -> None:
    assert (await api.delete(f"/api/conversations/{conversation}")).status_code == 204
    assert (await api.delete(f"/api/conversations/{conversation}")).status_code == 404


async def conversations(api: httpx2.AsyncClient) -> list[dict[str, Any]]:
    """The traveler's Conversations, as the browser reads them for the list."""
    response = await api.get("/api/conversations")
    assert response.status_code == 200
    listing: list[dict[str, Any]] = response.json()
    return listing


async def listed(api: httpx2.AsyncClient) -> list[str]:
    """The identifiers of the traveler's Conversations, in the order listed."""
    return [conversation["id"] for conversation in await conversations(api)]


async def titles(api: httpx2.AsyncClient) -> list[str | None]:
    """The titles of the traveler's Conversations, in the order listed."""
    return [conversation["title"] for conversation in await conversations(api)]


async def rows(session: AsyncSession, table: str) -> int:
    counted = await session.scalar(text(f"select count(*) from {table}"))
    return int(counted or 0)
