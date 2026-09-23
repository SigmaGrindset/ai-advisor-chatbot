"""Who is asking: the one place a request becomes a Traveler.

Every route takes the Traveler from here and hands it down, and nothing below
this decides whose rows it is reading. That is what lets telling Travelers
apart be a change to this module rather than to every query.
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.connection import SOLE_TRAVELER_ID, get_session
from ..db.tables import Traveler
from ..db.traveler import traveler_by_id


async def who_is_asking(session: AsyncSession = Depends(get_session)) -> Traveler:
    """The Traveler this request is from — for now, always the one there is."""
    return await traveler_by_id(session, SOLE_TRAVELER_ID)
