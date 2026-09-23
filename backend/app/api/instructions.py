"""The Advisor Instructions: what the traveler may change, and what is sent.

Every answer carries both the editable instructions and the whole prompt
composed around them, because the page shows both and the second is only true
of the first.

The preview is composed by the function a turn composes with, never described
beside it: a second rendering of "what will be sent" is one that can be wrong.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor.instructions import DEFAULT_ADVISOR_INSTRUCTIONS
from ..db.connection import get_session
from ..db.conversations import find_conversation
from ..db.tables import Conversation, PromptVersion, Traveler
from ..services.instructions import (
    compose_around,
    restore_default_instructions,
    revise_instructions,
    saved_version,
)
from .asking import who_is_asking, who_is_writing

router = APIRouter(tags=["advisor"])


class AdvisorInstructionsView(BaseModel):
    """The Advisor Instructions, and the prompt they are composed into."""

    #: The editable part: the advisor's persona and its rules.
    instructions: str
    #: Recorded on every Message these produce, so a traveler asking why a
    #: reply changed has something to read. Null until the first turn or save
    #: records the shipped default.
    version_id: uuid.UUID | None
    #: The system prompt exactly as the next Message will send it.
    composed: str
    #: Whether what is in force is the shipped default.
    is_default: bool


class RevisedInstructions(BaseModel):
    """What the traveler wants their advisor told.

    Emptied entirely, the advisor would have our own guidance and no persona
    at all, which is a slip rather than an instruction. Restoring the default
    is the way back.
    """

    #: `\S` is a search rather than a match, so this means "has a non-space
    #: character": a field cleared to spaces is as emptied as one cleared.
    instructions: str = Field(min_length=1, max_length=20000, pattern=r"\S")


@router.get("/advisor/instructions")
async def read_advisor_instructions(
    conversation_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
) -> AdvisorInstructionsView:
    """The Advisor Instructions in force, and the prompt they compose into.

    Writes nothing, not even the shipped default: a Traveler who only looked
    has recorded nothing.
    """
    conversation = await _named(session, traveler, conversation_id)
    return await _shown(session, traveler, await saved_version(session, traveler), conversation)


@router.put("/advisor/instructions")
async def save_advisor_instructions(
    revised: RevisedInstructions,
    conversation_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_writing),
) -> AdvisorInstructionsView:
    """Save the Advisor Instructions as a new Prompt Version.

    In force the moment this answers: the next turn of any Conversation, even
    one begun long before the edit, composes from what is saved here.
    """
    conversation = await _named(session, traveler, conversation_id)
    return await _shown(
        session,
        traveler,
        await revise_instructions(session, traveler, revised.instructions),
        conversation,
    )


@router.delete("/advisor/instructions")
async def restore_advisor_instructions(
    conversation_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_writing),
) -> AdvisorInstructionsView:
    """Put the shipped Advisor Instructions back: the way out of an edit that
    left the advisor worse, and the reason an edit is safe to make."""
    conversation = await _named(session, traveler, conversation_id)
    return await _shown(
        session, traveler, await restore_default_instructions(session, traveler), conversation
    )


async def _named(
    session: AsyncSession, traveler: Traveler, conversation_id: uuid.UUID | None
) -> Conversation | None:
    """The Conversation the preview is composed for, if one is named.

    Found before anything is saved, so a request naming one that is not theirs
    is refused having changed nothing.
    """
    if conversation_id is None:
        return None
    conversation = await find_conversation(session, traveler, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="No such Conversation.")
    return conversation


async def _shown(
    session: AsyncSession,
    traveler: Traveler,
    version: PromptVersion | None,
    conversation: Conversation | None,
) -> AdvisorInstructionsView:
    """One Prompt Version, with the prompt it composes into right now. None is
    the shipped default, before anything has recorded it.

    The plan composed in is the named Conversation's, so the preview is what
    their next Message actually sends. With none named there is no plan, as a
    turn of a Conversation refining no Trip is sent.
    """
    instructions = DEFAULT_ADVISOR_INSTRUCTIONS if version is None else version.instructions
    return AdvisorInstructionsView(
        instructions=instructions,
        version_id=None if version is None else version.id,
        composed=await compose_around(session, traveler, conversation, instructions),
        is_default=instructions == DEFAULT_ADVISOR_INSTRUCTIONS,
    )
