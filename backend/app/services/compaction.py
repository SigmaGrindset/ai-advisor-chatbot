"""Compaction applied: what a turn is sent, once the Conversation is long.

`advisor/compaction.py` decides how much of a stretch to fold and writes the
summary that replaces it; this is what reads the Conversation, asks for that,
records the answer, and hands back the Messages that are still sent whole.

It runs at the top of every turn, before the prompt is composed, rather than
after the reply has gone out. A Conversation that has crossed the budget then
never sends the long prompt even once — which is the point of the budget, and
would not be true of folding the transcript away afterwards.

Nothing it does is visible. The Messages stay where they are, the traveler
scrolls back through all of them, and no event says any of this happened.
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
    """The Messages of this Conversation to send verbatim, folding first if need be.

    What comes back is the recent end of the transcript; whatever was folded
    away is in the Conversation's rolling summary, which the system prompt is
    composed from afterwards.

    A summarising call that fails folds nothing and answers with the whole
    stretch. The turn is then dearer than it should be and works perfectly,
    which is the right way round: the alternative is an advisor missing the
    middle of a conversation it is in.
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
