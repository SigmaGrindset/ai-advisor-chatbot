"""The saved revisions of the Advisor Instructions: keeping one, and finding
the most recent. Every rule about them is a layer up, in
`services/instructions.py`.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .tables import PromptVersion, Traveler


async def latest(session: AsyncSession, traveler: Traveler) -> PromptVersion | None:
    """The Prompt Version in force, and None before the first has been saved."""
    version: PromptVersion | None = await session.scalar(
        select(PromptVersion)
        .where(PromptVersion.traveler_id == traveler.id)
        # By the revision the database counted, never by when it was written —
        # see `PromptVersion.revision`.
        .order_by(PromptVersion.revision.desc())
        .limit(1)
    )
    return version


async def record(session: AsyncSession, traveler: Traveler, instructions: str) -> PromptVersion:
    """Keep a revision of the Advisor Instructions, and answer with it.

    Committed rather than left pending: a version a Message points at has to
    have survived first.
    """
    version = PromptVersion(traveler_id=traveler.id, instructions=instructions)
    session.add(version)
    await session.commit()
    return version
