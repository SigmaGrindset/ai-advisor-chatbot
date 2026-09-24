"""Who is asking: the one place a request becomes a Traveler.

Every route takes the Traveler from here and hands it down, and nothing below
this decides whose rows it is reading.

A signed-in Traveler is known by Clerk's session token, and is the same
Traveler from any browser, made on their first request. Anyone else is known
by their Guest token, if they have one.

It comes in two forms. Most routes take `who_is_asking`, which never makes a
Guest: somebody who has written nothing is answered as an empty Traveler
would be, and a Conversation or Trip they name is not theirs. Only a write
that can start from nothing — a first Conversation, a first edit of the
Advisor Instructions — takes `who_is_writing`, which makes them a Guest.
"""

import uuid
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.connection import get_session
from ..db.tables import Traveler
from ..db.traveler import account_holder, begin_guest, guest_returning
from .clerk import ClerkVerifier, get_clerk_verifier

#: Where a Guest's token travels, both ways. Never logged, and never in a URL,
#: where an access log would keep it.
GUEST_TOKEN_HEADER = "X-Guest-Token"


async def _clerk_user(
    authorization: Annotated[str | None, Header()] = None,
    clerk_verifier: ClerkVerifier | None = Depends(get_clerk_verifier),
) -> str | None:
    """The Clerk user whose session token came with the request, if one did.

    A token that proves nothing is refused rather than read as no token: a
    signed-in Traveler whose work landed on a Guest would lose it to the sweep.
    That includes any token at all while Accounts are unavailable.
    """
    if authorization is None:
        return None
    scheme, _, token = authorization.partition(" ")
    user = (
        clerk_verifier.user_of(token)
        if clerk_verifier is not None and scheme.lower() == "bearer"
        else None
    )
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Your sign-in could not be checked. Sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def _traveler(
    clerk_user: str | None = Depends(_clerk_user),
    guest_token: Annotated[str | None, Header(alias=GUEST_TOKEN_HEADER)] = None,
    session: AsyncSession = Depends(get_session),
) -> Traveler | None:
    """The Traveler the request's tokens name, if there is one.

    A sign-in wins. A Guest token sent with it is not even looked up, so the
    Guest it names is left to the sweep. A Guest token nobody holds any more
    is the same as no token.
    """
    if clerk_user is not None:
        return await account_holder(session, clerk_user)
    return None if guest_token is None else await guest_returning(session, guest_token)


async def who_is_asking(traveler: Traveler | None = Depends(_traveler)) -> Traveler:
    """The Traveler this request is from, or one who has written nothing.

    The second is never saved, so every query about them answers empty and
    nothing can be written for them.
    """
    return Traveler(id=uuid.uuid4()) if traveler is None else traveler


async def who_is_writing(
    response: Response,
    traveler: Traveler | None = Depends(_traveler),
    session: AsyncSession = Depends(get_session),
) -> Traveler:
    """The Traveler this request is from, a new Guest if there is none yet.

    The token goes back on this one response and is never told again, so the
    browser keeps it from here.
    """
    if traveler is not None:
        return traveler
    guest, token = await begin_guest(session)
    response.headers[GUEST_TOKEN_HEADER] = token
    return guest
