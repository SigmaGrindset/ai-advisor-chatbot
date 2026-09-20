"""Compaction: the older stretch of a Conversation, folded into a summary.

Replaces the oldest Messages in the *prompt* with a running summary of them,
so a Conversation returned to for weeks does not send every word every turn.
It never touches the Conversation itself: the transcript is whole and nothing
in the interface says this happened (CONTEXT.md).

A token budget rather than a Message count, because Messages differ in size —
a reply reporting back a page the advisor read is worth twenty short ones.

Nothing here touches the database; `services/compaction.py` writes the summary
down and composes the turn from it.
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

#: Near enough for prose. A real count would mean a tokeniser per model, and
#: all this has to be right about is *when* a Conversation has grown long.
CHARS_PER_TOKEN = 4

#: What each Message costs beyond its words — role and wire framing. Small, but
#: a long run of short exchanges is mostly framing.
TOKENS_PER_MESSAGE = 4

#: Past this, the oldest verbatim Messages are folded away. Well under any
#: model's context window: the point is staying quick and cheap for weeks, not
#: being rescued just before the prompt would have failed.
TRANSCRIPT_BUDGET = 6000

#: How much of the recent end survives. Lower than the budget, so crossing it
#: folds a stretch worth summarising and then leaves several turns alone rather
#: than summarising every turn. Above the 8000-character bound on one traveler
#: Message, which is never folded and would otherwise be unbringable under.
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

    Zero while the stretch fits. Otherwise enough of the oldest to come back
    under `KEPT_VERBATIM`, never including the last — so a Conversation of one
    enormous Message folds nothing and goes out over budget, there being
    nothing in it but what the traveler is waiting on a reply to.
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

    Written by the utility model, this being exactly the small unseen work it
    is configured for. None when the call disappoints, and the caller then
    folds nothing: a prompt briefly too long is a smaller failure than a
    Conversation whose middle has been folded into an empty summary.
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
    # A failed Message is folded away with the rest but contributes nothing:
    # it is half a sentence nobody finished. The same rule `advisor/prompt.py`
    # keeps, so a long Conversation cannot smuggle it back in via the summary.
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
