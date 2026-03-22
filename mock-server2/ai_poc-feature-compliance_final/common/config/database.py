"""Database configuration."""
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """Database settings."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")

    # Database connection components (matches AI_DB_* env vars from secret.yaml)
    ai_db_host: str = Field(default="localhost", description="AI DB Host")
    ai_db_port: int = Field(default=5432, description="AI DB Port")
    ai_db_user: str = Field(default="postgres", description="AI DB User")
    ai_db_password: str = Field(default="postgres", description="AI DB Password")
    ai_db_name: str = Field(default="ai_db", description="AI DB Name")

    # Other settings
    echo_sql: bool = False

    def get_database_url(self) -> str:
        """Build database URL from components."""
        return f"postgresql+asyncpg://{self.ai_db_user}:{self.ai_db_password}@{self.ai_db_host}:{self.ai_db_port}/{self.ai_db_name}"


@lru_cache
def get_db_settings() -> DatabaseSettings:
    return DatabaseSettings()


settings = get_db_settings()
