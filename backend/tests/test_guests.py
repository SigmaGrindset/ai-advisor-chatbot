"""Guests: everyone is a Traveler of their own, and looking costs nothing.

Each test client is a browser, keeping the Guest token a write hands it, so
two clients are two Guests. What is asserted is what each of them can see and
change — and, for somebody who has only looked, that nothing was stored.
"""

import json
import uuid
from typing import Any

import httpx2
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.advisor.instructions import DEFAULT_ADVISOR_INSTRUCTIONS
from app.api.asking import GUEST_TOKEN_HEADER
from app.config import Settings
from app.db.tables import Traveler

from .conftest import ApiFactory
from .fakes.canned_model import CannedModel, calling, content, finish, wants_tools
from .fakes.canned_transport import Responder
from .fakes.talking import messages, send, start, transcript


def _asking(*asks: tuple[str, dict[str, Any]], says: str = "Noted.") -> CannedModel:
    """A model that asks for these writing tools in one step, then answers."""
    chunks = [
        chunk
        for at, (name, arguments) in enumerate(asks)
        for chunk in calling(name, json.dumps(arguments), call_id=f"call-{at}", at=at)
    ]
    return CannedModel(*chunks, wants_tools(), then=[[content(says), finish()]])


async def test_somebody_who_has_only_looked_has_nothing_stored_about_them(
    api: httpx2.AsyncClient, session: AsyncSession
) -> None:
    """Every read answers as an empty Traveler would, and none of them makes one."""
    reads = [
        await api.get("/api/conversations"),
        await api.get("/api/trips"),
        await api.get("/api/traveler/profile"),
        await api.get("/api/advisor/instructions"),
    ]

    assert [read.json() for read in reads[:3]] == [[], [], []]
    page = reads[3].json()
    assert page["instructions"] == DEFAULT_ADVISOR_INSTRUCTIONS
    assert page["version_id"] is None
    assert (await api.get(f"/api/conversations/{uuid.uuid4()}")).status_code == 404
    assert not any(GUEST_TOKEN_HEADER in read.headers for read in reads)
    assert await session.scalar(select(func.count()).select_from(Traveler)) == 0

    # The first write is what makes them a Guest, and hands over the token.
    started = await api.post("/api/conversations")
    assert GUEST_TOKEN_HEADER in started.headers
    assert await session.scalar(select(func.count()).select_from(Traveler)) == 1


async def test_two_guests_never_see_or_change_each_others_work(
    api: httpx2.AsyncClient,
    api_for: ApiFactory,
    settings: Settings,
    outbound_routes: dict[str, Responder],
) -> None:
    """Not by listing, and not by naming an identifier they were never given."""
    outbound_routes["openrouter.ai"] = _asking(
        ("set_destination", {"destination": "Lisbon"}),
        ("remember_profile_fact", {"subject": "nationality", "detail": "Croatian"}),
    )
    theirs = await start(api)
    await send(api, theirs, "Lisbon, on a Croatian passport.")
    await api.put("/api/advisor/instructions", json={"instructions": "Talk like a sailor.\n"})
    (trip,) = (await api.get("/api/trips")).json()
    (fact,) = (await api.get("/api/traveler/profile")).json()

    stranger = await api_for(settings)
    own = await start(stranger)

    assert [row["id"] for row in (await stranger.get("/api/conversations")).json()] == [own]
    assert (await stranger.get("/api/trips")).json() == []
    assert (await stranger.get("/api/traveler/profile")).json() == []
    page = (await stranger.get("/api/advisor/instructions")).json()
    assert page["instructions"] == DEFAULT_ADVISOR_INSTRUCTIONS
    assert "Lisbon" not in page["composed"]
    assert "Croatian" not in page["composed"]

    for method, url, body in [
        ("GET", f"/api/conversations/{theirs}", None),
        ("POST", f"/api/conversations/{theirs}/messages", {"content": "Hello?"}),
        ("PUT", f"/api/conversations/{theirs}/title", {"title": "Mine now"}),
        ("DELETE", f"/api/conversations/{theirs}", None),
        ("PUT", f"/api/conversations/{own}/trip", {"trip_id": trip["trip_id"]}),
        ("PATCH", f"/api/trips/{trip['trip_id']}", {"destination": "Porto"}),
        ("DELETE", f"/api/trips/{trip['trip_id']}?conversations=delete", None),
        ("DELETE", f"/api/traveler/profile/{fact['id']}", None),
        ("GET", f"/api/advisor/instructions?conversation_id={theirs}", None),
    ]:
        refused = await stranger.request(method, url, json=body)
        assert refused.status_code == 404, (method, url)

    await stranger.put("/api/advisor/instructions", json={"instructions": "Be terse.\n"})
    assert (await stranger.delete("/api/traveler/everything")).status_code == 204

    assert await transcript(api, theirs) == [
        ("traveler", "Lisbon, on a Croatian passport."),
        ("advisor", "Noted."),
    ]
    assert [plan["destination"] for plan in (await api.get("/api/trips")).json()] == ["Lisbon"]
    assert (await api.get("/api/traveler/profile")).json() == [fact]
    mine = (await api.get("/api/advisor/instructions")).json()
    assert mine["instructions"] == "Talk like a sailor.\n"


async def test_reading_the_instructions_records_nothing_until_the_first_turn(
    api: httpx2.AsyncClient, conversation: str, outbound_routes: dict[str, Responder]
) -> None:
    """The shipped default becomes a Prompt Version when a turn is composed from it,
    not when somebody looks at it."""
    for page in (
        await api.get("/api/advisor/instructions"),
        await api.get("/api/advisor/instructions", params={"conversation_id": conversation}),
    ):
        assert page.json()["version_id"] is None
        assert page.json()["is_default"] is True

    outbound_routes["openrouter.ai"] = CannedModel(content("Lisbon is lovely."), finish())
    await send(api, conversation, "Tell me about Lisbon.")

    shipped = (await api.get("/api/advisor/instructions")).json()["version_id"]
    assert shipped is not None
    assert [message["prompt_version_id"] for message in await messages(api, conversation)] == [
        None,
        shipped,
    ]
