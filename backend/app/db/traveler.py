"""The Traveler's own record: the Profile Facts, and how all of it goes away.

Nothing here raises an HTTP anything and nothing here decides what a change
means. A Profile Fact is a row, addressable on its own, so deleting one leaves
every other exactly as it was — which is the whole of what ADR-0001 made the
profile enumerable for.
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from .tables import SOLE_TRAVELER_ID, FactSubject, ProfileFact, Traveler


async def facts_of(session: AsyncSession) -> Sequence[ProfileFact]:
    """The whole Traveler Profile, in the order the facts were learned."""
    facts = await session.scalars(
        select(ProfileFact)
        .where(ProfileFact.traveler_id == SOLE_TRAVELER_ID)
        .order_by(ProfileFact.created_at, ProfileFact.id)
    )
    return list(facts)


async def facts_about(session: AsyncSession, subject: FactSubject) -> Sequence[ProfileFact]:
    """Everything recorded under one subject, in the order it was learned.

    A sequence rather than one fact: only three of the four subjects hold
    exactly one, and what that means is decided a layer up.
    """
    facts = await session.scalars(
        select(ProfileFact)
        .where(
            ProfileFact.traveler_id == SOLE_TRAVELER_ID, ProfileFact.subject == subject
        )
        .order_by(ProfileFact.created_at, ProfileFact.id)
    )
    return list(facts)


async def fact_by_ref(session: AsyncSession, ref: int) -> ProfileFact | None:
    """The fact the advisor knows by that number, if it is still there."""
    fact: ProfileFact | None = await session.scalar(
        select(ProfileFact).where(
            ProfileFact.traveler_id == SOLE_TRAVELER_ID, ProfileFact.ref == ref
        )
    )
    return fact


async def fact_by_id(session: AsyncSession, fact_id: uuid.UUID) -> ProfileFact | None:
    """The fact the interface knows by its identifier."""
    fact: ProfileFact | None = await session.scalar(
        select(ProfileFact).where(
            ProfileFact.traveler_id == SOLE_TRAVELER_ID, ProfileFact.id == fact_id
        )
    )
    return fact


async def record_fact(
    session: AsyncSession, *, subject: FactSubject, detail: str
) -> ProfileFact:
    """Learn one thing about the traveler."""
    traveler = await session.get_one(Traveler, SOLE_TRAVELER_ID)
    fact = ProfileFact(
        traveler_id=SOLE_TRAVELER_ID,
        ref=traveler.next_fact_ref,
        subject=subject,
        detail=detail,
    )
    traveler.next_fact_ref += 1
    session.add(fact)
    await session.commit()
    return fact


async def amend_fact(session: AsyncSession, fact: ProfileFact, detail: str) -> None:
    """Correct what one fact says, keeping the fact it is about.

    The same row rather than a new one, so the traveler sees one nationality
    change rather than two nationalities appear.
    """
    fact.detail = detail
    await session.commit()


async def forget_fact(session: AsyncSession, fact: ProfileFact) -> None:
    """Take one fact off the profile, for good.

    The number it was listed under goes with it and is never handed out again
    — see `Traveler.next_fact_ref`.
    """
    await session.delete(fact)
    await session.commit()


async def erase_everything(session: AsyncSession) -> None:
    """Leave nothing behind: every Conversation, every Trip, the whole profile.

    Every table hangs off the Traveler, so the Traveler goes and an empty one
    takes its place. A table added later needs no line here, which is the
    point: one kept in step by hand would one day leave something behind.

    The row comes straight back because it is the one implicit account there
    is. `next_fact_ref` starts at one again, which is right — nothing refers
    to the old numbers any more.
    """
    await session.execute(delete(Traveler).where(Traveler.id == SOLE_TRAVELER_ID))
    await session.execute(insert(Traveler).values(id=SOLE_TRAVELER_ID))
    await session.commit()
    # The cascade took those rows underneath the session, which still holds
    # them in its identity map: a later read by identifier would answer with a
    # Conversation that no longer exists.
    session.expunge_all()
