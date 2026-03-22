from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from tenacity import retry, retry_if_result, stop_after_attempt, wait_fixed

from common.config import Settings, get_logger, get_settings
from services.product_comparison.repositories.product import ping_db
from common.models.requests_pc import ComparisonRequest
from common.models.responses_pc import ComparisonResponse
from services.product_comparison.services.cache import ping_redis
from services.product_comparison.services.comparison import generate_comparison, generate_comparison_stream
from services.product_comparison.services.llm_client import ping_llm

logger = get_logger(__name__)
router = APIRouter(tags=["Product Compare"])


# -------------------------------------------------------------------------
# Health-check retry helpers
# -------------------------------------------------------------------------

_HEALTH_PING_MAX_ATTEMPTS = 3
_HEALTH_PING_WAIT_SECONDS = 0.5
_HEALTH_READY_TIMEOUT_SECONDS = 15.0


def _log_health_retry(retry_state) -> None:
    """Log retry attempts for health-check pings."""
    logger.warning(
        "Health ping returned unhealthy, retrying",
        extra={
            "event": "health_ping_retry",
            "dependency": retry_state.fn.__name__,
            "attempt": retry_state.attempt_number,
            "wait_seconds": (
                retry_state.next_action.sleep if retry_state.next_action else None
            ),
        },
    )


@retry(
    stop=stop_after_attempt(_HEALTH_PING_MAX_ATTEMPTS),
    wait=wait_fixed(_HEALTH_PING_WAIT_SECONDS),
    retry=retry_if_result(lambda result: result is False),
    before_sleep=_log_health_retry,
)
async def _ping_redis_with_retry() -> bool:
    return await ping_redis()


@retry(
    stop=stop_after_attempt(_HEALTH_PING_MAX_ATTEMPTS),
    wait=wait_fixed(_HEALTH_PING_WAIT_SECONDS),
    retry=retry_if_result(lambda result: result is False),
    before_sleep=_log_health_retry,
)
async def _ping_db_with_retry() -> bool:
    return await ping_db()


@retry(
    stop=stop_after_attempt(_HEALTH_PING_MAX_ATTEMPTS),
    wait=wait_fixed(_HEALTH_PING_WAIT_SECONDS),
    retry=retry_if_result(lambda result: result is False),
    before_sleep=_log_health_retry,
)
async def _ping_llm_with_retry() -> bool:
    return await ping_llm()


# -------------------------------------------------------------------------
# Health Check Routes
# -------------------------------------------------------------------------


@router.get("/health", summary="Shallow liveness check")
async def health(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """Lightweight liveness probe. Returns immediately without checking dependencies."""
    logger.debug("Health check requested")
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "env": settings.app_env,
        "status": "ok",
    }


@router.get("/health/ready", summary="Deep readiness check")
async def health_ready(settings: Settings = Depends(get_settings)) -> JSONResponse:
    """
    Deep readiness probe that verifies connectivity to all dependencies.

    Checks Redis, PDS (MySQL), and LLM provider concurrently with a 5-second
    timeout. Returns 200 if all are healthy, 503 if any dependency is down.

    Intended for use by load balancers and orchestrators (ALB, ECS, K8s)
    to determine if this instance can serve traffic.
    """
    start_time = time.perf_counter()
    logger.debug("Readiness check requested")

    # Run all dependency checks concurrently with a timeout
    try:
        redis_ok, pds_ok, llm_ok = await asyncio.wait_for(
            asyncio.gather(
                _ping_redis_with_retry(),
                _ping_db_with_retry(),
                _ping_llm_with_retry(),
                return_exceptions=True,
            ),
            timeout=_HEALTH_READY_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            "Readiness check timed out",
            extra={"event": "readiness_timeout", "duration_ms": round(duration_ms, 2)},
        )
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "dependencies": {
                    "redis": "timeout",
                    "pds": "timeout",
                    "llm": "timeout",
                },
                "duration_ms": round(duration_ms, 2),
            },
        )

    # If gather returned an exception instead of a bool, treat as failure
    if isinstance(redis_ok, BaseException):
        logger.error("Redis health check raised", extra={"error": str(redis_ok)})
        redis_ok = False
    if isinstance(pds_ok, BaseException):
        logger.error("PDS health check raised", extra={"error": str(pds_ok)})
        pds_ok = False
    if isinstance(llm_ok, BaseException):
        logger.error("LLM health check raised", extra={"error": str(llm_ok)})
        llm_ok = False

    all_ok = redis_ok and pds_ok and llm_ok
    duration_ms = (time.perf_counter() - start_time) * 1000

    dependencies = {
        "redis": "ok" if redis_ok else "unavailable",
        "pds": "ok" if pds_ok else "unavailable",
        "llm": "ok" if llm_ok else "unavailable",
    }

    if all_ok:
        logger.info(
            "Readiness check passed",
            extra={
                "event": "readiness_ok",
                "dependencies": dependencies,
                "duration_ms": round(duration_ms, 2),
            },
        )
    else:
        logger.warning(
            "Readiness check failed",
            extra={
                "event": "readiness_failed",
                "dependencies": dependencies,
                "duration_ms": round(duration_ms, 2),
            },
        )

    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={
            "status": "ok" if all_ok else "degraded",
            "version": settings.app_version,
            "dependencies": dependencies,
            "duration_ms": round(duration_ms, 2),
        },
    )


# -------------------------------------------------------------------------
# Comparison Routes
# -------------------------------------------------------------------------


@router.post(
    "/products/summary",
    summary="Generate AI product comparison summary",
)
async def compare_products_summary(
    req: ComparisonRequest,
    request: Request,
    force_refresh: bool = Query(
        default=False,
        description="Bypass cache and force a fresh LLM generation",
    ),
) -> ComparisonResponse:
    logger.info(
        "Product comparison request received",
        extra={
            "event": "comparison_request",
            "product_count": len(req.products),
            "product_ids": req.products,
            "force_refresh": force_refresh,
        },
    )

    response = await generate_comparison(req, skip_cache=force_refresh)

    logger.info(
        "Product comparison completed",
        extra={
            "event": "comparison_response",
            "product_count": len(req.products),
            "status": response.status,
        },
    )

    return response


class ExportResponse(ComparisonResponse):
    file_path: str | None = None


def _build_export_filename(product_ids: list[str]) -> str:
    ts = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    # Limit to first 4 IDs and sanitize somewhat for filename
    ids_str = "_".join(product_ids[:4])
    return f"comparison_{ts}_{ids_str}.json"


@router.post(
    "/products/summary/export",
    summary="Generate AI product comparison and save to file",
)
async def compare_products_summary_export(
    req: ComparisonRequest,
    request: Request,
    force_refresh: bool = Query(
        default=False,
        description="Bypass cache and force a fresh LLM generation",
    ),
) -> ExportResponse:
    # 1. Run standard comparison
    response = await generate_comparison(req, skip_cache=force_refresh)

    # 2. Build file path
    # Go up from api/routes.py to root, then to outputs
    outputs_dir = Path(__file__).resolve().parents[1] / "outputs"
    outputs_dir.mkdir(exist_ok=True)

    filename = _build_export_filename(req.products)
    file_path = outputs_dir / filename

    # 3. Write to file
    final_path_str = None
    try:
        # Use model_dump(mode="json") to handle datetime/enums if any
        file_path.write_text(
            json.dumps(response.model_dump(mode="json"), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        final_path_str = str(file_path)
        logger.info("Comparison exported", extra={"file_path": final_path_str})
    except Exception as e:
        logger.error("Failed to write export file", extra={"error": str(e)})
        # We don't fail the request, just return no file path

    # 4. Return extended response
    # We must construct ExportResponse from the data in 'response'
    return ExportResponse(**response.model_dump(), file_path=final_path_str)


@router.post(
    "/products/summary/stream",
    summary="Generate AI product comparison summary with streaming response",
)
async def compare_products_summary_stream(
    req: ComparisonRequest,
    request: Request,
    force_refresh: bool = Query(
        default=False,
        description="Bypass cache and force a fresh LLM generation",
    ),
) -> StreamingResponse:
    logger.info(
        "Streaming product comparison request received",
        extra={
            "event": "streaming_comparison_request",
            "product_count": len(req.products),
            "product_ids": req.products,
            "force_refresh": force_refresh,
        },
    )

    return StreamingResponse(
        generate_comparison_stream(req, skip_cache=force_refresh),
        media_type="text/event-stream",
    )
