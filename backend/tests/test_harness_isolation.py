"""The harness's own guarantee: what a test writes never reaches the next test.

Both tests insert the same traveler, so a leak from the first surfaces as a
primary key violation in the second whichever order they run in.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Traveler

A_SECOND_TRAVELER = uuid.UUID("00000000-0000-0000-0000-0000000000ff")


async def _add_a_second_traveler(session: AsyncSession) -> int:
    session.add(Traveler(id=A_SECOND_TRAVELER))
    await session.commit()
    return await session.scalar(select(func.count()).select_from(Traveler)) or 0


async def test_a_write_inside_a_test_is_visible_to_that_test(session: AsyncSession) -> None:
    assert await _add_a_second_traveler(session) == 2


async def test_a_write_from_an_earlier_test_is_gone(session: AsyncSession) -> None:
    assert await _add_a_second_traveler(session) == 2
