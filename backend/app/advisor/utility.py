"""Asking the utility model for one short piece of prose.

Two small jobs the traveler never sees go to the cheaper model configured beside
the conversation one — naming a Conversation after its first exchange
(`titles.py`) and writing the rolling Compaction summary (`compaction.py`) — and
both want exactly the same thing of it: one unstreamed completion, and whatever
it wrote, or nothing.

"Or nothing" covers both ways the call can disappoint, because to either caller
they are one way: a call that did not come back, and a call that came back
saying nothing. Neither is worth failing a turn over, so nothing is raised here.
What to do instead is the caller's, and the two answer it differently — a
Conversation falls back to the traveler's own first words, and Compaction folds
nothing away and tries again next turn.

The nested web search is not one of these, even though it too runs on the
utility model: it is asked for its sources as much as its prose, it carries the
web plugin and its own timeout, and a failure there becomes a tool result the
advisor explains. It stays in `searching.py`.
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
