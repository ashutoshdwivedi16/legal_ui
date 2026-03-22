from __future__ import annotations

import re

from common.config import get_logger
from common.models.exceptions import ErrorCode, ValidationError
from common.models.requests_pc import ComparisonRequest

logger = get_logger(__name__)

_ALNUM = re.compile(r"^[A-Za-z0-9]+$")


def validate_product_id(pid: str) -> bool:
    """Check if a product ID is valid (alphanumeric only)."""
    return bool(_ALNUM.fullmatch(pid))


async def validate_request(req: ComparisonRequest) -> None:
    """
    Validate incoming request beyond schema shape.

    Raises:
        ValidationError: If any product ID is invalid.
    """
    logger.debug(
        "Validating request",
        extra={
            "event": "input_validation_start",
            "product_count": len(req.products),
        },
    )

    invalid_ids = [pid for pid in req.products if not validate_product_id(pid)]
    if invalid_ids:
        logger.warning(
            "Invalid product ID detected",
            extra={
                "event": "input_validation_failed",
                "reason": "INVALID_PRODUCT_ID",
                "invalid_product_ids": invalid_ids,
            },
        )
        raise ValidationError(
            f"Invalid product ID(s): {', '.join(invalid_ids)}. IDs must be alphanumeric.",
            code=ErrorCode.VALIDATION_INVALID_PRODUCT_ID,
            details={"invalid_ids": invalid_ids},
        )

    logger.debug(
        "Request validation passed",
        extra={"event": "input_validation_success"},
    )
