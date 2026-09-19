"""Compaction: the older stretch of a Conversation, folded into a summary.

A traveler who comes back to the same Conversation for weeks would otherwise
have every word of it sent again on every turn — slower, dearer, and eventually
too long to send at all. Compaction replaces the oldest Messages in the *prompt*
with a running summary of them. It never touches the Conversation: the
transcript the traveler scrolls back through is whole, and nothing in the
interface says any of this happened (CONTEXT.md).

What decides it is a token budget rather than a Message count, because Messages
are not the same size as each other — a reply that reports back a page the
advisor read is worth twenty short ones, and a count would send it again every
turn while cheerfully folding away the exchange that mattered.

Nothing here touches the database. It is handed what was said and answers with
how much of it to fold; `services/compaction.py` is what writes the summary down
and what the turn is then composed from.
"""

from collections.abc import Sequence
from math import ceil

from openai import AsyncOpenAI
from openai.types.chat import (
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)

from ..db.tables import Message, MessageRole
from .utility import ask

#: How many characters of English stand for a token, near enough. Counting for
#: real would mean a tokeniser per model, and a tokeniser that disagreed with
#: whichever provider OpenRouter routed to that day; what this number has to be
#: right about is only *when* a Conversation has grown long, and four is the
#: usual approximation for prose.
CHARS_PER_TOKEN = 4

#: What each Message costs beyond its own words — the role and the framing the
#: wire format puts around it. Small, but a long run of short exchanges is
#: mostly framing.
TOKENS_PER_MESSAGE = 4

#: When the Messages still being sent verbatim come to more than this, the
#: oldest of them are folded away. Deliberately well under any model's context
#: window: the point is a Conversation that stays quick and cheap for weeks,
#: not one that is rescued at the last moment before it would have failed.
TRANSCRIPT_BUDGET = 6000

#: How much of the recent end is left verbatim when that happens. Lower than
#: the budget on purpose, so that crossing it folds a stretch worth summarising
#: and then leaves the next several turns alone, rather than paying for a
#: summarising call on every turn from here on. Above what a single traveler
#: Message can run to — `api/conversations.py` bounds one at 8000 characters —
#: because the Message they have just sent is the one thing that is never folded
#: away, so a budget below it would be one nothing could bring the prompt under.
KEPT_VERBATIM = 2000

_SUMMARISING_INSTRUCTION = """\
You keep the running summary of a conversation between a traveler and their travel
advisor. The advisor can no longer be sent the whole conversation, so the earliest part of
it is being replaced by what you write.

You will be shown the summary so far, where there is one, and the stretch of conversation
now being folded into it. Reply with the single summary that replaces both.

Keep everything the advisor would be lost without: what the traveler is planning, what
they decided and what they ruled out, what they said about themselves, what was looked up
and what it turned out to be, and any question left hanging. Keep the concrete details —
places, dates, figures, names — rather than reporting that they were discussed.

Write it as plain prose about the traveler and the advisor, in at most two hundred words.
Reply with the summary alone: no heading, no preamble, nothing else.
"""


def how_many_to_fold(said: Sequence[Message]) -> int:
    """How many of these Messages, oldest first, are to be folded away.

    Zero while the stretch still fits, which is every turn of almost every
    Conversation. Once it does not, enough of the oldest to bring what is left
    back under `KEPT_VERBATIM` — and never the last Message, which is what the
    traveler has just this moment said. So a Conversation of one enormous
    Message folds nothing and goes out over budget, which is the right answer to
    the only question there is: there is nothing in it but the thing they are
    waiting on a reply to.
    """
    remaining = sum(_tokens(message) for message in said)
    if remaining <= TRANSCRIPT_BUDGET:
        return 0
    folding = 0
    while folding < len(said) - 1 and remaining > KEPT_VERBATIM:
        remaining -= _tokens(said[folding])
        folding += 1
    return folding


async def summarise(
    model: AsyncOpenAI,
    *,
    model_name: str,
    earlier: str | None,
    folding: Sequence[Message],
) -> str | None:
    """The summary that stands in for `earlier` and `folding` together.

    The utility model writes it, because it is exactly the kind of small, unseen
    work the cheaper model is configured for. None when the call disappoints in
    any way, and the caller's answer to that is to fold nothing this turn: a
    Conversation that is briefly too long to send cheaply is a far smaller
    failure than one the advisor has lost the middle of — and folding Messages
    into an empty summary would be losing them just as surely.
    """
    return await ask(
        model,
        model_name=model_name,
        messages=_summarising_prompt(earlier, folding),
        about="Summarising the Conversation",
    )


def describe(summary: str | None) -> str:
    """The rolling summary as the advisor is shown it, above what is sent whole."""
    if summary is None:
        return "This conversation is short enough to be sent to you whole."
    return (
        "Earlier in this conversation, before the messages below. This is a summary "
        "rather than what was said, because the conversation grew too long to send you "
        "whole; the traveler can still read every word of it, and none of this is "
        "something to mention to them or to apologise for:\n"
        f"{summary}"
    )


def _summarising_prompt(
    earlier: str | None, folding: Sequence[Message]
) -> list[ChatCompletionMessageParam]:
    # A Message whose turn failed is folded away with the rest and contributes
    # nothing to what the summary says. It is half a sentence nobody finished,
    # and a summary is a record of what was said — this is the same rule
    # `advisor/prompt.py` keeps for what is still sent verbatim, kept here so
    # that a Conversation growing long does not smuggle the half-sentence back
    # in through the summary.
    said = "\n\n".join(
        f"{_who(message)}: {message.content}" for message in folding if message.failure is None
    )
    so_far = "The summary so far:\n" + earlier if earlier else "There is no summary yet."
    return [
        ChatCompletionSystemMessageParam(role="system", content=_SUMMARISING_INSTRUCTION),
        ChatCompletionUserMessageParam(
            role="user",
            content=f"{so_far}\n\nThe stretch now being folded into it:\n\n{said}",
        ),
    ]


def _tokens(message: Message) -> int:
    return ceil(len(message.content) / CHARS_PER_TOKEN) + TOKENS_PER_MESSAGE


def _who(message: Message) -> str:
    return "Traveler" if message.role is MessageRole.TRAVELER else "Advisor"
