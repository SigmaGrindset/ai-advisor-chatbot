"""The sweep: every Guest a day without use is deleted, with everything they own.

A plain function of "now", so a test can run it at any hour it likes, and an
hourly timer that runs it for as long as the application is up. If the backend
ends up on a host that only runs while serving a request, the timer goes and a
cron entry point calls the same function.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..db.traveler import forget_guests_idle_since

logger = logging.getLogger(__name__)

#: How long a Guest is kept after their last request.
GUESTS_KEPT_FOR = timedelta(hours=24)

#: How often the timer sweeps, so a Guest goes at most this long after their day.
SWEEP_EVERY = timedelta(hours=1)


async def sweep_idle_guests(session: AsyncSession, now: datetime) -> None:
    """Delete every Guest whose last request was more than a day before `now`."""
    swept = await forget_guests_idle_since(session, now - GUESTS_KEPT_FOR)
    logger.info("Swept %d idle Guests", swept)


async def sweep_every_hour(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """Sweep now, and then once an hour until cancelled.

    A sweep that fails is logged and left for the next hour: it has lost nothing
    by waiting, and taking the application down with it would lose everything.
    """
    while True:
        try:
            async with session_factory() as session:
                await sweep_idle_guests(session, datetime.now(UTC))
        except Exception:
            logger.exception("The Guest sweep failed, and runs again in an hour")
        await asyncio.sleep(SWEEP_EVERY.total_seconds())
