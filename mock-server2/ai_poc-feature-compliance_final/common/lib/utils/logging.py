"""Structured JSON logging for AI Services."""
import json
import logging
import os
from datetime import datetime, timezone
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path


class JsonFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.
    Each log line = 1 JSON object with standard fields.
    """

    def format(self, record):
        log_obj = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": getattr(record, "service", "api"),
            "agent": getattr(record, "agent", None),
            "event": getattr(record, "event", None),
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        }
        # Remove None values
        log_obj = {k: v for k, v in log_obj.items() if v is not None}
        return json.dumps(log_obj, ensure_ascii=False)


def setup_logging(log_level: str = "INFO", log_file: str | None = None) -> None:
    """
    Configure structured JSON logging with both StreamHandler and FileHandler.
    - stdout logging for docker
    - file-based rotating logs for persistent storage
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional log file path (defaults to /app/logs/kpi_monitor.log)
    """
    # Get root logger
    root_logger = logging.getLogger()
    
    # Clear existing handlers
    if root_logger.handlers:
        root_logger.handlers.clear()
    
    # Set level
    level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger.setLevel(level)
    
    formatter = JsonFormatter()

    # --- Stream Handler (stdout) ---
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    root_logger.addHandler(stream_handler)

    # --- File Handler (with rotation, optional) ---
    try:
        if log_file is None:
            logs_dir = os.getenv("LOGS_DIR", "/app/logs")
            os.makedirs(logs_dir, exist_ok=True)
            log_file = os.path.join(logs_dir, "ai_services.log")
        else:
            log_path = Path(log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = TimedRotatingFileHandler(
            log_file,
            when="midnight",
            interval=1,
            backupCount=7,  # Keep last 7 days
            encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    except PermissionError:
        # In Docker, the app user may not have write access to the logs directory.
        # Fall back to stdout-only logging.
        pass

    root_logger.propagate = False
    
    # Suppress noisy loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("litellm").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance.
    
    Args:
        name: Logger name (typically __name__)
    
    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


def log_event(
    level: str,
    message: str,
    event: str | None = None,
    service: str = "api",
    agent: str | None = None
) -> None:
    """
    Standardized structured logging entry point.
    
    Args:
        level: Log level (use LEVEL_* constants from utils.logging_constants)
        message: Human-readable log message
        event: Event type (use event constants from utils.logging_constants)
        service: Source service name (use SERVICE_* constants from utils.logging_constants)
        agent: Agent identifier (use AGENT_* constants from utils.logging_constants)
    """
    logger = logging.getLogger("ai_services")
    extra = {"event": event, "service": service, "agent": agent}

    level_upper = level.upper()
    if level_upper == "DEBUG":
        logger.debug(message, extra=extra)
    elif level_upper == "INFO":
        logger.info(message, extra=extra)
    elif level_upper == "WARNING":
        logger.warning(message, extra=extra)
    elif level_upper == "ERROR":
        logger.error(message, extra=extra)
    elif level_upper == "CRITICAL":
        logger.critical(message, extra=extra)
    else:
        logger.info(message, extra=extra)
