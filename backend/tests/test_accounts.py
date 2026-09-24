"""Accounts: a Traveler signed in through Clerk is the same Traveler in any browser.

Session tokens are signed with the test key whose public half is in the test
settings, so the application checks them exactly as it checks Clerk's. Clerk's
Backend API is answered by the outbound transport, like any other host.
"""

from datetime import UTC, datetime, timedelta

import httpx2
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.advisor.instructions import DEFAULT_ADVISOR_INSTRUCTIONS
from app.api.asking import GUEST_TOKEN_HEADER
from app.config import Settings
from app.db.tables import Traveler

from .conftest import ApiFactory, Browser
from .fakes.canned_model import replying
from .fakes.canned_transport import Responder
from .fakes.clerk import session_token, signing_key
from .fakes.talking import send, start, transcript


async def test_an_account_is_made_by_its_first_request_and_found_from_any_browser(
    browser: Browser, session: AsyncSession, outbound_routes: dict[str, Responder]
) -> None:
    """A read is enough to make one, and a signed-in Traveler is never handed a Guest token."""
    laptop = await browser("user_ada")
    assert (await laptop.get("/api/trips")).json() == []
    assert list(await session.scalars(select(Traveler.clerk_user_id))) == ["user_ada"]

    outbound_routes["openrouter.ai"] = replying("Lisbon is mild in April.")
    started = await laptop.post("/api/conversations")
    assert GUEST_TOKEN_HEADER not in started.headers
    conversation = started.json()["id"]
    await send(laptop, conversation, "Is Lisbon warm in April?")
    await laptop.put("/api/advisor/instructions", json={"instructions": "Talk like a sailor.\n"})

    phone = await browser("user_ada")
    listed = (await phone.get("/api/conversations")).json()
    assert [row["id"] for row in listed] == [conversation]
    assert await transcript(phone, conversation) == [
        ("traveler", "Is Lisbon warm in April?"),
        ("advisor", "Lisbon is mild in April."),
    ]
    page = (await phone.get("/api/advisor/instructions")).json()
    assert page["instructions"] == "Talk like a sailor.\n"
    assert await session.scalar(select(func.count()).select_from(Traveler)) == 1


@pytest.mark.parametrize(
    "signed", ["expired", "by another key", "for another frontend", "with no Accounts here"]
)
async def test_a_sign_in_that_proves_nothing_is_refused_rather_than_served_as_a_guest(
    signed: str,
    api_for: ApiFactory,
    settings: Settings,
    clerk_key: rsa.RSAPrivateKey,
    session: AsyncSession,
) -> None:
    """Even from a browser whose Guest token is good: a signed-in Traveler's work
    must never land on a Guest the sweep will delete."""
    if signed == "with no Accounts here":
        settings = settings.model_copy(update={"clerk_public_key": None, "clerk_secret_key": None})
    api = await api_for(settings)
    await start(api)
    token = {
        "expired": session_token(
            clerk_key,
            "user_ada",
            issued=datetime.now(UTC) - timedelta(hours=1),
            lifetime=timedelta(minutes=1),
        ),
        "by another key": session_token(signing_key(), "user_ada"),
        "for another frontend": session_token(
            clerk_key, "user_ada", party="https://elsewhere.example"
        ),
        "with no Accounts here": session_token(clerk_key, "user_ada"),
    }[signed]
    api.headers["Authorization"] = f"Bearer {token}"

    for method in ("GET", "POST"):
        refused = await api.request(method, "/api/conversations")
        assert refused.status_code == 401, method
    assert list(await session.scalars(select(Traveler.clerk_user_id))) == [None]

    # The Guest is still there, and still theirs.
    del api.headers["Authorization"]
    assert len((await api.get("/api/conversations")).json()) == 1


async def test_deleting_everything_empties_an_account_and_keeps_it(
    browser: Browser, session: AsyncSession, outbound_routes: dict[str, Responder]
) -> None:
    """The next request finds the same Traveler, under the same Clerk user, with nothing in it."""
    laptop = await browser("user_ada")
    outbound_routes["openrouter.ai"] = replying("Lisbon is mild in April.")
    await send(laptop, await start(laptop), "Is Lisbon warm in April?")
    await laptop.put("/api/advisor/instructions", json={"instructions": "Talk like a sailor.\n"})
    held = await session.scalar(select(Traveler.id))

    assert (await laptop.delete("/api/traveler/everything")).status_code == 204

    assert (await laptop.get("/api/conversations")).json() == []
    page = (await laptop.get("/api/advisor/instructions")).json()
    assert (page["instructions"], page["version_id"]) == (DEFAULT_ADVISOR_INSTRUCTIONS, None)
    kept = await session.execute(select(Traveler.id, Traveler.clerk_user_id))
    assert kept.tuples().all() == [(held, "user_ada")]


async def test_deleting_an_account_deletes_the_clerk_user_and_everything_here(
    browser: Browser, session: AsyncSession, outbound_routes: dict[str, Responder]
) -> None:
    laptop = await browser("user_ada")
    await start(laptop)
    asked: list[httpx2.Request] = []

    def gone(request: httpx2.Request) -> httpx2.Response:
        asked.append(request)
        return httpx2.Response(200, json={"object": "user", "id": "user_ada", "deleted": True})

    outbound_routes["api.clerk.com"] = gone

    assert (await laptop.delete("/api/traveler/account")).status_code == 204

    (request,) = asked
    assert request.method == "DELETE"
    assert str(request.url) == "https://api.clerk.com/v1/users/user_ada"
    assert request.headers["Authorization"] == "Bearer sk_test_clerk_secret_key"
    assert await session.scalar(select(func.count()).select_from(Traveler)) == 0


@pytest.mark.parametrize("clerk", ["refuses", "cannot be reached"])
async def test_an_account_clerk_did_not_delete_keeps_everything(
    clerk: str, browser: Browser, outbound_routes: dict[str, Responder]
) -> None:
    """Never an Account with nothing behind it, nor work nobody can sign in to."""
    laptop = await browser("user_ada")
    kept = await start(laptop)
    await laptop.put("/api/advisor/instructions", json={"instructions": "Talk like a sailor.\n"})

    def failing(request: httpx2.Request) -> httpx2.Response:
        if clerk == "refuses":
            return httpx2.Response(500, json={"errors": [{"code": "internal_clerk_error"}]})
        raise httpx2.ConnectError("unreachable", request=request)

    outbound_routes["api.clerk.com"] = failing

    refused = await laptop.delete("/api/traveler/account")
    assert refused.status_code == 502
    assert "nothing was deleted" in refused.json()["detail"]

    assert [row["id"] for row in (await laptop.get("/api/conversations")).json()] == [kept]
    page = (await laptop.get("/api/advisor/instructions")).json()
    assert page["instructions"] == "Talk like a sailor.\n"
