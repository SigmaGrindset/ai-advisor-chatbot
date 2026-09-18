"""Health: is the application up, and can it reach its database?"""

from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings, get_settings
from ..db import get_session

router = APIRouter(tags=["health"])


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["up", "down"]
    openrouter_key: Literal["configured", "missing"]


@router.get("/health")
async def read_health(
    response: Response,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Health:
    database: Literal["up", "down"] = "up"
    try:
        await session.execute(text("select 1"))
    except SQLAlchemyError:
        database = "down"

    if database == "down":
        response.status_code = 503

    return Health(
        status="ok" if database == "up" else "degraded",
        database=database,
        # A missing key is reported, not fatal: the application still starts, and
        # the interface explains the problem rather than hanging.
        openrouter_key="configured" if settings.openrouter_api_key else "missing",
    )
