"""Application configuration, read from the environment."""

from pathlib import Path

from fastapi import Request
from pydantic_settings import BaseSettings, SettingsConfigDict

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


def get_settings(request: Request) -> Settings:
    """The settings of the running application, for use as a FastAPI dependency."""
    settings: Settings = request.app.state.settings
    return settings
