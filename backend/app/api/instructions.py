"""The Advisor Instructions: what the traveler may change, and what is sent.

Every answer here carries both — the editable instructions, and the whole
system prompt composed around them — because the page shows both and the
second is only true of the first. Saving answers with the composed prompt for
the same reason the Trip Plan routes answer with the whole plan: the traveler
is looking at what they just changed, and a second request to find out what it
says now is a round trip for something this one already knew.

The preview is composed by the function a turn composes with, never described
beside it. A second rendering of "what will be sent" is a thing that can be
wrong, and the whole point of the page is that nothing about the advisor's
behaviour is hidden.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor.instructions import DEFAULT_ADVISOR_INSTRUCTIONS
from ..db.connection import get_session
from ..db.conversations import find_conversation
from ..db.tables import PromptVersion
from ..services.instructions import (
    compose_around,
    current_version,
    restore_default_instructions,
    revise_instructions,
)

router = APIRouter(tags=["advisor"])


class AdvisorInstructionsView(BaseModel):
    """The Advisor Instructions, and the prompt they are composed into."""

    #: The editable part: the advisor's persona and its rules.
    instructions: str
    #: The Prompt Version these instructions are. Every Message they produce
    #: records it, so it is what a traveler asking why a reply changed reads.
    version_id: uuid.UUID
    #: The system prompt exactly as the next Message will send it — these
    #: instructions with the tool guidance, the Trip Plan and the Traveler
    #: Profile composed around them.
    composed: str
    #: Whether what is in force is the shipped default, which is the whole of
    #: what the interface needs to know to offer restoring it or not.
    is_default: bool


class RevisedInstructions(BaseModel):
    """What the traveler wants their advisor told.

    Bounded at both ends: emptied entirely, the advisor would be left with the
    application's own guidance and no persona at all, which is a slip rather
    than an instruction. Restoring the default is the way back.
    """

    #: `\S` is a search rather than a match, so this is "has a character in it
    #: that is not whitespace": a field cleared to spaces is as emptied as one
    #: cleared to nothing, and the interface says so before it is sent.
    instructions: str = Field(min_length=1, max_length=20000, pattern=r"\S")


@router.get("/advisor/instructions")
async def read_advisor_instructions(
    conversation_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_session),
) -> AdvisorInstructionsView:
    """The Advisor Instructions in force, and the prompt they compose into."""
    return await _shown(session, await current_version(session), conversation_id)


@router.put("/advisor/instructions")
async def save_advisor_instructions(
    revised: RevisedInstructions,
    conversation_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_session),
) -> AdvisorInstructionsView:
    """Save the Advisor Instructions as a new Prompt Version.

    It is in force the moment this answers: the next turn of any Conversation,
    including one begun long before the edit, composes from what is saved here
    rather than from anything it was started with.
    """
    return await _shown(
        session, await revise_instructions(session, revised.instructions), conversation_id
    )


@router.delete("/advisor/instructions")
async def restore_advisor_instructions(
    conversation_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_session),
) -> AdvisorInstructionsView:
    """Put the shipped Advisor Instructions back.

    The way out of an edit that left the advisor worse than it shipped, and
    the reason an edit is safe to make. What comes back is the whole page
    again, because that is what the traveler is looking at.
    """
    return await _shown(session, await restore_default_instructions(session), conversation_id)


async def _shown(
    session: AsyncSession, version: PromptVersion, conversation_id: uuid.UUID | None
) -> AdvisorInstructionsView:
    """One Prompt Version, with the prompt it composes into right now.

    The Trip Plan composed in is the named Conversation's, because that is the
    prompt this traveler's next Message actually sends — the page is opened
    from a Conversation and says which one it came from. With none named there
    is no plan, which is what a turn of a Conversation refining no Trip is
    sent too.
    """
    conversation = None
    if conversation_id is not None:
        conversation = await find_conversation(session, conversation_id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="No such Conversation.")
    return AdvisorInstructionsView(
        instructions=version.instructions,
        version_id=version.id,
        composed=await compose_around(session, conversation, version.instructions),
        is_default=version.instructions == DEFAULT_ADVISOR_INSTRUCTIONS,
    )
