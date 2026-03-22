"""Custom exception hierarchy for Product Comparison API.

All application exceptions inherit from AppException, which provides:
- Structured error codes for machine parsing
- Human-readable messages
- HTTP status code mapping
- Optional additional details for debugging
"""

from __future__ import annotations

from enum import Enum
from typing import Any


class ErrorCode(str, Enum):
    """Centralized error codes for the application.

    Naming convention: DOMAIN_SPECIFIC_ERROR
    - VALIDATION_*: Input validation errors (4xx)
    - AUTH_*: Authentication/authorization errors (401/403)
    - NOT_FOUND_*: Resource not found errors (404)
    - SERVICE_*: External service errors (502/503)
    - INTERNAL_*: Internal server errors (500)
    - GUARDRAIL_*: Content policy violations (422)
    """

    # Validation errors (400)
    VALIDATION_INVALID_PRODUCT_ID = "VALIDATION_INVALID_PRODUCT_ID"
    VALIDATION_INVALID_REQUEST = "VALIDATION_INVALID_REQUEST"
    VALIDATION_PRODUCT_COUNT = "VALIDATION_PRODUCT_COUNT"

    # Not found errors (404)
    NOT_FOUND_PRODUCT = "NOT_FOUND_PRODUCT"
    NOT_FOUND_PROMPT = "NOT_FOUND_PROMPT"
    NOT_FOUND_TEMPLATE = "NOT_FOUND_TEMPLATE"

    # Service errors (502/503)
    SERVICE_PDS_UNAVAILABLE = "SERVICE_PDS_UNAVAILABLE"
    SERVICE_LLM_UNAVAILABLE = "SERVICE_LLM_UNAVAILABLE"
    SERVICE_LLM_TIMEOUT = "SERVICE_LLM_TIMEOUT"
    SERVICE_LLM_RATE_LIMITED = "SERVICE_LLM_RATE_LIMITED"
    SERVICE_CACHE_UNAVAILABLE = "SERVICE_CACHE_UNAVAILABLE"
    SERVICE_DATABASE_UNAVAILABLE = "SERVICE_DATABASE_UNAVAILABLE"

    # Parse/processing errors (422)
    PARSE_LLM_RESPONSE = "PARSE_LLM_RESPONSE"
    PARSE_CACHE_CORRUPT = "PARSE_CACHE_CORRUPT"
    PARSE_SCHEMA_INVALID = "PARSE_SCHEMA_INVALID"

    # Guardrail violations (422)
    GUARDRAIL_COMPETITOR_MENTION = "GUARDRAIL_COMPETITOR_MENTION"
    GUARDRAIL_SUPERLATIVE_CLAIM = "GUARDRAIL_SUPERLATIVE_CLAIM"
    GUARDRAIL_PROHIBITED_CLAIM = "GUARDRAIL_PROHIBITED_CLAIM"
    GUARDRAIL_HALLUCINATION = "GUARDRAIL_HALLUCINATION"

    # Internal errors (500)
    INTERNAL_UNEXPECTED = "INTERNAL_UNEXPECTED"
    INTERNAL_CONFIGURATION = "INTERNAL_CONFIGURATION"


# Map error codes to HTTP status codes
ERROR_CODE_TO_STATUS: dict[ErrorCode, int] = {
    # 400 Bad Request
    ErrorCode.VALIDATION_INVALID_PRODUCT_ID: 400,
    ErrorCode.VALIDATION_INVALID_REQUEST: 400,
    ErrorCode.VALIDATION_PRODUCT_COUNT: 400,
    # 404 Not Found
    ErrorCode.NOT_FOUND_PRODUCT: 404,
    ErrorCode.NOT_FOUND_PROMPT: 404,
    ErrorCode.NOT_FOUND_TEMPLATE: 404,
    # 422 Unprocessable Entity
    ErrorCode.PARSE_LLM_RESPONSE: 422,
    ErrorCode.PARSE_CACHE_CORRUPT: 422,
    ErrorCode.PARSE_SCHEMA_INVALID: 422,
    ErrorCode.GUARDRAIL_COMPETITOR_MENTION: 422,
    ErrorCode.GUARDRAIL_SUPERLATIVE_CLAIM: 422,
    ErrorCode.GUARDRAIL_PROHIBITED_CLAIM: 422,
    ErrorCode.GUARDRAIL_HALLUCINATION: 422,
    # 500 Internal Server Error
    ErrorCode.INTERNAL_UNEXPECTED: 500,
    ErrorCode.INTERNAL_CONFIGURATION: 500,
    # 502 Bad Gateway
    ErrorCode.SERVICE_LLM_UNAVAILABLE: 502,
    ErrorCode.SERVICE_PDS_UNAVAILABLE: 502,
    # 503 Service Unavailable
    ErrorCode.SERVICE_LLM_TIMEOUT: 503,
    ErrorCode.SERVICE_LLM_RATE_LIMITED: 503,
    ErrorCode.SERVICE_CACHE_UNAVAILABLE: 503,
    ErrorCode.SERVICE_DATABASE_UNAVAILABLE: 503,
}


class AppException(Exception):
    """Base exception for all application errors.

    Attributes:
        code: Machine-readable error code from ErrorCode enum
        message: Human-readable error message
        status_code: HTTP status code for API responses
        details: Optional dict with additional error context
        original_error: Optional original exception that caused this error
    """

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        details: dict[str, Any] | None = None,
        original_error: Exception | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = ERROR_CODE_TO_STATUS.get(code, 500)
        self.details = details or {}
        self.original_error = original_error
        super().__init__(message)

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to API response format."""
        result: dict[str, Any] = {
            "code": self.code.value,
            "message": self.message,
        }
        if self.details:
            result["details"] = self.details
        return result

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(code={self.code.value!r}, message={self.message!r})"


# Domain-specific exception classes for cleaner catching


class ValidationError(AppException):
    """Raised when input validation fails."""

    def __init__(
        self,
        message: str,
        *,
        code: ErrorCode = ErrorCode.VALIDATION_INVALID_REQUEST,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(code, message, details=details)


class NotFoundError(AppException):
    """Raised when a requested resource is not found."""

    def __init__(
        self,
        message: str,
        *,
        code: ErrorCode = ErrorCode.NOT_FOUND_PRODUCT,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(code, message, details=details)


class ServiceError(AppException):
    """Raised when an external service fails."""

    def __init__(
        self,
        message: str,
        *,
        code: ErrorCode,
        details: dict[str, Any] | None = None,
        original_error: Exception | None = None,
    ) -> None:
        super().__init__(code, message, details=details, original_error=original_error)


class ParseError(AppException):
    """Raised when parsing or schema validation fails."""

    def __init__(
        self,
        message: str,
        *,
        code: ErrorCode = ErrorCode.PARSE_SCHEMA_INVALID,
        details: dict[str, Any] | None = None,
        original_error: Exception | None = None,
    ) -> None:
        super().__init__(code, message, details=details, original_error=original_error)


class GuardrailError(AppException):
    """Raised when content violates guardrail policies."""

    def __init__(
        self,
        message: str,
        *,
        code: ErrorCode,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(code, message, details=details)
