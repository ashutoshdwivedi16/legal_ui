"""LLM service configuration."""
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class LLMSettings(BaseSettings):
    """LLM settings."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")

    # LiteLLM settings (matches env vars from secret.yaml)
    llm_model: str = Field(default="openai/us.anthropic.claude-3-5-haiku-20241022-v1:0", description="LLM Model")
    litellm_api_key: str | None = Field(default=None, description="LiteLLM API Key")
    litellm_base_url: str | None = Field(default=None, description="LiteLLM Base URL")


@lru_cache
def get_llm_settings() -> LLMSettings:
    return LLMSettings()


settings = get_llm_settings()
