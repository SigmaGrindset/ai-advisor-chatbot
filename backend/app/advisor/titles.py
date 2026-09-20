"""Naming a Conversation after its first exchange.

The utility model does it, this being exactly the small unseen work it is
configured for. Never worth failing a turn over: every way the call can
disappoint ends at the traveler's own first words.
"""

from openai import AsyncOpenAI
from openai.types.chat import (
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)

from .utility import ask

#: Long enough to recognise a Conversation by, short enough to sit on one line.
MAX_TITLE = 48

_NAMING_INSTRUCTION = """\
You name conversations. You will be shown the first exchange between a traveler and their
travel advisor. Reply with a title of at most six words, naming the place and the matter
at hand where you can. Reply with the title alone: no quotation marks, no closing full
stop, nothing else.
"""


async def name_conversation(
    model: AsyncOpenAI,
    *,
    model_name: str,
    traveler_said: str,
    advisor_said: str,
) -> str | None:
    """A title for this exchange, from the utility model or the traveler's words.

    None when there is nothing to name it by: an unnamed Conversation can be
    named by its next exchange, one named the empty string could not be.
    """
    proposed = await ask(
        model,
        model_name=model_name,
        messages=_naming_prompt(traveler_said, advisor_said),
        about="Naming the Conversation",
    )
    return _tidy(proposed or "") or _shorten(traveler_said) or None


def _naming_prompt(traveler_said: str, advisor_said: str) -> list[ChatCompletionMessageParam]:
    return [
        ChatCompletionSystemMessageParam(role="system", content=_NAMING_INSTRUCTION),
        ChatCompletionUserMessageParam(
            role="user", content=f"Traveler: {traveler_said}\n\nAdvisor: {advisor_said}"
        ),
    ]


def _tidy(proposed: str) -> str:
    """What the model offered, made fit for a list rather than trusted as it came."""
    return _shorten(proposed.strip().strip("\"'").rstrip("."))


def _shorten(text: str) -> str:
    """One line, at most MAX_TITLE characters, cut at a word where there is one."""
    words = " ".join(text.split())
    if len(words) <= MAX_TITLE:
        return words
    return f"{words[:MAX_TITLE].rsplit(' ', 1)[0]}…"
