"""Who is asking: the one place a request becomes a Traveler.

Every route takes the Traveler from here and hands it down, and nothing below
this decides whose rows it is reading.

It comes in two forms. Most routes take `who_is_asking`, which never creates
anyone: somebody who has written nothing is answered as an empty Traveler
would be, and a Conversation or Trip they name is not theirs. Only a write
that can start from nothing — a first Conversation, a first edit of the
Advisor Instructions — takes `who_is_writing`, which makes them a Guest.
"""

import uuid
from typing import Annotated

from fastapi import Depends, Header, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.connection import get_session
from ..db.tables import Traveler
from ..db.traveler import begin_guest, guest_holding

#: Where a Guest's token travels, both ways. Never logged, and never in a URL,
#: where an access log would keep it.
GUEST_TOKEN_HEADER = "X-Guest-Token"


async def _guest(
    guest_token: Annotated[str | None, Header(alias=GUEST_TOKEN_HEADER)] = None,
    session: AsyncSession = Depends(get_session),
) -> Traveler | None:
    """The Guest whose token came with the request. A token nobody holds any
    more is the same as no token."""
    return None if guest_token is None else await guest_holding(session, guest_token)


async def who_is_asking(guest: Traveler | None = Depends(_guest)) -> Traveler:
    """The Traveler this request is from, or one who has written nothing.

    The second is never saved, so every query about them answers empty and
    nothing can be written for them.
    """
    return Traveler(id=uuid.uuid4()) if guest is None else guest


async def who_is_writing(
    response: Response,
    guest: Traveler | None = Depends(_guest),
    session: AsyncSession = Depends(get_session),
) -> Traveler:
    """The Traveler this request is from, a new Guest if there is none yet.

    The token goes back on this one response and is never told again, so the
    browser keeps it from here.
    """
    if guest is not None:
        return guest
    guest, token = await begin_guest(session)
    response.headers[GUEST_TOKEN_HEADER] = token
    return guest
