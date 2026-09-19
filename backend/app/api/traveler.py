"""The Traveler Profile as the traveler reads it, and the two ways it goes away.

Everything the advisor has learned, enumerable and deletable fact by fact,
which is what ADR-0001 made the profile structured for and what ADR-0004
promises. And beside it the one control that leaves nothing behind at all —
Conversations, Trips, Trip Plans and the profile together, because "clear my
data" that left some of it would be a worse answer than none.

Deleting answers with what is left rather than with nothing, the same way the
Trip Plan routes answer with the whole plan: the pane is showing the list the
traveler just deleted from, and a second request to find out what it says now
is a round trip for something the first one already knew.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor.remembering import Fact
from ..db import traveler
from ..db.connection import get_session
from ..services.profile import read_profile

router = APIRouter(tags=["traveler"])


class ProfileFactView(BaseModel):
    """One thing the advisor knows about the traveler."""

    id: uuid.UUID
    #: What the fact is about, as the domain names it. What that is called in
    #: words is the interface's, which is the one place it is read.
    subject: str
    detail: str

    @classmethod
    def of(cls, fact: Fact) -> "ProfileFactView":
        return cls(id=fact.id, subject=fact.subject, detail=fact.detail)


@router.get("/traveler/profile")
async def read_traveler_profile(
    session: AsyncSession = Depends(get_session),
) -> list[ProfileFactView]:
    """Everything the advisor has learned about the traveler, in the order it learned it."""
    return [ProfileFactView.of(fact) for fact in await read_profile(session)]


@router.delete("/traveler/profile/{fact_id}")
async def forget_profile_fact(
    fact_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[ProfileFactView]:
    """Remove one Profile Fact, and only that one.

    There is no flag and no hidden row. What comes back is the profile as it
    stands afterwards, which is what the traveler is looking at.
    """
    fact = await traveler.fact_by_id(session, fact_id)
    if fact is None:
        raise HTTPException(status_code=404, detail="No such Profile Fact.")
    await traveler.forget_fact(session, fact)
    return [ProfileFactView.of(remaining) for remaining in await read_profile(session)]


@router.delete("/traveler/everything", status_code=204)
async def erase_everything(session: AsyncSession = Depends(get_session)) -> Response:
    """Leave nothing behind: every Conversation, every Trip and the whole profile.

    Asking the traveler first is the interface's job, because by the time the
    request arrives the decision has been made.
    """
    await traveler.erase_everything(session)
    return Response(status_code=204)
