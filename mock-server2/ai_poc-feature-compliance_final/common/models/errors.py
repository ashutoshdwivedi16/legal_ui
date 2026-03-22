from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Detailed error information for API responses."""

    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    details: dict[str, Any] | None = Field(
        default=None,
        description="Additional error context for debugging",
    )


class ErrorResponse(BaseModel):
    """Standard error response wrapper."""

    error: ErrorDetail
    request_id: str | None = Field(
        default=None,
        description="Request ID for tracing and support",
    )
