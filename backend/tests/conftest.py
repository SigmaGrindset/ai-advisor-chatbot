"""The test harness.

Every test drives the application through its own HTTP API, against a real
Postgres instance, inside a transaction that is rolled back afterwards, with the
application's one outbound HTTP client replaced by a transport that answers by
host. The settings hold the public half of a test Clerk key, so a test signs its
own session tokens and the real verification checks them. There is no other seam.
"""

import os
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import AsyncExitStack
from pathlib import Path

import asyncpg
import httpx2
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.api.asking import GUEST_TOKEN_HEADER
from app.config import Settings
from app.db.connection import apply_schema, get_session
from app.db.tables import Base
from app.main import create_app
from app.privacy.outbound import get_http_client

from .fakes import talking
from .fakes.canned_transport import CannedTransport, Responder
from .fakes.clerk import FRONTEND, public_pem, session_token, signing_key

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://travel:travel@localhost:5432/travel_advisor_test",
)


async def _create_database_if_absent(database_url: str) -> None:
    url = make_url(database_url)
    assert url.database is not None
    connection = await asyncpg.connect(
        host=url.host,
        port=url.port or 5432,
        user=url.username,
        password=url.password,
        database="postgres",
    )
    try:
        exists = await connection.fetchval(
            "select 1 from pg_database where datname = $1", url.database
        )
        if not exists:
            await connection.execute(f'create database "{url.database}"')
    finally:
        await connection.close()


@pytest.fixture(scope="session")
async def engine() -> AsyncIterator[AsyncEngine]:
    await _create_database_if_absent(TEST_DATABASE_URL)
    engine = create_async_engine(TEST_DATABASE_URL)
    # Dropped first, because the application's own schema step creates what is
    # missing and never alters what is there. Tests keep nothing between runs, so
    # starting from nothing is what keeps this database honest about the model.
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await apply_schema(engine)
    yield engine
    await engine.dispose()


@pytest.fixture
async def connection(engine: AsyncEngine) -> AsyncIterator[AsyncConnection]:
    """One connection per test, in a transaction that is never committed."""
    async with engine.connect() as connection:
        transaction = await connection.begin()
        try:
            yield connection
        finally:
            await transaction.rollback()


@pytest.fixture
async def session(connection: AsyncConnection) -> AsyncIterator[AsyncSession]:
    # Commits inside the application release a savepoint rather than the outer
    # transaction, so the test's rollback still undoes everything.
    session_factory = async_sessionmaker(
        bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
    )
    async with session_factory() as session:
        yield session


@pytest.fixture
def outbound_routes() -> dict[str, Responder]:
    """Canned responses by host. Tests add the hosts they expect to be called."""
    return {}


@pytest.fixture
async def http_client(outbound_routes: dict[str, Responder]) -> AsyncIterator[httpx2.AsyncClient]:
    async with httpx2.AsyncClient(transport=CannedTransport(outbound_routes)) as client:
        yield client


@pytest.fixture(scope="session")
def static_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A stand-in for the built frontend, so tests need no Node build."""
    directory = tmp_path_factory.mktemp("static")
    (directory / "index.html").write_text(
        '<!doctype html><html><body><div id="root"></div></body></html>', encoding="utf-8"
    )
    (directory / "assets").mkdir()
    (directory / "assets" / "app.js").write_text("console.log('built bundle')", encoding="utf-8")
    (directory / "manifest.webmanifest").write_text(
        '{"name": "AI Travel Advisor"}', encoding="utf-8"
    )
    return directory


@pytest.fixture(scope="session")
def clerk_key() -> rsa.RSAPrivateKey:
    """Stands in for the Clerk instance's signing key. Its public half is in the
    test settings."""
    return signing_key()


@pytest.fixture
def settings(static_dir: Path, clerk_key: rsa.RSAPrivateKey) -> Settings:
    return Settings(
        database_url=TEST_DATABASE_URL,
        openrouter_api_key="test-openrouter-key",
        static_dir=static_dir,
        clerk_public_key=public_pem(clerk_key),
        clerk_secret_key="sk_test_clerk_secret_key",
        frontend_origins=[FRONTEND],
    )


ApiFactory = Callable[[Settings], Awaitable[httpx2.AsyncClient]]


@pytest.fixture
async def api_for(
    session: AsyncSession, http_client: httpx2.AsyncClient
) -> AsyncIterator[ApiFactory]:
    """Builds an HTTP client speaking to a differently-configured application.

    Each client is a browser of its own: it keeps the Guest token a response
    hands it and sends it back, so one client is one Traveler and two are two.
    """
    async with AsyncExitStack() as stack:

        async def build(settings: Settings) -> httpx2.AsyncClient:
            app = create_app(settings)
            app.dependency_overrides[get_session] = lambda: session
            app.dependency_overrides[get_http_client] = lambda: http_client

            async def keep_guest_token(response: httpx2.Response) -> None:
                if GUEST_TOKEN_HEADER in response.headers:
                    client.headers[GUEST_TOKEN_HEADER] = response.headers[GUEST_TOKEN_HEADER]

            client = httpx2.AsyncClient(
                transport=httpx2.ASGITransport(app=app),
                base_url="http://testserver",
                event_hooks={"response": [keep_guest_token]},
            )
            return await stack.enter_async_context(client)

        yield build


@pytest.fixture
async def api(api_for: ApiFactory, settings: Settings) -> httpx2.AsyncClient:
    return await api_for(settings)


Browser = Callable[[str | None], Awaitable[httpx2.AsyncClient]]


@pytest.fixture
def browser(api_for: ApiFactory, settings: Settings, clerk_key: rsa.RSAPrivateKey) -> Browser:
    """Opens a browser of its own: a Guest's for None, or one signed in as that
    Clerk user, sending the session token with every request as Clerk's does."""

    async def opened(clerk_user: str | None) -> httpx2.AsyncClient:
        client = await api_for(settings)
        if clerk_user is not None:
            client.headers["Authorization"] = f"Bearer {session_token(clerk_key, clerk_user)}"
        return client

    return opened


@pytest.fixture
async def conversation(api: httpx2.AsyncClient) -> str:
    """A started Conversation, for tests about what happens inside one."""
    return await talking.start(api)
