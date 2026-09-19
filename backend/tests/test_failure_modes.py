"""What the application says when it cannot answer, and what it leaves behind.

Every path in here is one somebody running this for the first time will meet:
no key, a key the provider will not take, an account with nothing left in it,
and a reply that stops halfway. What they are owed each time is a sentence
saying whose problem it is, their question still on the screen, and a way to
ask it again that does not leave the question there twice.

A Live-data Tool that is down is the one failure that is *not* in here, because
it is not a failure of the turn: `test_live_data_tools.py` drives a source that
never answers and asserts the turn finishes normally with the advisor explaining
it.
"""

import logging

import httpx2
import pytest

from app.config import Settings
from app.services import turns

from .conftest import ApiFactory
from .fakes.canned_model import (
    CannedModel,
    calling,
    content,
    finish,
    gives_up,
    refusing,
    replying,
    searching,
    usage,
    wants_tools,
)
from .fakes.canned_transport import Responder
from .fakes.talking import again, messages, send, start, transcript


async def test_without_a_key_the_turn_is_refused_and_names_the_setting(
    api: httpx2.AsyncClient, api_for: ApiFactory, settings: Settings
) -> None:
    # Started through the configured application, because starting a Conversation
    # needs no model — only saying something in one does.
    conversation = await start(api)
    keyless = await api_for(settings.model_copy(update={"openrouter_api_key": None}))

    refusal = await keyless.post(
        f"/api/conversations/{conversation}/messages", json={"content": "Lisbon?"}
    )

    assert refusal.status_code == 503
    refused = refusal.json()["detail"]
    assert refused["kind"] == "configuration"
    assert "OPENROUTER_API_KEY" in refused["detail"]
    # Nothing is kept, so the question is still theirs to send once the key is there.
    assert await transcript(api, conversation) == []


async def test_a_key_the_provider_will_not_take_is_a_configuration_problem(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = refusing(401)

    events = await send(api, conversation, "What is Lisbon like in April?")

    failed = events[-1]
    assert failed["type"] == "failed"
    assert failed["kind"] == "configuration"
    assert "OPENROUTER_API_KEY" in failed["detail"]


async def test_an_exhausted_balance_says_so_rather_than_failing_generically(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = refusing(402)

    events = await send(api, conversation, "What is Lisbon like in April?")

    failed = events[-1]
    assert failed["kind"] == "credit"
    assert "credit" in failed["detail"]


async def test_a_provider_having_a_bad_day_is_nobodys_configuration(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = refusing(503)

    events = await send(api, conversation, "What is Lisbon like in April?")

    assert events[-1]["kind"] == "upstream"


async def test_a_stream_that_dies_mid_answer_keeps_the_half_that_arrived(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = CannedModel(
        content("April in Lisbon is mild, and "), gives_up()
    )

    events = await send(api, conversation, "What is Lisbon like in April?")

    assert events[-1]["type"] == "failed"
    assert events[-1]["message"]["content"] == "April in Lisbon is mild, and "
    # And it is all still there after a reload, which is the whole point of
    # recording it rather than leaving it in the browser's memory.
    said = await messages(api, conversation)
    assert [(message["role"], message["content"]) for message in said] == [
        ("traveler", "What is Lisbon like in April?"),
        ("advisor", "April in Lisbon is mild, and "),
    ]
    assert said[-1]["failure"]["kind"] == "upstream"


async def test_a_failure_that_arrives_mid_stream_is_read_as_precisely_as_one_that_refuses(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    # The account runs out while the answer is being written: a 200 that is
    # still arriving, carrying the provider's code in the body instead.
    outbound_routes["openrouter.ai"] = CannedModel(content("April in Lisbon "), gives_up(402))

    events = await send(api, conversation, "What is Lisbon like in April?")

    assert events[-1]["kind"] == "credit"


async def test_a_failed_turn_is_run_again_rather_than_asked_again(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = CannedModel(content("April in Lisbon is "), gives_up())
    await send(api, conversation, "What is Lisbon like in April?")
    failed = (await messages(api, conversation))[-1]

    outbound_routes["openrouter.ai"] = model = replying("April in Lisbon is mild and bright.")
    events = await again(api, conversation, failed["id"])

    # The question is not said a second time, on the wire or in the transcript.
    assert [event["type"] for event in events if event["type"] == "traveler_message"] == []
    assert await transcript(api, conversation) == [
        ("traveler", "What is Lisbon like in April?"),
        ("advisor", "April in Lisbon is mild and bright."),
    ]
    assert model.prompt[-1] == {"role": "user", "content": "What is Lisbon like in April?"}


async def test_only_the_last_turn_of_a_conversation_can_be_run_again(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = CannedModel(content("April in Lisbon is "), gives_up())
    await send(api, conversation, "What is Lisbon like in April?")
    failed = (await messages(api, conversation))[-1]

    outbound_routes["openrouter.ai"] = replying("Four days, with Sintra.")
    await send(api, conversation, "How many days?")
    refusal = await api.post(
        f"/api/conversations/{conversation}/messages/{failed['id']}/again"
    )

    assert refusal.status_code == 409


async def test_a_half_written_reply_is_never_sent_back_to_the_advisor(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = CannedModel(content("April in Lisbon is "), gives_up())
    await send(api, conversation, "What is Lisbon like in April?")

    outbound_routes["openrouter.ai"] = model = replying("Four days, with Sintra.")
    await send(api, conversation, "How many days?")

    _, *exchange = model.prompt
    assert exchange == [
        {"role": "user", "content": "What is Lisbon like in April?"},
        {"role": "user", "content": "How many days?"},
    ]


async def test_a_fault_in_the_application_says_it_is_one_rather_than_blaming_the_advisor(
    monkeypatch: pytest.MonkeyPatch,
    api: httpx2.AsyncClient,
    conversation: str,
    outbound_routes: dict[str, Responder],
) -> None:
    # A bug, introduced where one could be: the turn has written something and
    # patched the plan, and then this application falls over reading the plan
    # back. Nothing a provider does produces this, which is the point of it
    # being told apart from what a provider does.
    def broken(*args: object, **kept: object) -> object:
        raise ValueError("the plan could not be read back")

    monkeypatch.setattr(turns, "plan_of", broken)
    outbound_routes["openrouter.ai"] = CannedModel(
        content("Lisbon in April, then — "),
        *calling("set_destination", '{"destination": "Lisbon"}'),
        wants_tools(),
    )

    events = await send(api, conversation, "Let us say Lisbon.")

    failed = events[-1]
    assert failed["kind"] == "application"
    assert "configuration" in failed["detail"]
    # And what it had written is still kept, the same as any other failure.
    assert failed["message"]["content"] == "Lisbon in April, then — "


async def test_the_log_holds_what_a_turn_cost_and_nothing_that_was_said(
    api: httpx2.AsyncClient,
    conversation: str,
    outbound_routes: dict[str, Responder],
    caplog: pytest.LogCaptureFixture,
) -> None:
    # A turn with everything in it that could carry words out: a question, a
    # search, what the search read, and an answer built from it.
    outbound_routes["openrouter.ai"] = CannedModel(
        *calling("web_search", '{"query": "Portugal visa for Croatian citizens"}'),
        wants_tools(),
        then=[[content("Ninety days visa-free, and mild."), finish(), usage(0.0000362)]],
        web=searching("Ninety days visa-free.", ("A consulate", "https://example.gov/visa")),
    )

    with caplog.at_level(logging.DEBUG):
        await send(api, conversation, "Can I stay in Lisbon for a month on my passport?")
        outbound_routes["openrouter.ai"] = CannedModel(content("Sorry, I was —"), gives_up())
        await send(api, conversation, "And my wife, who is Croatian?")

    logged = "\n".join(record.getMessage() for record in caplog.records)
    # What a turn cost is in there, which is the whole of what makes spend
    # readable without going and asking the provider's account endpoint.
    assert "0.0000362" in logged
    for said in (
        "Can I stay in Lisbon for a month on my passport?",
        "And my wife, who is Croatian?",
        "Ninety days visa-free",
        "Sorry, I was",
    ):
        assert said not in logged
