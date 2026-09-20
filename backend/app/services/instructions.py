"""The Advisor Instructions in force, and the prompt composed around them.

The rows are `db/prompt_versions.py`'s and the shipped words are
`advisor/instructions.py`'s. This is the one place that knows what happens
between them: that the default is what is in force until the traveler saves
something of their own, that saving the same words again is not a revision,
that restoring the default is a revision like any other — and what the
injected records are that the instructions are composed around.

Nothing here reads a turn or writes a Message. What a Message does with the
version it was produced by is `services/turns.py`'s.
"""

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor.conversations import OtherConversation
from ..advisor.instructions import DEFAULT_ADVISOR_INSTRUCTIONS, compose_system_prompt
from ..db import prompt_versions
from ..db.conversations import conversations_apart_from
from ..db.tables import Conversation, PromptVersion
from .plans import plan_of, summarise_trips
from .profile import read_profile


async def current_version(session: AsyncSession) -> PromptVersion:
    """The Prompt Version every turn is composed from until it is edited.

    A traveler who has never opened the Advisor Instructions page has saved
    nothing, so the first turn saves the shipped default as the first version.
    Saved rather than composed from and forgotten: a Message stamped with a
    version that was never recorded would point at nothing, and "which
    instructions produced this reply" is the whole of what the stamp is for.
    """
    version = await prompt_versions.latest(session)
    if version is not None:
        return version
    return await prompt_versions.record(session, DEFAULT_ADVISOR_INSTRUCTIONS)


async def revise_instructions(session: AsyncSession, instructions: str) -> PromptVersion:
    """Save the Advisor Instructions, answering with the version now in force.

    Saving what is already in force leaves no new version behind. A traveler
    who opened the page, read it and pressed save has not changed their
    advisor, and a Message stamped with a version nothing distinguishes from
    the one before it explains nothing.
    """
    version = await current_version(session)
    if instructions == version.instructions:
        return version
    return await prompt_versions.record(session, instructions)


async def restore_default_instructions(session: AsyncSession) -> PromptVersion:
    """Put the shipped Advisor Instructions back, as a revision of their own.

    A restore is a save, not an undo: the versions before it stay where they
    are, still explaining the Messages they produced.
    """
    return await revise_instructions(session, DEFAULT_ADVISOR_INSTRUCTIONS)


async def compose_around(
    session: AsyncSession, conversation: Conversation | None, instructions: str
) -> str:
    """The system prompt one Conversation's next turn sends.

    The turn composes it through here and so does the page that shows the
    traveler what the turn will send, which is the whole of why the two cannot
    disagree: the Compaction summary is a record composed into one assembly
    rather than into two kept in step by eye.

    Read at the moment it is asked for, so the Trip Plan and the Traveler
    Profile are as they stand, including whatever the traveler edited by hand
    since the advisor last said anything. The Compaction summary is read the
    same way, so a turn must fold before it composes — which is the order
    `api/conversations.py::say` does it in. With no Conversation named there is
    no plan and nothing has been folded, which is what a turn of a Conversation
    refining no Trip is sent too.
    """
    return compose_system_prompt(
        instructions,
        today=date.today(),
        plan=None if conversation is None else await plan_of(session, conversation),
        trips=await summarise_trips(session),
        profile=await read_profile(session),
        elsewhere=[
            OtherConversation(title=title, destination=destination)
            for title, destination in await conversations_apart_from(session, conversation)
        ],
        earlier=None if conversation is None else conversation.summary,
    )
