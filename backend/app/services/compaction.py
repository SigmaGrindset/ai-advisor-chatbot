"""Compaction applied: what a turn is sent, once the Conversation is long.

`advisor/compaction.py` decides how much to fold and writes the summary; this
reads the Conversation, asks for that, records the answer, and hands back the
Messages still sent whole.

It runs before the prompt is composed rather than after the reply goes out, so
a Conversation over the budget never sends the long prompt even once. Nothing
it does is visible: the Messages stay, and no event says it happened.
"""

from collections.abc import Sequence

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor import compaction
from ..config import Settings
from ..db.conversations import fold_into_summary, messages_in
from ..db.tables import Conversation, Message


async def compact(
    session: AsyncSession,
    conversation: Conversation,
    model: AsyncOpenAI,
    settings: Settings,
) -> Sequence[Message]:
    """The Messages of this Conversation to send verbatim, folding if need be.

    What comes back is the recent end; what was folded is in the rolling
    summary the system prompt is composed from afterwards.

    A failed summarising call folds nothing and answers with the whole
    stretch: a turn dearer than it should be beats an advisor missing the
    middle of the conversation it is in.
    """
    said = await messages_in(session, conversation)
    sending = said[conversation.summarised_messages :]

    folding = compaction.how_many_to_fold(sending)
    if folding == 0:
        return sending

    summary = await compaction.summarise(
        model,
        model_name=settings.utility_model,
        earlier=conversation.summary,
        folding=sending[:folding],
    )
    if summary is None:
        return sending

    await fold_into_summary(
        session,
        conversation,
        summary=summary,
        summarised=conversation.summarised_messages + folding,
    )
    return sending[folding:]
