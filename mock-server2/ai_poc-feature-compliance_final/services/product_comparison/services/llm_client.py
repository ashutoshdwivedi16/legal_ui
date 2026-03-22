from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator
from typing import Any, TypedDict

import litellm
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from common.config import get_logger, get_settings
from common.models.exceptions import ErrorCode, ServiceError

logger = get_logger(__name__)


async def ping_llm() -> bool:
    """
    Lightweight connectivity check against the LLM provider.

    Sends a minimal completion request to verify the model endpoint is reachable.
    Uses a short timeout to avoid blocking health checks.
    """
    settings = get_settings()
    start_time = time.perf_counter()
    try:
        kwargs: dict[str, Any] = {
            "model": settings.llm_model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 1,
            "timeout": 5,
        }
        if settings.litellm_base_url:
            kwargs["api_base"] = settings.litellm_base_url
        if settings.litellm_api_key:
            kwargs["api_key"] = settings.litellm_api_key

        await litellm.acompletion(**kwargs)
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.debug(
            "LLM ping successful",
            extra={
                "event": "llm_ping_success",
                "model": settings.llm_model,
                "duration_ms": round(duration_ms, 2),
            },
        )
        return True
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            "LLM ping failed",
            extra={
                "event": "llm_ping_failed",
                "model": settings.llm_model,
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        return False


class LLMResult(TypedDict, total=False):
    raw_text: str
    parsed_json: Any | None
    model: str
    prompt_tokens: int | None
    completion_tokens: int | None


def _extract_text(resp: Any) -> str:
    # litellm returns OpenAI-like response structures
    try:
        choice = resp.choices[0]
        # Support both dict and object attribute styles
        message = getattr(choice, "message", None) or choice.get("message")
        if message and (content := (getattr(message, "content", None) or message.get("content"))):
            return content
        # Some providers return plain 'text'
        text = getattr(choice, "text", None) or choice.get("text")
        if text:
            return text
    except Exception:
        pass
    return str(resp)


def _parse_json_safe(text: str) -> Any | None:
    text = text.strip()
    if not text:
        return None
    # Try direct parse, then fenced code block extraction
    try:
        return json.loads(text)
    except Exception:
        pass
    if "```" in text:
        parts = text.split("```")
        # Try each fenced section as potential JSON
        for i in range(1, len(parts), 2):
            candidate = parts[i]
            # Strip potential language hint like ```json
            candidate = candidate.split("\n", 1)[-1] if "\n" in candidate else candidate
            candidate = candidate.strip()
            try:
                return json.loads(candidate)
            except Exception:
                continue
    return None


# Retryable LLM errors for tenacity retry decorator
RETRYABLE_LLM_ERRORS = (
    litellm.RateLimitError,
    litellm.APIConnectionError,
    litellm.InternalServerError,
    litellm.Timeout,
)


def _log_retry(retry_state) -> None:
    """Log retry attempts for LLM calls."""
    exception = retry_state.outcome.exception() if retry_state.outcome else None
    logger.warning(
        "LLM call failed, retrying",
        extra={
            "event": "llm_retry",
            "attempt": retry_state.attempt_number,
            "error_type": type(exception).__name__ if exception else None,
            "error": str(exception) if exception else None,
            "wait_seconds": retry_state.next_action.sleep if retry_state.next_action else None,
        },
    )


@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=0.5, max=4.0),
    retry=retry_if_exception_type(RETRYABLE_LLM_ERRORS),
    before_sleep=_log_retry,
)
async def generate(
    system_prompt: str,
    user_prompt: str,
    *,
    model: str | None = None,
    timeout_seconds: int | None = None,
    max_tokens: int | None = None,
    temperature: float | None = None,
) -> LLMResult:
    """
    Call LiteLLM directly with retries, return text and parsed JSON (if any).
    """
    settings = get_settings()
    start_time = time.perf_counter()

    model_id = model or settings.llm_model

    logger.debug(
        "Preparing LLM request",
        extra={
            "event": "llm_request_prepare",
            "model": model_id,
            "system_prompt_length": len(system_prompt),
            "user_prompt_length": len(user_prompt),
        },
    )

    kwargs: dict[str, Any] = {
        "model": model_id,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    # Pass gateway URL and API key directly in the call
    if settings.litellm_base_url:
        kwargs["api_base"] = settings.litellm_base_url
    if settings.litellm_api_key:
        kwargs["api_key"] = settings.litellm_api_key

    if timeout_seconds is None:
        timeout_seconds = settings.llm_timeout_seconds
    if max_tokens is None:
        max_tokens = settings.llm_max_tokens
    if temperature is None:
        temperature = settings.llm_temperature

    kwargs.update(
        {
            "timeout": timeout_seconds,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "performanceConfig": {"latency": "optimized"}
        }
    )

    logger.debug(
        "Sending LLM request",
        extra={
            "event": "llm_request_send",
            "model": model_id,
            "timeout_seconds": timeout_seconds,
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
    )

    try:
        resp = await litellm.acompletion(**kwargs)
    except litellm.RateLimitError as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.warning(
            "LLM rate limited",
            extra={
                "event": "llm_rate_limited",
                "model": model_id,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            "LLM service is rate limited. Please try again later.",
            code=ErrorCode.SERVICE_LLM_RATE_LIMITED,
            details={"model": model_id},
            original_error=e,
        ) from e
    except litellm.Timeout as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.warning(
            "LLM request timed out",
            extra={
                "event": "llm_timeout",
                "model": model_id,
                "timeout_seconds": timeout_seconds,
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            f"LLM request timed out after {timeout_seconds}s",
            code=ErrorCode.SERVICE_LLM_TIMEOUT,
            details={"model": model_id, "timeout_seconds": timeout_seconds},
            original_error=e,
        ) from e
    except (litellm.APIConnectionError, litellm.InternalServerError) as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            "LLM service unavailable",
            extra={
                "event": "llm_unavailable",
                "model": model_id,
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            "LLM service is temporarily unavailable",
            code=ErrorCode.SERVICE_LLM_UNAVAILABLE,
            details={"model": model_id, "error_type": type(e).__name__},
            original_error=e,
        ) from e
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            "LLM unexpected error",
            extra={
                "event": "llm_error",
                "model": model_id,
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            f"LLM request failed: {type(e).__name__}",
            code=ErrorCode.SERVICE_LLM_UNAVAILABLE,
            details={"model": model_id, "error_type": type(e).__name__},
            original_error=e,
        ) from e

    duration_ms = (time.perf_counter() - start_time) * 1000
    raw_text = _extract_text(resp)

    usage = getattr(resp, "usage", None) or getattr(resp, "get", lambda _k, _d=None: None)("usage")
    prompt_tokens = getattr(usage, "prompt_tokens", None) if usage else None
    completion_tokens = getattr(usage, "completion_tokens", None) if usage else None

    logger.info(
        "LLM request completed",
        extra={
            "event": "llm_response",
            "model": model_id,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": (prompt_tokens or 0) + (completion_tokens or 0),
            "response_length": len(raw_text),
            "duration_ms": round(duration_ms, 2),
        },
    )

    parsed = _parse_json_safe(raw_text)
    if parsed:
        logger.debug("LLM response parsed as JSON successfully")
    else:
        logger.debug(
            "LLM response could not be parsed as JSON",
            extra={"raw_text_preview": raw_text[:200] if raw_text else ""},
        )

    return LLMResult(
        raw_text=raw_text,
        parsed_json=parsed,
        model=model_id,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
    )


async def generate_stream(
    system_prompt: str,
    user_prompt: str,
    *,
    model: str | None = None,
    timeout_seconds: int | None = None,
    max_tokens: int | None = None,
    temperature: float | None = None,
) -> AsyncIterator[str]:
    """
    Call LiteLLM with streaming enabled, yielding SSE-formatted data chunks.
    Each chunk is formatted as: data: {"content": "..."}\n\n
    """
    settings = get_settings()
    start_time = time.perf_counter()

    model_id = model or settings.llm_model

    logger.debug(
        "Preparing streaming LLM request",
        extra={
            "event": "llm_stream_prepare",
            "model": model_id,
            "system_prompt_length": len(system_prompt),
            "user_prompt_length": len(user_prompt),
        },
    )

    kwargs: dict[str, Any] = {
        "model": model_id,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": True,
    }

    # Pass gateway URL and API key directly in the call
    if settings.litellm_base_url:
        kwargs["api_base"] = settings.litellm_base_url
    if settings.litellm_api_key:
        kwargs["api_key"] = settings.litellm_api_key

    if timeout_seconds is None:
        timeout_seconds = settings.llm_timeout_seconds
    if max_tokens is None:
        max_tokens = settings.llm_max_tokens
    if temperature is None:
        temperature = settings.llm_temperature

    kwargs.update(
        {
            "timeout": timeout_seconds,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "performanceConfig": {"latency": "optimized"}
        }
    )

    logger.info(
        "Starting LLM stream",
        extra={
            "event": "llm_stream_start",
            "model": model_id,
            "timeout_seconds": timeout_seconds,
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
    )

    try:
        resp = await litellm.acompletion(**kwargs)
    except litellm.RateLimitError as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.warning(
            "LLM stream rate limited",
            extra={
                "event": "llm_stream_rate_limited",
                "model": model_id,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            "LLM service is rate limited. Please try again later.",
            code=ErrorCode.SERVICE_LLM_RATE_LIMITED,
            details={"model": model_id},
            original_error=e,
        ) from e
    except litellm.Timeout as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.warning(
            "LLM stream timed out",
            extra={
                "event": "llm_stream_timeout",
                "model": model_id,
                "timeout_seconds": timeout_seconds,
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            f"LLM stream timed out after {timeout_seconds}s",
            code=ErrorCode.SERVICE_LLM_TIMEOUT,
            details={"model": model_id, "timeout_seconds": timeout_seconds},
            original_error=e,
        ) from e
    except (litellm.APIConnectionError, litellm.InternalServerError) as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            "LLM stream service unavailable",
            extra={
                "event": "llm_stream_unavailable",
                "model": model_id,
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            "LLM service is temporarily unavailable",
            code=ErrorCode.SERVICE_LLM_UNAVAILABLE,
            details={"model": model_id, "error_type": type(e).__name__},
            original_error=e,
        ) from e
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            "LLM stream initialization failed",
            extra={
                "event": "llm_stream_error",
                "model": model_id,
                "error_type": type(e).__name__,
                "error": str(e),
                "duration_ms": round(duration_ms, 2),
            },
        )
        raise ServiceError(
            f"LLM stream failed: {type(e).__name__}",
            code=ErrorCode.SERVICE_LLM_UNAVAILABLE,
            details={"model": model_id, "error_type": type(e).__name__},
            original_error=e,
        ) from e

    chunk_count = 0
    total_content_length = 0
    first_chunk_time = None

    async for chunk in resp:
        try:
            delta = chunk.choices[0].delta
            content = getattr(delta, "content", None) or delta.get("content")
            if content:
                if first_chunk_time is None:
                    first_chunk_time = time.perf_counter()
                    ttfb_ms = (first_chunk_time - start_time) * 1000
                    logger.debug(
                        "First LLM stream chunk received",
                        extra={
                            "event": "llm_stream_first_chunk",
                            "model": model_id,
                            "ttfb_ms": round(ttfb_ms, 2),
                        },
                    )

                chunk_count += 1
                total_content_length += len(content)
                # Format as SSE data event
                escaped_content = json.dumps({"content": content})
                yield f"data: {escaped_content}\n\n"
        except (IndexError, AttributeError, KeyError):
            continue

    duration_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        "LLM stream completed",
        extra={
            "event": "llm_stream_complete",
            "model": model_id,
            "chunk_count": chunk_count,
            "total_content_length": total_content_length,
            "duration_ms": round(duration_ms, 2),
        },
    )

    # Send done event to signal stream completion
    yield "data: [DONE]\n\n"
