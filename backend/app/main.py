"""The application: API, built frontend, and the resources both need."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker

from .api import conversations, health, traveler, trips
from .config import Settings
from .db.connection import apply_schema, create_engine
from .frontend import mount_frontend
from .privacy.outbound import create_http_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    if not settings.openrouter_api_key:
        logger.warning("OPENROUTER_API_KEY is not set — the advisor cannot answer")
    engine = create_engine(settings.database_url)
    # Before the first request is served, never during one.
    await apply_schema(engine)
    app.state.engine = engine
    app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)
    app.state.http_client = create_http_client()
    try:
        yield
    finally:
        await app.state.http_client.aclose()
        await engine.dispose()


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(title="AI Travel Advisor", lifespan=lifespan)
    app.state.settings = settings
    app.include_router(health.router, prefix="/api")
    app.include_router(conversations.router, prefix="/api")
    app.include_router(trips.router, prefix="/api")
    app.include_router(traveler.router, prefix="/api")
    # Last, so the single-page application fallback never shadows an API route.
    mount_frontend(app, settings.static_dir)
    return app


app = create_app(Settings())
