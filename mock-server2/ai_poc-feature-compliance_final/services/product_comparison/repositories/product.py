from __future__ import annotations

import time
from collections.abc import Iterable
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_fixed

from common.config import get_logger, get_settings
from common.models.exceptions import ErrorCode, ServiceError

logger = get_logger(__name__)

_engine: AsyncEngine | None = None


async def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        settings = get_settings()
        logger.info(
            "Initializing PDS database engine",
            extra={
                "event": "pds_engine_init",
                "host": settings.pds_db_host,
                "database": settings.pds_db_name,
                "pool_size": settings.pds_pool_size,
                "max_overflow": settings.pds_max_overflow,
            },
        )
        _engine = create_async_engine(
            settings.pds_database_url,
            pool_size=settings.pds_pool_size,
            max_overflow=settings.pds_max_overflow,
        )
    return _engine


async def ping_db() -> bool:
    """Simple connectivity check against PDS (returns True on success)."""
    engine = await get_engine()
    start_time = time.perf_counter()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.debug(
            "PDS ping successful",
            extra={"event": "pds_ping_success", "duration_ms": round(duration_ms, 2)},
        )
        return True
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            "PDS ping failed",
            extra={
                "event": "pds_ping_failed",
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        return False


# Retryable PDS errors – transient DB connectivity issues only
_RETRYABLE_PDS_ERRORS = (SQLAlchemyError, ConnectionError, OSError)


def _log_pds_retry(retry_state) -> None:
    """Log retry attempts for PDS calls."""
    exception = retry_state.outcome.exception() if retry_state.outcome else None
    logger.warning(
        "PDS fetch failed, retrying",
        extra={
            "event": "pds_retry",
            "attempt": retry_state.attempt_number,
            "error_type": type(exception).__name__ if exception else None,
            "error": str(exception) if exception else None,
            "wait_seconds": retry_state.next_action.sleep if retry_state.next_action else None,
        },
    )


@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_fixed(0.1),  # 100ms – minimal delay for latency-sensitive path
    retry=retry_if_exception_type(_RETRYABLE_PDS_ERRORS),
    before_sleep=_log_pds_retry,
)
async def _execute_pds_query(engine: AsyncEngine, sql, ids_tuple: tuple) -> list[dict[str, Any]]:
    """Execute the PDS query with tenacity retries for transient errors.

    Raw exceptions are allowed to propagate so tenacity can inspect and
    retry them.  The caller (fetch_products_by_md_ids) wraps final
    failures into ServiceError.
    """
    async with engine.connect() as conn:
        result = await conn.execute(sql, {"ids": ids_tuple})
        rows = result.mappings().all()
        return [dict(row) for row in rows]


async def fetch_products_by_md_ids(md_ids: Iterable[str]) -> list[dict[str, Any]]:
    """
    Fetch product details from PDS by MD IDs.

    Returns minimal fields for prompting; extend as needed.
    Retries up to 3 times (100 ms apart) on transient DB errors.
    """
    ids_tuple = tuple(md_ids)
    if not ids_tuple:
        logger.debug("Empty product IDs list, returning empty result")
        return []

    logger.debug(
        "Fetching products from PDS",
        extra={
            "event": "pds_fetch_start",
            "product_ids": list(ids_tuple),
            "count": len(ids_tuple),
        },
    )

    engine = await get_engine()
    start_time = time.perf_counter()

    sql = text(
        """
        SELECT
            pm.sku as modelSku,
            REPLACE(JSON_UNQUOTE(JSON_EXTRACT(pc.product_common_attributes, '$.common_user_friendly_name_identifier')), '\\'', '') AS name,
            pc.category,
            pmetas.product_group_attributes AS specs
        FROM product_master pm
        LEFT JOIN product_common pc ON pm.product_id = pc.product_id
        LEFT JOIN product_metas pmetas ON pm.product_id = pmetas.product_id AND pmetas.meta_type = \'spec\'
        WHERE pm.product_id IN :ids
        """
    ).bindparams(bindparam("ids", expanding=True))

    try:
        products = await _execute_pds_query(engine, sql, ids_tuple)

        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "Products fetched from PDS",
            extra={
                "event": "pds_fetch_complete",
                "requested_count": len(ids_tuple),
                "returned_count": len(products),
                "duration_ms": round(duration_ms, 2),
            },
        )
        return products

    except SQLAlchemyError as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        settings = get_settings()
        logger.error(
            "PDS database error - connection failed",
            extra={
                "event": "pds_fetch_error",
                "product_ids": list(ids_tuple),
                "error_type": type(e).__name__,
                "error": str(e),
                "pds_host": settings.pds_db_host,
                "pds_port": settings.pds_db_port,
                "pds_database": settings.pds_db_name,
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            "Product database unavailable",
            code=ErrorCode.SERVICE_PDS_UNAVAILABLE,
            details={"product_ids": list(ids_tuple)},
            original_error=e,
        ) from e
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        settings = get_settings()
        logger.error(
            "PDS fetch failed - unexpected error",
            extra={
                "event": "pds_fetch_error",
                "product_ids": list(ids_tuple),
                "error_type": type(e).__name__,
                "error": str(e),
                "pds_host": settings.pds_db_host,
                "pds_port": settings.pds_db_port,
                "pds_database": settings.pds_db_name,
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            f"Product fetch failed: {type(e).__name__}",
            code=ErrorCode.SERVICE_PDS_UNAVAILABLE,
            details={"product_ids": list(ids_tuple)},
            original_error=e,
        ) from e
