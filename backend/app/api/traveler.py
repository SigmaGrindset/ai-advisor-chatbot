"""The Traveler Profile as the traveler reads it, and the ways it goes away.

Everything the advisor has learned, enumerable and deletable fact by fact,
which is what ADR-0001 made the profile structured for and what ADR-0004
promises. And beside it the control that leaves nothing behind at all —
Conversations, Trips, Trip Plans and the profile together, because "clear my
data" that left some of it would be a worse answer than none — and for an
Account holder, the one that takes the Account with it.

Deleting answers with what is left rather than with nothing, the same way the
Trip Plan routes answer with the whole plan: the pane is showing the list the
traveler just deleted from, and a second request to find out what it says now
is a round trip for something the first one already knew.
"""

import uuid

import httpx2
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..advisor.remembering import Fact
from ..config import Settings, get_settings
from ..db import traveler as travelers
from ..db.connection import get_session
from ..db.tables import Traveler
from ..privacy.outbound import get_http_client
from ..services import accounts
from ..services.profile import read_profile
from .asking import who_is_asking

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
    traveler: Traveler = Depends(who_is_asking),
) -> list[ProfileFactView]:
    """Everything the advisor has learned about the traveler, in the order it learned it."""
    return [ProfileFactView.of(fact) for fact in await read_profile(session, traveler)]


@router.delete("/traveler/profile/{fact_id}")
async def forget_profile_fact(
    fact_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
) -> list[ProfileFactView]:
    """Remove one Profile Fact, and only that one.

    There is no flag and no hidden row. What comes back is the profile as it
    stands afterwards, which is what the traveler is looking at.
    """
    fact = await travelers.fact_by_id(session, traveler, fact_id)
    if fact is None:
        raise HTTPException(status_code=404, detail="No such Profile Fact.")
    await travelers.forget_fact(session, fact)
    return [ProfileFactView.of(remaining) for remaining in await read_profile(session, traveler)]


@router.delete("/traveler/everything", status_code=204)
async def erase_everything(
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
) -> Response:
    """Leave nothing behind: every Conversation, every Trip, the whole profile
    and the Advisor Instructions. An Account stays, empty.

    Asking the traveler first is the interface's job, because by the time the
    request arrives the decision has been made.
    """
    await travelers.erase_everything(session, traveler)
    return Response(status_code=204)


@router.delete("/traveler/account", status_code=204)
async def delete_account(
    session: AsyncSession = Depends(get_session),
    traveler: Traveler = Depends(who_is_asking),
    http_client: httpx2.AsyncClient = Depends(get_http_client),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Delete the Account along with everything in it, at Clerk as well as here.

    Both go or neither does. Signing out afterwards is the browser's to do.
    """
    clerk_user = traveler.clerk_user_id
    if clerk_user is None or settings.clerk_secret_key is None:
        raise HTTPException(status_code=404, detail="There is no Account to delete.")
    try:
        await accounts.delete_account(
            session,
            traveler,
            clerk_user,
            http_client=http_client,
            secret_key=settings.clerk_secret_key,
        )
    except accounts.ClerkRefused:
        raise HTTPException(
            status_code=502,
            detail="Clerk did not delete your account, so nothing was deleted.",
        ) from None
    return Response(status_code=204)
