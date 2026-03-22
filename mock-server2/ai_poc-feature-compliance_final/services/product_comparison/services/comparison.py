from __future__ import annotations

import time
from collections.abc import AsyncIterator, Callable, Iterable
from typing import Any

from common.config import get_logger, get_settings
from services.product_comparison.repositories.product import fetch_products_by_md_ids
from common.models.requests_pc import ComparisonRequest
from common.models.responses_pc import ComparisonResponse, ComparisonSummary
from services.product_comparison.services import cache as cache_svc
from services.product_comparison.services import llm_client
from services.product_comparison.services.prompt_manager import (
    build_user_prompt,
    load_prompts,
    resolve_category,
)
from common.lib.validation.input import validate_request as guard_validate_request
from common.lib.validation.output import (
    check_no_hallucinations,
    check_output_structure,
    check_prohibited_terms,
    reorder_quick_picks,
)

logger = get_logger(__name__)


def _products_same_category(products: list[dict[str, Any]]) -> tuple[bool, str | None]:
    cats = {resolve_category(p.get("category")) for p in products if p.get("category") is not None}
    # if len(cats) != 1:
    #     return False, "CATEGORY_MISMATCH"
    return True, next(iter(cats)) if cats else None


async def generate_comparison(
    request: ComparisonRequest,
    *,
    skip_cache: bool = False,
    cache_get: Callable[[str], Any] = cache_svc.get_comparison,
    cache_set: Callable[[str, dict, int | None], Any] = cache_svc.set_comparison,
    product_fetch: Callable[[Iterable[str]], Any] = fetch_products_by_md_ids,
    prompts_loader: Callable[[str], Any] = load_prompts,
    llm_generate: Callable[..., Any] = llm_client.generate,
) -> ComparisonResponse:
    settings = get_settings()
    start_time = time.perf_counter()

    # Hardcoded for now
    store = "OBS"
    locale = "en-US"

    logger.debug(
        "Starting comparison generation",
        extra={
            "event": "comparison_start",
            "product_ids": request.products,
            "store": store,
            "locale": locale,
        },
    )

    # 1. Validate input (raises ValidationError if invalid)
    await guard_validate_request(request)

    # 2. Build cache key
    cache_key = cache_svc.build_cache_key(
        store, locale, settings.prompt_version, request.products
    )
    logger.debug("Cache key built", extra={"cache_key": cache_key})

    # 3. Check cache (unless skip_cache is True)
    cached = None
    if not skip_cache:
        try:
            cached = await cache_get(cache_key)
        except Exception as e:
            logger.warning(
                "Cache lookup failed",
                extra={"event": "cache_error", "error": str(e)},
            )
            cached = None
    else:
        logger.debug(
            "Cache bypass requested",
            extra={"event": "cache_skip", "cache_key": cache_key},
        )

    if cached:
        try:
            summary = ComparisonSummary.model_validate(cached)
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.info(
                "Cache hit - returning cached comparison",
                extra={
                    "event": "cache_hit",
                    "cache_key": cache_key,
                    "duration_ms": round(duration_ms, 2),
                },
            )
            return ComparisonResponse(summary=summary, status="SUCCESS")
        except Exception as e:
            logger.warning(
                "Cached data validation failed",
                extra={"event": "cache_validation_error", "error": str(e)},
            )
            cached = None

    logger.debug("Cache miss - proceeding with generation", extra={"cache_key": cache_key})

    # 4. Fetch products from PDS
    pds_start = time.perf_counter()
    try:
        products = await product_fetch(request.products)
        pds_duration_ms = (time.perf_counter() - pds_start) * 1000
        logger.info(
            "Products fetched from PDS",
            extra={
                "event": "pds_fetch_complete",
                "product_count": len(products) if products else 0,
                "duration_ms": round(pds_duration_ms, 2),
            },
        )
    except Exception as e:
        pds_duration_ms = (time.perf_counter() - pds_start) * 1000
        logger.error(
            "PDS fetch failed",
            extra={
                "event": "pds_error",
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(pds_duration_ms, 2),
            },
        )
        return ComparisonResponse(summary=None, status="ERROR")

    if not products or len(products) != len(request.products):
        logger.warning(
            "Product not found or count mismatch",
            extra={
                "event": "product_not_found",
                "requested_count": len(request.products),
                "found_count": len(products) if products else 0,
            },
        )
        return ComparisonResponse(summary=None, status="UNAVAILABLE")

    # 5. Validate same category
    same_cat, cat_or_reason = _products_same_category(products)
    if not same_cat:
        logger.warning(
            "Category mismatch detected",
            extra={"event": "category_mismatch", "reason": cat_or_reason},
        )
        return ComparisonResponse(summary=None, status="UNAVAILABLE")
    category: str = cat_or_reason or "unknown"

    # 6. Get prompt templates
    try:
        prompts = await prompts_loader(category)
    except Exception as e:
        logger.error(
            "Prompt loading failed",
            extra={
                "event": "prompt_error",
                "category": category,
                "error": str(e),
            },
        )
        prompts = None

    if not prompts:
        logger.warning(
            "Prompt template not found",
            extra={"event": "prompt_not_found", "category": category},
        )
        return ComparisonResponse(summary=None, status="UNAVAILABLE")

    system_prompt, user_template, category_addendum = prompts
    user_prompt = build_user_prompt(
        user_template, products=products, category=category, category_addendum=category_addendum
    )
    logger.debug(
        "Prompts prepared",
        extra={
            "category": category,
            "system_prompt_length": len(system_prompt),
            "user_prompt_length": len(user_prompt),
        },
    )

    # 7. Call LLM
    llm_start = time.perf_counter()
    try:
        res = await llm_generate(system_prompt, user_prompt)
        llm_duration_ms = (time.perf_counter() - llm_start) * 1000
        logger.info(
            "LLM generation completed",
            extra={
                "event": "llm_complete",
                "model": res.get("model") if isinstance(res, dict) else None,
                "prompt_tokens": res.get("prompt_tokens") if isinstance(res, dict) else None,
                "completion_tokens": res.get("completion_tokens")
                if isinstance(res, dict)
                else None,
                "duration_ms": round(llm_duration_ms, 2),
            },
        )
    except Exception as e:
        llm_duration_ms = (time.perf_counter() - llm_start) * 1000
        logger.error(
            "LLM generation failed",
            extra={
                "event": "llm_error",
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(llm_duration_ms, 2),
            },
        )
        return ComparisonResponse(summary=None, status="ERROR")

    # 8. Validate/parse output
    parsed = res.get("parsed_json") if isinstance(res, dict) else None
    raw_text = res.get("raw_text", "") if isinstance(res, dict) else None

    if not parsed:
        logger.warning(
            "LLM response parsing failed",
            extra={
                "event": "parse_error",
                "raw_text_length": len(raw_text) if raw_text else 0,
            },
        )
        return ComparisonResponse(summary=None, status="ERROR")

    ok, reason = check_output_structure(parsed)
    if not ok:
        logger.warning(
            "Output structure validation failed",
            extra={"event": "structure_validation_failed", "reason": reason},
        )
        return ComparisonResponse(summary=None, status="ERROR")

    try:
        summary = ComparisonSummary.model_validate(parsed)
    except Exception as e:
        logger.warning(
            "Schema validation failed",
            extra={"event": "schema_validation_failed", "error": str(e)},
        )
        return ComparisonResponse(summary=None, status="ERROR")

    ok, reason = check_prohibited_terms(summary)
    if not ok:
        logger.warning(
            "Prohibited terms detected",
            extra={"event": "guardrail_violation", "reason": reason},
        )
        return ComparisonResponse(summary=None, status="ERROR")

    ok, reason = check_no_hallucinations(summary, expected_model_ids=list(request.products))
    if not ok:
        logger.warning(
            "Hallucination detected",
            extra={"event": "hallucination_detected", "reason": reason},
        )
        return ComparisonResponse(summary=None, status="ERROR")

    # 8b. Reorder quickPick entries to match request product order
    summary = reorder_quick_picks(summary, expected_model_ids=list(request.products))

    # 9. Cache result
    try:
        await cache_set(cache_key, summary.model_dump(), None)
        logger.debug("Result cached successfully", extra={"cache_key": cache_key})
    except Exception as e:
        logger.warning(
            "Cache write failed",
            extra={"event": "cache_write_error", "error": str(e)},
        )

    # 10. Return
    total_duration_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        "Comparison generation completed successfully",
        extra={
            "event": "comparison_complete",
            "total_duration_ms": round(total_duration_ms, 2),
            "category": category,
            "product_count": len(request.products),
        },
    )
    return ComparisonResponse(summary=summary, status="SUCCESS")


async def generate_comparison_stream(
    request: ComparisonRequest,
    *,
    skip_cache: bool = False,
    cache_get: Callable[[str], Any] = cache_svc.get_comparison,
    cache_set: Callable[[str, dict, int | None], Any] = cache_svc.set_comparison,
    product_fetch: Callable[[Iterable[str]], Any] = fetch_products_by_md_ids,
    prompts_loader: Callable[[str], Any] = load_prompts,
) -> AsyncIterator[str]:
    """
    Stream a product comparison response as SSE events.

    Each chunk is formatted as: data: {"content": "..."}\n\n
    Errors are formatted as: data: {"error": "..."}\n\n

    On cache hit, the cached JSON response is streamed back as a single SSE
    content event. On cache miss, the LLM response is streamed in real time
    and the full response is cached after streaming completes.

    Note: Output guardrails are not applied during streaming since we can't
    validate partial responses. Use the non-streaming endpoint if you need
    these features.
    """
    import json

    settings = get_settings()
    start_time = time.perf_counter()

    # Hardcoded for now
    store = "OBS"
    locale = "en-US"

    logger.debug(
        "Starting streaming comparison",
        extra={
            "event": "streaming_start",
            "product_ids": request.products,
            "store": store,
            "locale": locale,
        },
    )

    def _error_event(error: str, detail: str | None = None) -> str:
        payload = {"error": error}
        if detail:
            payload["detail"] = detail
        return f"data: {json.dumps(payload)}\n\n"

    # 1. Validate input (raises ValidationError if invalid)
    # For streaming, we let the exception propagate - global handler will catch it
    await guard_validate_request(request)

    # 2. Build cache key and check cache
    cache_key = cache_svc.build_cache_key(
        store, locale, settings.prompt_version, request.products
    )

    if not skip_cache:
        try:
            cached = await cache_get(cache_key)
        except Exception as e:
            logger.warning(
                "Cache lookup failed during streaming",
                extra={"event": "streaming_cache_error", "error": str(e)},
            )
            cached = None

        if cached:
            try:
                # Validate cached data before streaming it back
                summary = ComparisonSummary.model_validate(cached)
                duration_ms = (time.perf_counter() - start_time) * 1000
                logger.info(
                    "Cache hit - streaming cached comparison",
                    extra={
                        "event": "streaming_cache_hit",
                        "cache_key": cache_key,
                        "duration_ms": round(duration_ms, 2),
                    },
                )
                # Stream the cached response wrapped in ComparisonResponse structure
                response = ComparisonResponse(summary=summary, status="SUCCESS")
                cached_json = json.dumps(response.model_dump(), ensure_ascii=False)
                yield f"data: {json.dumps({'content': cached_json})}\n\n"
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                logger.warning(
                    "Cached data validation failed during streaming",
                    extra={"event": "streaming_cache_validation_error", "error": str(e)},
                )
    else:
        logger.debug(
            "Cache bypass requested for streaming",
            extra={"event": "streaming_cache_skip", "cache_key": cache_key},
        )

    # 3. Fetch products from PDS
    pds_start = time.perf_counter()
    try:
        products = await product_fetch(request.products)
        pds_duration_ms = (time.perf_counter() - pds_start) * 1000
        logger.info(
            "Products fetched for streaming",
            extra={
                "event": "streaming_pds_complete",
                "product_count": len(products) if products else 0,
                "duration_ms": round(pds_duration_ms, 2),
            },
        )
    except Exception as e:
        pds_duration_ms = (time.perf_counter() - pds_start) * 1000
        logger.error(
            "PDS fetch failed during streaming",
            extra={
                "event": "streaming_pds_error",
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(pds_duration_ms, 2),
            },
        )
        yield _error_event("PDS_UNAVAILABLE")
        return

    if not products or len(products) != len(request.products):
        logger.warning(
            "Product not found during streaming",
            extra={
                "event": "streaming_product_not_found",
                "requested_count": len(request.products),
                "found_count": len(products) if products else 0,
            },
        )
        yield _error_event("PRODUCT_NOT_FOUND")
        return

    # 4. Validate same category
    same_cat, cat_or_reason = _products_same_category(products)
    if not same_cat:
        logger.warning(
            "Category mismatch during streaming",
            extra={"event": "streaming_category_mismatch", "reason": cat_or_reason},
        )
        yield _error_event(cat_or_reason or "CATEGORY_ERROR")
        return
    category: str = cat_or_reason or "unknown"

    # 5. Get prompt templates
    try:
        prompts = await prompts_loader(category)
    except Exception as e:
        logger.error(
            "Prompt loading failed during streaming",
            extra={
                "event": "streaming_prompt_error",
                "category": category,
                "error": str(e),
            },
        )
        prompts = None

    if not prompts:
        logger.warning(
            "Prompt not found during streaming",
            extra={"event": "streaming_prompt_not_found", "category": category},
        )
        yield _error_event("PROMPT_NOT_FOUND")
        return

    system_prompt, user_template, category_addendum = prompts
    user_prompt = build_user_prompt(
        user_template, products=products, category=category, category_addendum=category_addendum
    )

    logger.debug(
        "Starting LLM stream",
        extra={
            "event": "streaming_llm_start",
            "category": category,
            "system_prompt_length": len(system_prompt),
            "user_prompt_length": len(user_prompt),
        },
    )

    # 6. Stream LLM response wrapped in ComparisonResponse structure
    #    The LLM outputs a raw ComparisonSummary JSON object. We wrap it by
    #    injecting '{"summary":' before the first LLM token and
    #    ',"status":"SUCCESS"}' after the last, so the client assembles a
    #    complete ComparisonResponse-shaped object.
    llm_start = time.perf_counter()
    chunk_count = 0
    accumulated_content: list[str] = []
    stream_error = False

    # Emit the opening wrapper before any LLM tokens
    yield f"data: {json.dumps({'content': '{\"summary\":'})}\n\n"

    try:
        async for chunk in llm_client.generate_stream(system_prompt, user_prompt):
            # The final [DONE] sentinel from llm_client is held back; we need
            # to append the closing wrapper before it.
            if "data: [DONE]" in chunk:
                continue

            chunk_count += 1
            yield chunk

            # Extract content from SSE chunk for caching
            # Chunks are formatted as: data: {"content": "..."}\n\n
            if chunk.startswith("data: "):
                try:
                    chunk_data = json.loads(chunk[6:].strip())
                    if "content" in chunk_data:
                        accumulated_content.append(chunk_data["content"])
                except (json.JSONDecodeError, KeyError):
                    pass
    except Exception as e:
        llm_duration_ms = (time.perf_counter() - llm_start) * 1000
        logger.error(
            "Streaming LLM error",
            extra={
                "event": "streaming_llm_error",
                "error_type": type(e).__name__,
                "error": str(e),
                "chunks_sent": chunk_count,
                "duration_ms": round(llm_duration_ms, 2),
            },
        )
        yield _error_event("LLM_UNAVAILABLE", str(e))
        stream_error = True

    if not stream_error:
        # Emit the closing wrapper with status after all LLM tokens
        yield f"data: {json.dumps({'content': ',\"status\":\"SUCCESS\"}'})}\n\n"

    yield "data: [DONE]\n\n"

    total_duration_ms = (time.perf_counter() - start_time) * 1000
    llm_duration_ms = (time.perf_counter() - llm_start) * 1000
    logger.info(
        "Streaming comparison completed",
        extra={
            "event": "streaming_complete",
            "category": category,
            "product_count": len(request.products),
            "chunks_sent": chunk_count,
            "llm_duration_ms": round(llm_duration_ms, 2),
            "total_duration_ms": round(total_duration_ms, 2),
        },
    )

    # 7. Cache the full response if streaming completed successfully
    if not stream_error and accumulated_content:
        full_response = "".join(accumulated_content)
        try:
            parsed = json.loads(full_response)
            summary = ComparisonSummary.model_validate(parsed)
            summary = reorder_quick_picks(summary, expected_model_ids=list(request.products))
            await cache_set(cache_key, summary.model_dump(), None)
            logger.info(
                "Streamed response cached successfully",
                extra={
                    "event": "streaming_cache_set",
                    "cache_key": cache_key,
                    "response_length": len(full_response),
                },
            )
        except Exception as e:
            logger.warning(
                "Failed to cache streamed response",
                extra={
                    "event": "streaming_cache_set_error",
                    "cache_key": cache_key,
                    "error_type": type(e).__name__,
                    "error": str(e),
                },
            )
