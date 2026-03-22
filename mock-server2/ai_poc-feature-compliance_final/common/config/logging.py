"""
Structured logging configuration for Product Comparison API.

Provides:
- JSON-formatted logs for production (machine-readable)
- Human-readable colored logs for development
- Request correlation via request_id context
- Consistent log format across all modules
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

# Context variable to store request ID for correlation across async calls
request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    """Get the current request ID from context."""
    return request_id_ctx.get()


def set_request_id(request_id: str) -> None:
    """Set the request ID in the current context."""
    request_id_ctx.set(request_id)


class JSONFormatter(logging.Formatter):
    """
    JSON log formatter for production environments.

    Outputs structured JSON logs with consistent fields for log aggregation
    and querying in systems like CloudWatch, ELK, Datadog, etc.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_data: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add request ID if available
        request_id = get_request_id()
        if request_id:
            log_data["request_id"] = request_id

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add any extra fields passed to the log call
        if hasattr(record, "extra_fields"):
            log_data.update(record.extra_fields)

        return json.dumps(log_data, default=str, ensure_ascii=False)


class ConsoleFormatter(logging.Formatter):
    """
    Human-readable formatter for development with colors.
    """

    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, self.RESET)
        request_id = get_request_id()
        rid_str = f"[{request_id[:8]}]" if request_id else ""

        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

        # Format base message
        message = (
            f"{color}{timestamp} {record.levelname:<8}{self.RESET} "
            f"{rid_str} {record.name}:{record.lineno} - {record.getMessage()}"
        )

        # Add exception if present
        if record.exc_info:
            message += f"\n{self.formatException(record.exc_info)}"

        return message


class ContextLogger(logging.LoggerAdapter):
    """
    Logger adapter that automatically includes context fields.
    """

    def process(self, msg: str, kwargs: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        extra = kwargs.get("extra", {})

        # Add request_id to extra fields for JSON formatter
        request_id = get_request_id()
        if request_id:
            extra["request_id"] = request_id

        # Store extra fields for JSON formatter
        if "extra_fields" not in extra:
            extra["extra_fields"] = {}

        # Move any custom fields to extra_fields for JSON output
        for key in list(extra.keys()):
            if key not in ("extra_fields", "request_id"):
                extra["extra_fields"][key] = extra.pop(key)

        kwargs["extra"] = extra
        return msg, kwargs


def get_logger(name: str) -> ContextLogger:
    """
    Get a configured logger for the given module name.

    Usage:
        logger = get_logger(__name__)
        logger.info("Processing request", extra={"product_count": 3})
    """
    return ContextLogger(logging.getLogger(name), {})


def setup_logging(
    level: str = "INFO",
    json_format: bool = True,
    log_to_file: str | None = None,
) -> None:
    """
    Configure the root logger with the appropriate formatter.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_format: If True, use JSON format; otherwise use console format
        log_to_file: Optional file path to write logs to
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, level.upper(), logging.INFO))

    if json_format:
        console_handler.setFormatter(JSONFormatter())
    else:
        console_handler.setFormatter(ConsoleFormatter())

    root_logger.addHandler(console_handler)

    # Optional file handler
    if log_to_file:
        file_handler = logging.FileHandler(log_to_file)
        file_handler.setLevel(getattr(logging, level.upper(), logging.INFO))
        file_handler.setFormatter(JSONFormatter())  # Always JSON for files
        root_logger.addHandler(file_handler)

    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("LiteLLM").setLevel(logging.WARNING)
