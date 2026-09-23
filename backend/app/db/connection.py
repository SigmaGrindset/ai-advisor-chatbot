"""Database engine, schema application with the sole Traveler it seeds, and the
session dependency."""

import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from .tables import Base, Traveler

logger = logging.getLogger(__name__)

#: One traveler, implicitly — there are no accounts yet. Only the schema step
#: below and `api/asking.py` know it: every query takes the Traveler it is
#: asked about, so supporting more is a change to who is asking, not to them.
SOLE_TRAVELER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def create_engine(database_url: str) -> AsyncEngine:
    # `hide_parameters` keeps bound values out of SQLAlchemy's error text: a
    # failing statement on the `message` table would otherwise carry what was
    # said into the traceback, which is the one way a Message could reach a log.
    return create_async_engine(database_url, pool_pre_ping=True, hide_parameters=True)


async def apply_schema(engine: AsyncEngine) -> None:
    """Bring the database up to date, before the application accepts traffic.

    Both steps are idempotent, so a restart against an existing database neither
    reapplies the schema nor fails.
    """
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.execute(
            pg_insert(Traveler).values(id=SOLE_TRAVELER_ID).on_conflict_do_nothing()
        )
    logger.info("Database schema is up to date")


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    session_factory = request.app.state.session_factory
    async with session_factory() as session:
        yield session
