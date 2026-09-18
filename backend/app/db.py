"""Database engine, schema application, and the session dependency."""

import logging
from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from .models import SOLE_TRAVELER_ID, Base, Traveler

logger = logging.getLogger(__name__)


def create_engine(database_url: str) -> AsyncEngine:
    return create_async_engine(database_url, pool_pre_ping=True)


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
