"""The application: API, built frontend, and the resources both need."""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import async_sessionmaker

from .api import conversations, health, instructions, traveler, trips
from .api.asking import GUEST_TOKEN_HEADER
from .api.clerk import clerk_verifier_for
from .config import Settings
from .db.connection import apply_schema, create_engine
from .frontend import mount_frontend
from .privacy.outbound import create_http_client
from .services.sweep import sweep_every_hour

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    if not settings.openrouter_api_key:
        logger.warning("OPENROUTER_API_KEY is not set — the advisor cannot answer")
    if app.state.clerk_verifier is None:
        logger.warning(
            "CLERK_PUBLIC_KEY or CLERK_SECRET_KEY is not set — Accounts are unavailable,"
            " and everyone is a Guest"
        )
    elif not settings.frontend_origins:
        logger.warning(
            "FRONTEND_ORIGINS is empty, so every sign-in is refused — list the origin"
            " the frontend is served from"
        )
    engine = create_engine(settings.database_url)
    # Before the first request is served, never during one.
    await apply_schema(engine)
    app.state.engine = engine
    app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)
    app.state.http_client = create_http_client()
    sweeping = asyncio.create_task(sweep_every_hour(app.state.session_factory))
    try:
        yield
    finally:
        sweeping.cancel()
        with suppress(asyncio.CancelledError):
            await sweeping
        await app.state.http_client.aclose()
        await engine.dispose()


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(title="AI Travel Advisor", lifespan=lifespan)
    app.state.settings = settings
    app.state.clerk_verifier = clerk_verifier_for(settings)
    # A frontend on another host is let in from the configured origins only.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", GUEST_TOKEN_HEADER],
        # A new Guest's token arrives in a header, which a page on another
        # origin can only read when it is named here.
        expose_headers=[GUEST_TOKEN_HEADER],
    )
    app.include_router(health.router, prefix="/api")
    app.include_router(conversations.router, prefix="/api")
    app.include_router(trips.router, prefix="/api")
    app.include_router(traveler.router, prefix="/api")
    app.include_router(instructions.router, prefix="/api")
    # Last, so the single-page application fallback never shadows an API route.
    mount_frontend(app, settings.static_dir)
    return app


app = create_app(Settings())
