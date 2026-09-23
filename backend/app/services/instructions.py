"""The Advisor Instructions in force, and the prompt composed around them.

The rows are `db/prompt_versions.py`'s and the shipped words are
`advisor/instructions.py`'s. This is what knows the rules between them: the
default is in force until the traveler saves their own, saving the same words
again is not a revision, restoring the default is a revision like any other.
"""

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor.conversations import OtherConversation
from ..advisor.instructions import DEFAULT_ADVISOR_INSTRUCTIONS, compose_system_prompt
from ..db import prompt_versions
from ..db.conversations import conversations_apart_from
from ..db.tables import Conversation, PromptVersion, Traveler
from .plans import plan_of, summarise_trips
from .profile import read_profile


async def current_version(session: AsyncSession, traveler: Traveler) -> PromptVersion:
    """The Prompt Version every turn is composed from until it is edited.

    The first turn saves the shipped default as the first version, rather than
    composing from it and forgetting: a Message stamped with a version that
    was never recorded would point at nothing.
    """
    version = await prompt_versions.latest(session, traveler)
    if version is not None:
        return version
    return await prompt_versions.record(session, traveler, DEFAULT_ADVISOR_INSTRUCTIONS)


async def revise_instructions(
    session: AsyncSession, traveler: Traveler, instructions: str
) -> PromptVersion:
    """Save the Advisor Instructions, answering with the version now in force.

    Saving what is already in force leaves no new version: somebody who opened
    the page and pressed save has not changed their advisor, and a version
    nothing distinguishes from the last explains nothing.
    """
    version = await current_version(session, traveler)
    if instructions == version.instructions:
        return version
    return await prompt_versions.record(session, traveler, instructions)


async def restore_default_instructions(
    session: AsyncSession, traveler: Traveler
) -> PromptVersion:
    """Put the shipped Advisor Instructions back, as a revision of their own.

    A restore is a save, not an undo: the versions before it stay where they
    are, still explaining the Messages they produced.
    """
    return await revise_instructions(session, traveler, DEFAULT_ADVISOR_INSTRUCTIONS)


async def compose_around(
    session: AsyncSession,
    traveler: Traveler,
    conversation: Conversation | None,
    instructions: str,
) -> str:
    """The system prompt one Conversation's next turn sends.

    The turn and the page showing what the turn will send both compose through
    here, which is why the two cannot disagree.

    Everything is read at the moment it is asked for, so the plan and profile
    are as they stand — including hand edits since the advisor last spoke. The
    Compaction summary too, so a turn must fold before it composes, which is
    the order `api/conversations.py::say` does it in.
    """
    return compose_system_prompt(
        instructions,
        today=date.today(),
        plan=None if conversation is None else await plan_of(session, traveler, conversation),
        trips=await summarise_trips(session, traveler),
        profile=await read_profile(session, traveler),
        elsewhere=[
            OtherConversation(title=title, destination=destination)
            for title, destination in await conversations_apart_from(
                session, traveler, conversation
            )
        ],
        earlier=None if conversation is None else conversation.summary,
    )
