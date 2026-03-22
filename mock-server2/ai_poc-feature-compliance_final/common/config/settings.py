"""
Product Comparison service configuration.

Loads from environment variables with sensible defaults.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Product comparison service settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # Application
    # -------------------------------------------------------------------------
    app_env: Literal["development", "staging", "production", "testing"] = "development"
    app_debug: bool = False
    app_log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # -------------------------------------------------------------------------
    # API
    # -------------------------------------------------------------------------
    app_name: str = "AI Services"
    app_version: str = "0.1.0"
    api_prefix: str = "/us/common/ai/v1"
    cors_origins: list[str] = ["*"]

    # -------------------------------------------------------------------------
    # Database (PDS - MySQL Aurora)
    # -------------------------------------------------------------------------
    pds_db_host: str = Field(..., description="PDS DB Host")
    pds_db_port: int = Field(3306, description="PDS DB Port")
    pds_db_user: str = Field(..., description="PDS DB User")
    pds_db_password: str = Field(..., description="PDS DB Password")
    pds_db_name: str = "product_data_store"
    pds_pool_size: int = Field(default=5, ge=1, le=20)
    pds_max_overflow: int = Field(default=10, ge=0, le=50)

    @computed_field
    @property
    def pds_database_url(self) -> str:
        """Build MySQL connection URL for PDS."""
        return (
            f"mysql+asyncmy://{self.pds_db_user}:{self.pds_db_password}"
            f"@{self.pds_db_host}:{self.pds_db_port}/{self.pds_db_name}"
        )

    # -------------------------------------------------------------------------
    # Database (AI - Postgres)
    # -------------------------------------------------------------------------
    ai_db_host: str = Field(..., description="AI DB Host")
    ai_db_port: int = 5432
    ai_db_user: str = Field(..., description="AI DB User")
    ai_db_password: str = Field(..., description="AI DB Password")
    ai_db_name: str = "ai_db"

    @computed_field
    @property
    def ai_database_url(self) -> str:
        """Build Postgres connection URL for AI DB."""
        return (
            f"postgresql+asyncpg://{self.ai_db_user}:{self.ai_db_password}"
            f"@{self.ai_db_host}:{self.ai_db_port}/{self.ai_db_name}"
        )

    # -------------------------------------------------------------------------
    # Redis (ElastiCache)
    # -------------------------------------------------------------------------
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str | None = None
    cache_ttl_seconds: int = Field(default=2592000, ge=60)  # 30 days == 86400 seconds per day * 30 days

    @computed_field
    @property
    def redis_url(self) -> str:
        """Build Redis connection URL."""
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"

    # -------------------------------------------------------------------------
    # Prompts
    # -------------------------------------------------------------------------
    prompt_version: str = "v1"  # Bump when prompts change to invalidate cache

    # -------------------------------------------------------------------------
    # LLM (LiteLLM or provider gateway)
    # -------------------------------------------------------------------------
    llm_model: str = "openai/us.anthropic.claude-3-5-haiku-20241022-v1:0"  # Override via env LLM_MODEL
    litellm_base_url: str | None = None  # Env: LITELLM_BASE_URL
    litellm_api_key: str | None = None  # Env: LITELLM_API_KEY
    llm_timeout_seconds: int = Field(default=30, ge=1, le=60)
    llm_max_tokens: int = Field(default=2048, ge=256, le=4096)
    llm_temperature: float = Field(default=0.3, ge=0.0, le=1.0)

    # -------------------------------------------------------------------------
    # Rate Limiting
    # -------------------------------------------------------------------------
    rate_limit_per_minute: int = Field(default=100, ge=1, le=1000)

    # -------------------------------------------------------------------------
    # SCM Dashboard DB (MySQL)
    # -------------------------------------------------------------------------
    scm_db_host: str = "localhost"
    scm_db_port: int = 3306
    scm_db_user: str = "scm_user"
    scm_db_password: str = "scm_password"
    scm_db_name: str = "ai_data_store"
    # scm_db_name: str = "scm_dashboard"

    @computed_field
    @property
    def scm_database_url(self) -> str:
        """Build PostgreSQL connection URL for SCM Dashboard DB."""
        return (
            f"postgresql+asyncpg://{self.scm_db_user}:{self.scm_db_password}"
            f"@{self.scm_db_host}:{self.scm_db_port}/{self.scm_db_name}"
        )

    # -------------------------------------------------------------------------
    # SSH Tunnel – AIC Bastion (to reach AIC DB, local only)
    # -------------------------------------------------------------------------
    sec_aic_bastion_host: str = ""
    sec_aic_bastion_port: int = 22
    sec_aic_bastion_username: str = ""
    sec_aic_bastion_private_key_path: str = "/app/keys/id_rsa"

    @computed_field
    @property
    def ssh_enabled(self) -> bool:
        """Check if SSH tunnel is configured."""
        return bool(self.sec_aic_bastion_host and self.sec_aic_bastion_username)

    # -------------------------------------------------------------------------
    # AIC DB (via SSH tunnel locally, direct in deployed envs)
    # -------------------------------------------------------------------------
    sec_aic_db_host: str = "127.0.0.1"
    sec_aic_db_port: int = 3306
    sec_aic_db_user: str = ""
    sec_aic_db_password: str = ""
    sec_aic_db_name: str = ""

    @computed_field
    @property
    def sec_aic_db_configured(self) -> bool:
        """Check if AIC DB credentials are provided."""
        return bool(self.sec_aic_db_user and self.sec_aic_db_name)

    def source_database_url(self, local_port: int) -> str:
        """Build MySQL connection URL using SSH tunnel's local forwarded port."""
        return (
            f"mysql+aiomysql://{self.sec_aic_db_user}:{self.sec_aic_db_password}"
            f"@127.0.0.1:{local_port}/{self.sec_aic_db_name}"
        )

    @computed_field
    @property
    def sec_aic_database_url(self) -> str:
        """Build MySQL connection URL for direct AIC DB access (no tunnel)."""
        return (
            f"mysql+aiomysql://{self.sec_aic_db_user}:{self.sec_aic_db_password}"
            f"@{self.sec_aic_db_host}:{self.sec_aic_db_port}/{self.sec_aic_db_name}"
        )

    # -------------------------------------------------------------------------
    # Magento DB (Temoporary)
    # -------------------------------------------------------------------------
    magento_db_host: str = "scm-postgres"
    magento_db_port: int = 5432
    magento_db_user: str = "scm_user"
    magento_db_password: str = "scm_password"
    magento_db_name: str = "scm_magento"

    @computed_field
    @property
    def magento_database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.magento_db_user}:{self.magento_db_password}"
            f"@{self.magento_db_host}:{self.magento_db_port}/{self.magento_db_name}"
        )
    
    # -------------------------------------------------------------------------
    # Computed Properties
    # -------------------------------------------------------------------------
    @computed_field
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.app_env == "production"

    @computed_field
    @property
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Settings are loaded once and cached. Call get_settings.cache_clear()
    to reload (useful for testing).
    """
    return Settings()
