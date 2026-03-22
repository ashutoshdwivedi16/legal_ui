from __future__ import annotations

from typing import Any

from fastapi import Depends

from common.config import Settings, get_settings


async def get_redis(settings: Settings = Depends(get_settings)) -> Any:
    """Dependency to get Redis client."""
    from services.product_comparison.services.cache import _get_client

    return await _get_client()


async def get_db(settings: Settings = Depends(get_settings)) -> Any:
    """Dependency to get DB session (Placeholder for now)."""
    # In a real app, this would yield a SQLAlchemy AsyncSession
    return None


async def get_llm_client(settings: Settings = Depends(get_settings)) -> Any:
    """Dependency to get LLM client."""
    from services.product_comparison.services import llm_client

    return llm_client
