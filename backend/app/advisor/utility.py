"""Asking the utility model for one short piece of prose.

Two small jobs the traveler never sees — naming a Conversation (`titles.py`)
and writing the Compaction summary (`compaction.py`) — want the same thing of
the cheaper model: one unstreamed completion, and whatever it wrote, or
nothing.

Nothing covers both ways the call can disappoint, neither of which is worth
failing a turn over, so nothing is raised here. What to do instead is the
caller's, and the two answer it differently.

The nested web search runs on the same model but stays in `searching.py`: it
is asked for sources as much as prose, and carries its own plugin and timeout.
"""

import logging
from collections.abc import Sequence

from openai import APIError, AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

logger = logging.getLogger(__name__)


async def ask(
    model: AsyncOpenAI,
    *,
    model_name: str,
    messages: Sequence[ChatCompletionMessageParam],
    about: str,
) -> str | None:
    """What the utility model wrote, tidied of surrounding space, or None.

    `about` names the job in the log and nowhere else. Deliberately the job
    rather than the words: the log is not a second copy of the conversation.
    """
    try:
        answer = await model.chat.completions.create(model=model_name, messages=list(messages))
    except APIError as failure:
        logger.warning("%s failed: %s", about, type(failure).__name__)
        return None
    written = answer.choices[0].message.content if answer.choices else None
    return (written or "").strip() or None
