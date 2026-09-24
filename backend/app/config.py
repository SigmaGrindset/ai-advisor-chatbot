"""Application configuration, read from the environment."""

from pathlib import Path
from typing import Annotated

from fastapi import Request
from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# The checkout root, for the development defaults below. The container passes
# configuration as environment variables and sets STATIC_DIR explicitly.
_CHECKOUT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Everything the application needs to know about its surroundings.

    A missing OpenRouter key is a valid configuration: the application starts
    and says so, rather than refusing to boot.
    """

    model_config = SettingsConfigDict(env_file=_CHECKOUT_ROOT / ".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://travel:travel@localhost:5432/travel_advisor"
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    #: The model the traveler actually talks to.
    conversation_model: str = "anthropic/claude-sonnet-5"
    #: The cheaper model behind the work the traveler does not see — Conversation
    #: titles, Compaction summaries, and the nested web search.
    utility_model: str = "anthropic/claude-haiku-4.5"
    static_dir: Path = _CHECKOUT_ROOT / "frontend" / "dist"
    #: The origins the frontend is served from, comma-separated in the
    #: environment. A frontend on a host of its own may call the API from these,
    #: and a Clerk session token is only accepted if it was issued to one of
    #: them. None by default: the combined image serves the frontend on the
    #: API's own origin, which needs no CORS, but with Accounts on it lists
    #: that origin here too.
    frontend_origins: Annotated[list[str], NoDecode] = []
    #: The Clerk instance's public key, as PEM, which session tokens are checked
    #: against offline. Accounts need it and the secret key; without both,
    #: everyone is a Guest.
    clerk_public_key: str | None = None
    #: For Clerk's Backend API.
    clerk_secret_key: str | None = None

    @field_validator("clerk_public_key", mode="before")
    @classmethod
    def _unescaped(cls, value: object) -> object:
        # A PEM spans lines, which a one-line environment field often holds as
        # a literal "\n".
        if isinstance(value, str):
            return value.replace("\\n", "\n")
        return value

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def _listed(cls, value: object) -> object:
        # A browser never sends an origin with a trailing slash, so one pasted
        # with it would match nothing and fail silently.
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value


def get_settings(request: Request) -> Settings:
    """The settings of the running application, for use as a FastAPI dependency."""
    settings: Settings = request.app.state.settings
    return settings
