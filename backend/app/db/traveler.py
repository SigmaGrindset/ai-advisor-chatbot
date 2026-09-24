"""The Traveler's own record: who they are, the Profile Facts, and how all of
it goes away.

Nothing here raises an HTTP anything and nothing here decides what a change
means. A Profile Fact is a row, addressable on its own, so deleting one leaves
every other exactly as it was — which is the whole of what ADR-0001 made the
profile enumerable for.
"""

import hashlib
import secrets
import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .tables import FactSubject, ProfileFact, Traveler


async def account_holder(session: AsyncSession, clerk_user_id: str) -> Traveler:
    """The Traveler signed in as this Clerk user, made on their first request,
    and marked as active as of now.

    One statement that finds or makes them, because a first page load asks for
    several things at once, and they must all land on one Traveler. Committed
    here, reads included: a signed-in Traveler exists from the first request,
    and there is no token to hand back that a refused write would lose.
    """
    found = await session.scalars(
        insert(Traveler)
        .values(clerk_user_id=clerk_user_id)
        .on_conflict_do_update(
            index_elements=[Traveler.clerk_user_id], set_={"last_active_at": func.now()}
        )
        .returning(Traveler),
        execution_options={"populate_existing": True},
    )
    traveler = found.one()
    await session.commit()
    return traveler


async def guest_returning(session: AsyncSession, token: str) -> Traveler | None:
    """The Guest this token was handed to, if they are still here, marked as
    active as of now.

    Found by the update itself rather than read and then updated, so a sweep
    between the two cannot delete them underneath the request. Committed here
    because most requests never write, and a read is still use.
    """
    guest: Traveler | None = await session.scalar(
        update(Traveler)
        .where(Traveler.guest_token_hash == _hashed(token))
        .values(last_active_at=func.now())
        .returning(Traveler)
    )
    await session.commit()
    return guest


async def forget_guests_idle_since(session: AsyncSession, since: datetime) -> int:
    """Delete every Guest who has made no request since then, with everything
    they own, and say how many went.

    Only a Traveler holding a Guest token can match. An Account's Traveler
    never holds one, so no Account is ever swept.
    """
    swept = await session.scalars(
        delete(Traveler)
        .where(Traveler.guest_token_hash.is_not(None), Traveler.last_active_at < since)
        .returning(Traveler.id)
    )
    count = len(swept.all())
    await session.commit()
    # Same reason as `erase_everything`: the cascade went round the session.
    session.expunge_all()
    return count


async def begin_guest(session: AsyncSession) -> tuple[Traveler, str]:
    """A new Guest, and the token that will know them again.

    This is the only time the token can be told: what is kept is its hash.

    Flushed but not committed: the write that needed a Guest commits them with
    it. A request refused before it wrote anything leaves nobody behind, which
    matters because its refusal never carries the token either.
    """
    token = secrets.token_urlsafe(32)
    guest = Traveler(guest_token_hash=_hashed(token))
    session.add(guest)
    await session.flush()
    return guest, token


def _hashed(token: str) -> str:
    """A plain digest rather than a password hash: the token is 256 random bits,
    so there is no guessable space for a slow hash to protect."""
    return hashlib.sha256(token.encode()).hexdigest()


async def facts_of(session: AsyncSession, traveler: Traveler) -> Sequence[ProfileFact]:
    """The whole Traveler Profile, in the order the facts were learned."""
    facts = await session.scalars(
        select(ProfileFact)
        .where(ProfileFact.traveler_id == traveler.id)
        .order_by(ProfileFact.created_at, ProfileFact.id)
    )
    return list(facts)


async def facts_about(
    session: AsyncSession, traveler: Traveler, subject: FactSubject
) -> Sequence[ProfileFact]:
    """Everything recorded under one subject, in the order it was learned.

    A sequence rather than one fact: only three of the four subjects hold
    exactly one, and what that means is decided a layer up.
    """
    facts = await session.scalars(
        select(ProfileFact)
        .where(ProfileFact.traveler_id == traveler.id, ProfileFact.subject == subject)
        .order_by(ProfileFact.created_at, ProfileFact.id)
    )
    return list(facts)


async def fact_by_ref(session: AsyncSession, traveler: Traveler, ref: int) -> ProfileFact | None:
    """The fact the advisor knows by that number, if it is still there."""
    fact: ProfileFact | None = await session.scalar(
        select(ProfileFact).where(ProfileFact.traveler_id == traveler.id, ProfileFact.ref == ref)
    )
    return fact


async def fact_by_id(
    session: AsyncSession, traveler: Traveler, fact_id: uuid.UUID
) -> ProfileFact | None:
    """The fact the interface knows by its identifier."""
    fact: ProfileFact | None = await session.scalar(
        select(ProfileFact).where(
            ProfileFact.traveler_id == traveler.id, ProfileFact.id == fact_id
        )
    )
    return fact


async def record_fact(
    session: AsyncSession, traveler: Traveler, *, subject: FactSubject, detail: str
) -> ProfileFact:
    """Learn one thing about the traveler."""
    # Counted from the row as it stands now rather than as the request found
    # it: a turn in another tab may have handed out a number since.
    await session.refresh(traveler, ["next_fact_ref"])
    fact = ProfileFact(
        traveler_id=traveler.id,
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


async def erase_everything(session: AsyncSession, traveler: Traveler) -> None:
    """Leave nothing behind: every Conversation, every Trip, the whole profile,
    the Advisor Instructions.

    Every table hangs off the Traveler, so the Traveler goes and everything
    with it. A table added later needs no line here, which is the point: one
    kept in step by hand would one day leave something behind.

    A Guest goes with it, token and all, and their next write starts a new one.
    An Account holder's next request makes them a new, empty Traveler.
    """
    await session.execute(delete(Traveler).where(Traveler.id == traveler.id))
    await session.commit()
    # The cascade took those rows underneath the session, which still holds
    # them in its identity map: a later read by identifier would answer with a
    # Conversation that no longer exists.
    session.expunge_all()
