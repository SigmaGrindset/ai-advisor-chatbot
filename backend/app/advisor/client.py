"""The OpenRouter model client, built on the shared outbound HTTP client."""

import httpx2
from openai import AsyncOpenAI

from ..config import Settings


class OpenRouterKeyMissing(Exception):
    """Raised when a turn needs the model but no OpenRouter key is configured.

    Deliberately raised on use rather than at startup: the application must start
    without a key so that the interface can explain the problem.
    """


def create_model_client(http_client: httpx2.AsyncClient, settings: Settings) -> AsyncOpenAI:
    if not settings.openrouter_api_key:
        raise OpenRouterKeyMissing("OPENROUTER_API_KEY is not set")
    return AsyncOpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        http_client=http_client,
    )

