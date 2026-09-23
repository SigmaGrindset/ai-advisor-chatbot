"""Database engine, schema application, and the session dependency."""

import logging
from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from .tables import Base

logger = logging.getLogger(__name__)


def create_engine(database_url: str) -> AsyncEngine:
    # `hide_parameters` keeps bound values out of SQLAlchemy's error text: a
    # failing statement on the `message` table would otherwise carry what was
    # said into the traceback, which is the one way a Message could reach a log.
    return create_async_engine(database_url, pool_pre_ping=True, hide_parameters=True)


async def apply_schema(engine: AsyncEngine) -> None:
    """Bring the database up to date, before the application accepts traffic.

    Idempotent, so a restart against an existing database neither reapplies
    the schema nor fails. Nothing is seeded: a Traveler is created by their
    first write, never in advance.
    """
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    logger.info("Database schema is up to date")


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    session_factory = request.app.state.session_factory
    async with session_factory() as session:
        yield session
