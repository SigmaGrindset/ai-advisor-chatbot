"""A frontend on a host of its own, as a browser on its origin sees the API.

A browser asks before a request that carries the Guest token or a JSON body,
and refuses whatever the answer does not allow. So what is asserted is that
answer, and the headers a response must carry for the page to read it.
"""

import json

import pytest

from app.api.asking import GUEST_TOKEN_HEADER
from app.config import Settings

from .conftest import ApiFactory
from .fakes.canned_model import replying
from .fakes.canned_transport import Responder

FRONTEND = "https://advisor.example"


def _preflight(origin: str, method: str) -> dict[str, str]:
    """What a browser on `origin` sends before a request with both tokens and a body."""
    return {
        "Origin": origin,
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": f"authorization, content-type, {GUEST_TOKEN_HEADER}",
    }


async def test_a_frontend_on_an_allowed_origin_becomes_a_guest_and_holds_a_conversation(
    api_for: ApiFactory, settings: Settings, outbound_routes: dict[str, Responder]
) -> None:
    api = await api_for(settings.model_copy(update={"frontend_origins": [FRONTEND]}))
    api.headers["Origin"] = FRONTEND
    outbound_routes["openrouter.ai"] = replying("Lisbon is mild in April.")

    # Editing the Trip Plan by hand, the one kind of call a server refuses
    # from another origin unless it names the method.
    asked = await api.options("/api/trips/some-trip", headers=_preflight(FRONTEND, "PATCH"))
    assert asked.status_code == 200, asked.text
    assert asked.headers["access-control-allow-origin"] == FRONTEND

    started = await api.post("/api/conversations")
    assert started.headers["access-control-allow-origin"] == FRONTEND
    # Without this the page is handed the response but can never read the token.
    assert GUEST_TOKEN_HEADER.lower() in started.headers["access-control-expose-headers"].lower()
    assert GUEST_TOKEN_HEADER in started.headers

    conversation = started.json()["id"]
    async with api.stream(
        "POST", f"/api/conversations/{conversation}/messages", json={"content": "April?"}
    ) as turn:
        assert turn.headers["access-control-allow-origin"] == FRONTEND
        events = [
            json.loads(line.removeprefix("data: "))
            async for line in turn.aiter_lines()
            if line.startswith("data: ")
        ]
    replies = [event["message"] for event in events if event["type"] == "advisor_message"]
    assert [reply["content"] for reply in replies] == ["Lisbon is mild in April."]


@pytest.mark.parametrize("allowed", [[], [FRONTEND]], ids=["none configured", "another one"])
async def test_an_origin_that_is_not_configured_is_refused(
    api_for: ApiFactory, settings: Settings, allowed: list[str]
) -> None:
    api = await api_for(settings.model_copy(update={"frontend_origins": allowed}))
    elsewhere = "https://elsewhere.example"

    asked = await api.options("/api/conversations", headers=_preflight(elsewhere, "POST"))
    read = await api.get("/api/conversations", headers={"Origin": elsewhere})

    assert asked.status_code == 400
    assert "access-control-allow-origin" not in asked.headers
    assert "access-control-allow-origin" not in read.headers
