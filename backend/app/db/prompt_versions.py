"""The saved revisions of the Advisor Instructions.

Nothing here decides what the instructions are when none have been saved, and
nothing here decides whether a save is worth a row. Both are rules and both
live a layer up, in `services/instructions.py`. This keeps a revision and
finds the most recent one.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .tables import SOLE_TRAVELER_ID, PromptVersion


async def latest(session: AsyncSession) -> PromptVersion | None:
    """The Prompt Version in force, and None before the first has been saved."""
    version: PromptVersion | None = await session.scalar(
        select(PromptVersion)
        .where(PromptVersion.traveler_id == SOLE_TRAVELER_ID)
        # By the revision the database counted, never by when it was written:
        # see `PromptVersion.revision` for what a timestamp settles here and
        # what it does not.
        .order_by(PromptVersion.revision.desc())
        .limit(1)
    )
    return version


async def record(session: AsyncSession, instructions: str) -> PromptVersion:
    """Keep a revision of the Advisor Instructions, and answer with it.

    Committed rather than left pending, because the caller goes on to compose
    a prompt from it and to stamp Messages with it: a version a Message points
    at has to have survived first.
    """
    version = PromptVersion(traveler_id=SOLE_TRAVELER_ID, instructions=instructions)
    session.add(version)
    await session.commit()
    return version
