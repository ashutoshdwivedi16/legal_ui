"""
API middleware for logging and request tracking.

Provides:
- Request ID generation and propagation
- Request/response logging with timing
- Error logging with full context
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from common.config import get_logger, set_request_id

logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that handles request ID generation, propagation, and request/response logging.

    Features:
    - Generates unique request IDs (or uses X-Request-ID header if provided)
    - Adds request ID to response headers
    - Logs request start with method, path, and client info
    - Logs request completion with status code and duration
    - Logs exceptions with full context
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate or extract request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        set_request_id(request_id)

        # Store request ID in request state for access in route handlers
        request.state.request_id = request_id

        # Extract request metadata
        method = request.method
        path = request.url.path
        query_string = str(request.url.query) if request.url.query else None
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "")[:100]  # Truncate long UAs

        # Log request start
        logger.info(
            "Request started",
            extra={
                "event": "request_started",
                "method": method,
                "path": path,
                "query": query_string,
                "client_ip": client_ip,
                "user_agent": user_agent,
            },
        )

        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Log request completion
            log_level = "warning" if response.status_code >= 400 else "info"
            getattr(logger, log_level)(
                "Request completed",
                extra={
                    "event": "request_completed",
                    "method": method,
                    "path": path,
                    "status_code": response.status_code,
                    "duration_ms": round(duration_ms, 2),
                },
            )

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Log exception
            logger.exception(
                "Request failed with exception",
                extra={
                    "event": "request_failed",
                    "method": method,
                    "path": path,
                    "duration_ms": round(duration_ms, 2),
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                },
            )

            # Re-raise to let FastAPI handle it
            raise

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, handling proxies via X-Forwarded-For."""
        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            # Take the first IP in the chain (original client)
            return x_forwarded_for.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
