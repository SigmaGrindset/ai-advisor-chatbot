"""A Conversation that has gone on for weeks.

Everything here is driven through the API the way the browser drives it, and
what is asserted is what a traveler would notice: that a long Conversation goes
on working, that scrolling back through it still shows every word they said, and
that nothing anywhere mentions any of this. What the advisor is told about the
*other* Conversations the traveler has going is in `test_many_conversations.py`,
beside the rest of what keeping several of them apart means.

The budget is crossed by saying long things rather than by reaching in and
lowering it. What that costs is three messages instead of one; what it buys is
a test that fails if `TRANSCRIPT_BUDGET` is ever raised past what a real
Conversation reaches.
"""

from typing import Any

import httpx2

from .fakes.canned_model import CannedModel, answering, replying, unwell
from .fakes.canned_transport import Responder
from .fakes.talking import send, transcript

#: A traveler who says a great deal, within the limit a Message is bounded by.
ASKED = "Tell me everything about Lisbon in April. " * 188
#: An advisor who answers at the length a reply reporting back a read page runs to.
ANSWERED = "April in Lisbon is mild and bright, and Sintra is worth a day. " * 32

SUMMARY = "They have settled on four days in Lisbon in April, and want Sintra in them."


def _system(prompt: list[dict[str, Any]]) -> str:
    """The system prompt of a turn the canned model was sent."""
    return str(prompt[0]["content"])


def _said(prompt: list[dict[str, Any]]) -> str:
    """The Conversation part of a turn the canned model was sent."""
    return "".join(str(part["content"]) for part in prompt[1:])


def _summarising(model: CannedModel) -> list[dict[str, Any]]:
    """The utility calls that were Compaction's, rather than the naming ones."""
    return [
        call for call in model.utility_calls if "running summary" in str(call["messages"])
    ]


async def test_crossing_the_budget_shrinks_the_prompt_and_not_the_transcript(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """The Conversation the advisor is sent shrinks; the traveler's own does not."""
    outbound_routes["openrouter.ai"] = model = replying(ANSWERED, utility=answering(SUMMARY))

    await send(api, conversation, ASKED)
    await send(api, conversation, ASKED)
    growing = _said(model.prompt)
    events = await send(api, conversation, ASKED)
    compacted = _said(model.prompt)

    assert len(compacted) < len(growing)
    # What the traveler has just this moment said is never folded away.
    assert compacted == ASKED

    # And none of it happened to them. Six Messages are still there to scroll
    # back through, whole, and the turn that folded four of them away said
    # nothing about it on its way past.
    exchange = [("traveler", ASKED), ("advisor", ANSWERED)]
    assert await transcript(api, conversation) == exchange * 3
    assert {event["type"] for event in events} == {
        "traveler_message",
        "fragment",
        "advisor_message",
    }


async def test_the_rolling_summary_stands_in_for_what_was_folded_away(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """What the advisor is no longer sent, it is told."""
    outbound_routes["openrouter.ai"] = model = replying(ANSWERED, utility=answering(SUMMARY))

    await send(api, conversation, ASKED)
    await send(api, conversation, ASKED)
    assert SUMMARY not in _system(model.prompt)

    await send(api, conversation, ASKED)
    assert SUMMARY in _system(model.prompt)

    # And it is still there on the turn after, which is what "rolling" means:
    # the Conversation carries it rather than the turn that wrote it.
    await send(api, conversation, "So, Sintra?")
    assert SUMMARY in _system(model.prompt)


async def test_the_summary_is_written_by_the_utility_model_from_what_is_being_folded(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    outbound_routes["openrouter.ai"] = model = replying(ANSWERED, utility=answering(SUMMARY))

    await send(api, conversation, ASKED)
    await send(api, conversation, ASKED)
    await send(api, conversation, ASKED)

    summarising = _summarising(model)
    assert len(summarising) == 1
    assert summarising[0]["model"] == "anthropic/claude-haiku-4.5"
    shown = " ".join(message["content"] for message in summarising[0]["messages"])
    assert ASKED in shown
    assert ANSWERED in shown


async def test_a_summary_that_could_not_be_written_folds_nothing_away(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """A dearer turn than it should be beats an advisor missing the middle of it."""
    outbound_routes["openrouter.ai"] = model = replying(ANSWERED, utility=unwell())

    await send(api, conversation, ASKED)
    await send(api, conversation, ASKED)
    await send(api, conversation, ASKED)

    assert [part["role"] for part in model.prompt] == [
        "system",
        "user",
        "assistant",
        "user",
        "assistant",
        "user",
    ]
