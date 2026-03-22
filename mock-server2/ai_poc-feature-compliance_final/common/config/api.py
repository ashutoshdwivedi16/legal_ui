"""API configuration."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class APISettings(BaseSettings):
    """API settings."""
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")
    
    # Application metadata (hardcoded)
    app_name: str = "KPI Monitor API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"


@lru_cache
def get_api_settings() -> APISettings:
    return APISettings()


settings = get_api_settings()
