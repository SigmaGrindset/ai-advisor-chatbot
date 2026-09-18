"""Schema application is what a restart repeats, so it has to be repeatable."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.db.connection import apply_schema
from app.db.tables import Traveler


async def test_applying_the_schema_to_a_database_that_has_it_changes_nothing(
    engine: AsyncEngine,
) -> None:
    await apply_schema(engine)
    await apply_schema(engine)

    async with engine.connect() as connection:
        travelers = await connection.scalar(select(func.count()).select_from(Traveler))

    assert travelers == 1
