"""The one seam: every outbound call, including the model's, leaves through the
application's injectable HTTP client."""

import httpx2
import pytest

from app.config import Settings
from app.model import OpenRouterKeyMissing, create_model_client

from .canned_transport import Responder, UnroutedHost

CANNED_COMPLETION = {
    "id": "gen-1",
    "object": "chat.completion",
    "created": 1,
    "model": "test/model",
    "choices": [
        {
            "index": 0,
            "message": {"role": "assistant", "content": "Lisbon is mild in April."},
            "finish_reason": "stop",
        }
    ],
    "usage": {"prompt_tokens": 12, "completion_tokens": 7, "total_tokens": 19},
}


async def test_the_model_client_sends_through_the_applications_outbound_client(
    http_client: httpx2.AsyncClient,
    outbound_routes: dict[str, Responder],
    settings: Settings,
) -> None:
    sent: list[httpx2.Request] = []

    def respond(request: httpx2.Request) -> httpx2.Response:
        sent.append(request)
        return httpx2.Response(200, json=CANNED_COMPLETION)

    outbound_routes["openrouter.ai"] = respond

    model = create_model_client(http_client, settings)
    completion = await model.chat.completions.create(
        model="test/model", messages=[{"role": "user", "content": "What is Lisbon like in April?"}]
    )

    assert completion.choices[0].message.content == "Lisbon is mild in April."
    assert str(sent[0].url) == "https://openrouter.ai/api/v1/chat/completions"


async def test_a_host_with_no_canned_response_is_refused_rather_than_called(
    http_client: httpx2.AsyncClient,
) -> None:
    with pytest.raises(UnroutedHost):
        await http_client.get("https://api.open-meteo.com/v1/forecast")


async def test_a_missing_key_is_reported_when_the_model_is_needed_not_at_startup(
    http_client: httpx2.AsyncClient, settings: Settings
) -> None:
    without_key = settings.model_copy(update={"openrouter_api_key": None})

    with pytest.raises(OpenRouterKeyMissing):
        create_model_client(http_client, without_key)
