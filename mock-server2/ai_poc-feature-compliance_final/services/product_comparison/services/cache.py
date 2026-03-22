from __future__ import annotations

import json
import time
from collections.abc import Iterable
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from common.config import get_logger, get_settings
from common.models.exceptions import ErrorCode, ServiceError

logger = get_logger(__name__)

_redis: Redis | None = None


def build_cache_key(
    store: str,
    locale: str,
    prompt_version: str,
    md_ids: Iterable[str],
) -> str:
    """
    Build a deterministic cache key.

    Format: compare:{store}:{locale}:{prompt_version}:{sorted_MD_ids}
    """
    sorted_ids = "|".join(sorted(str(x) for x in md_ids))
    return f"compare:{store}:{locale}:{prompt_version}:{sorted_ids}"


async def _get_client() -> Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        logger.info(
            "Initializing Redis client",
            extra={
                "event": "redis_init",
                "host": settings.redis_host,
                "port": settings.redis_port,
                "db": settings.redis_db,
            },
        )
        # Lazy-initialize a single Redis client; caller reuses it.
        _redis = Redis.from_url(settings.redis_url, decode_responses=False)
    return _redis


async def ping_redis() -> bool:
    """Simple connectivity check against Redis (returns True on success)."""
    start_time = time.perf_counter()
    try:
        client = await _get_client()
        await client.ping()
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.debug(
            "Redis ping successful",
            extra={"event": "redis_ping_success", "duration_ms": round(duration_ms, 2)},
        )
        return True
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            "Redis ping failed",
            extra={
                "event": "redis_ping_failed",
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        return False


async def get_comparison(cache_key: str) -> dict[str, Any] | None:
    """Fetch a cached comparison JSON payload, if present."""
    start_time = time.perf_counter()

    try:
        client = await _get_client()
        raw = await client.get(cache_key)
        duration_ms = (time.perf_counter() - start_time) * 1000

        if raw is None:
            logger.debug(
                "Cache miss",
                extra={
                    "event": "cache_miss",
                    "cache_key": cache_key,
                    "duration_ms": round(duration_ms, 2),
                },
            )
            return None

        try:
            data = json.loads(raw)
            logger.debug(
                "Cache hit",
                extra={
                    "event": "cache_hit",
                    "cache_key": cache_key,
                    "payload_size": len(raw),
                    "duration_ms": round(duration_ms, 2),
                },
            )
            return data
        except json.JSONDecodeError as e:
            logger.warning(
                "Cache data corrupt, treating as miss",
                extra={
                    "event": "cache_corrupt",
                    "cache_key": cache_key,
                    "error": str(e),
                    "duration_ms": round(duration_ms, 2),
                },
            )
            return None

    except RedisError as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        settings = get_settings()
        logger.error(
            "Cache get failed - Redis connection error",
            extra={
                "event": "cache_get_error",
                "cache_key": cache_key,
                "error_type": type(e).__name__,
                "error": str(e),
                "redis_host": settings.redis_host,
                "redis_port": settings.redis_port,
                "redis_db": settings.redis_db,
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            "Cache service unavailable",
            code=ErrorCode.SERVICE_CACHE_UNAVAILABLE,
            details={"cache_key": cache_key, "operation": "get"},
            original_error=e,
        ) from e
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        settings = get_settings()
        logger.error(
            "Cache get unexpected error",
            extra={
                "event": "cache_get_error",
                "cache_key": cache_key,
                "error_type": type(e).__name__,
                "error": str(e),
                "redis_host": settings.redis_host,
                "redis_port": settings.redis_port,
                "redis_db": settings.redis_db,
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            f"Cache get failed: {type(e).__name__}",
            code=ErrorCode.SERVICE_CACHE_UNAVAILABLE,
            details={"cache_key": cache_key, "operation": "get"},
            original_error=e,
        ) from e


async def set_comparison(cache_key: str, data: dict[str, Any], ttl: int | None = None) -> None:
    """Store a comparison JSON payload with TTL."""
    start_time = time.perf_counter()
    settings = get_settings()

    try:
        client = await _get_client()
        payload = json.dumps(data, ensure_ascii=False)
        expire = ttl if ttl is not None else settings.cache_ttl_seconds
        await client.set(cache_key, payload, ex=expire)

        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.debug(
            "Cache set successful",
            extra={
                "event": "cache_set",
                "cache_key": cache_key,
                "payload_size": len(payload),
                "ttl_seconds": expire,
                "duration_ms": round(duration_ms, 2),
            },
        )

    except RedisError as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            "Cache set failed",
            extra={
                "event": "cache_set_error",
                "cache_key": cache_key,
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            "Cache service unavailable",
            code=ErrorCode.SERVICE_CACHE_UNAVAILABLE,
            details={"cache_key": cache_key, "operation": "set"},
            original_error=e,
        ) from e
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            "Cache set unexpected error",
            extra={
                "event": "cache_set_error",
                "cache_key": cache_key,
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            f"Cache set failed: {type(e).__name__}",
            code=ErrorCode.SERVICE_CACHE_UNAVAILABLE,
            details={"cache_key": cache_key, "operation": "set"},
            original_error=e,
        ) from e
