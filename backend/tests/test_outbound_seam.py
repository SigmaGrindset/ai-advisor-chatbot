"""The one seam: every outbound call, including the model's, leaves through the
application's injectable HTTP client."""

import httpx2
import pytest

from app.advisor.client import OpenRouterKeyMissing, create_model_client
from app.config import Settings

from .fakes.canned_transport import Responder

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


async def test_a_missing_key_is_reported_when_the_model_is_needed_not_at_startup(
    http_client: httpx2.AsyncClient, settings: Settings
) -> None:
    without_key = settings.model_copy(update={"openrouter_api_key": None})

    with pytest.raises(OpenRouterKeyMissing):
        create_model_client(http_client, without_key)
