"""Accounts: a Traveler signed in through Clerk is the same Traveler in any browser.

Session tokens are signed with the test key whose public half is in the test
settings, so the application checks them exactly as it checks Clerk's.
"""

from datetime import UTC, datetime, timedelta

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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
