"""
Output validation for product comparison responses.

This module provides validation functions for LLM outputs.
It validates for prohibited terms, output structure, and hallucinations.
"""

from __future__ import annotations

import re
from typing import Any

from common.config import get_logger
from common.models.exceptions import ErrorCode, GuardrailError, ParseError
from common.models.responses_pc import ComparisonSummary
from common.lib.validation.prohibited_terms import (
    COMPETITOR_BRANDS,
    PROHIBITED_CLAIMS,
)

logger = get_logger(__name__)

_WORD = re.compile(r"[A-Za-z0-9']+")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _check_competitors(text: str) -> list[str]:
    """Check text for competitor brand mentions using word-boundary matching."""
    text_lower = text.lower()
    tokens = set(_WORD.findall(text_lower))
    return [b for b in COMPETITOR_BRANDS if b in tokens]


def _text_iter(summary: ComparisonSummary) -> list[str]:
    """Extract all text fields from a comparison summary."""
    texts: list[str] = []
    # Extract from quickPick (now just strings)
    texts.extend(summary.quickPick)
    # Extract from differentiators
    for diff in summary.differentiators:
        texts.append(diff.label)
        for dp in diff.products:
            texts.append(dp.summary)
    # Extract from similarities
    texts.extend(summary.similarities)
    return texts


# ---------------------------------------------------------------------------
# Validation functions
# ---------------------------------------------------------------------------


def validate_prohibited_terms(summary: ComparisonSummary) -> None:
    """
    Validate that the summary does not contain prohibited content.

    Checks for competitor brand mentions and prohibited marketing claims.

    Raises:
        GuardrailError: If prohibited content is found.
    """
    logger.debug("Checking for prohibited terms", extra={"event": "guardrail_prohibited_start"})

    all_text = "\n".join(_text_iter(summary))
    all_text_lower = all_text.lower()

    # Check for competitor brands
    found_brands = _check_competitors(all_text)
    if found_brands:
        logger.warning(
            "Competitor brand mentioned",
            extra={
                "event": "guardrail_violation",
                "violation_type": "COMPETITOR_MENTION",
                "found_terms": found_brands[:5],
            },
        )
        raise GuardrailError(
            "Response contains competitor brand mentions",
            code=ErrorCode.GUARDRAIL_COMPETITOR_MENTION,
            details={"found_brands": found_brands[:5]},
        )
    logger.debug(
        "Competitor check passed",
        extra={"event": "guardrail_competitor_passed"},
    )

    # Check for prohibited claims
    for phrase in PROHIBITED_CLAIMS:
        if phrase in all_text_lower:
            logger.warning(
                "Prohibited claim detected",
                extra={
                    "event": "guardrail_violation",
                    "violation_type": "PROHIBITED_CLAIM",
                    "found_phrase": phrase,
                },
            )
            raise GuardrailError(
                "Response contains prohibited claims",
                code=ErrorCode.GUARDRAIL_PROHIBITED_CLAIM,
                details={"found_phrase": phrase},
            )

    logger.debug("Prohibited terms check passed", extra={"event": "guardrail_prohibited_success"})


def validate_output_structure(parsed: dict[str, Any]) -> None:
    """
    Lightweight sanity check before Pydantic validation.

    Raises:
        ParseError: If the structure is invalid.
    """
    logger.debug("Checking output structure", extra={"event": "guardrail_structure_start"})

    if not isinstance(parsed, dict):
        logger.warning(
            "Output structure validation failed",
            extra={"event": "guardrail_structure_failed", "reason": "not_dict"},
        )
        raise ParseError(
            "LLM response is not a valid JSON object",
            code=ErrorCode.PARSE_SCHEMA_INVALID,
            details={"expected": "dict", "received": type(parsed).__name__},
        )

    # New structure: quickPick, differentiators, similarities
    required_top = {"quickPick", "differentiators", "similarities"}
    missing_top = required_top - set(parsed.keys())
    if missing_top:
        logger.warning(
            "Output structure validation failed",
            extra={
                "event": "guardrail_structure_failed",
                "reason": "missing_keys",
                "missing_keys": list(missing_top),
            },
        )
        raise ParseError(
            f"LLM response missing required fields: {', '.join(missing_top)}",
            code=ErrorCode.PARSE_SCHEMA_INVALID,
            details={"missing_keys": list(missing_top)},
        )

    # Validate quickPick array
    quick_pick = parsed.get("quickPick")
    if not isinstance(quick_pick, list) or not quick_pick:
        logger.warning(
            "Output structure validation failed",
            extra={
                "event": "guardrail_structure_failed",
                "reason": "invalid_quickPick",
            },
        )
        raise ParseError(
            "LLM response 'quickPick' must be a non-empty list",
            code=ErrorCode.PARSE_SCHEMA_INVALID,
            details={"quickPick_type": type(quick_pick).__name__ if quick_pick else "empty"},
        )

    for i, qp in enumerate(quick_pick):
        if not isinstance(qp, str):
            logger.warning(
                "Output structure validation failed",
                extra={
                    "event": "guardrail_structure_failed",
                    "reason": "quickPick_item_not_string",
                    "index": i,
                },
            )
            raise ParseError(
                f"quickPick item at index {i} must be a string",
                code=ErrorCode.PARSE_SCHEMA_INVALID,
                details={"index": i, "received_type": type(qp).__name__},
            )
        if not qp.lower().startswith("pick "):
            logger.warning(
                "Output structure validation failed",
                extra={
                    "event": "guardrail_structure_failed",
                    "reason": "quickPick_invalid_format",
                    "index": i,
                },
            )
            raise ParseError(
                f"quickPick item at index {i} must start with 'Pick '",
                code=ErrorCode.PARSE_SCHEMA_INVALID,
                details={"index": i, "value": qp[:50]},
            )

    # Validate differentiators array
    differentiators = parsed.get("differentiators")
    if not isinstance(differentiators, list) or not differentiators:
        logger.warning(
            "Output structure validation failed",
            extra={
                "event": "guardrail_structure_failed",
                "reason": "invalid_differentiators",
            },
        )
        raise ParseError(
            "LLM response 'differentiators' must be a non-empty list",
            code=ErrorCode.PARSE_SCHEMA_INVALID,
            details={
                "differentiators_type": type(differentiators).__name__
                if differentiators
                else "empty"
            },
        )

    required_diff = {"key", "label", "products"}
    required_diff_product = {"productId", "summary"}
    for i, diff in enumerate(differentiators):
        if not isinstance(diff, dict):
            logger.warning(
                "Output structure validation failed",
                extra={
                    "event": "guardrail_structure_failed",
                    "reason": "differentiator_not_dict",
                    "index": i,
                },
            )
            raise ParseError(
                f"Differentiator at index {i} is not a valid object",
                code=ErrorCode.PARSE_SCHEMA_INVALID,
                details={"index": i, "received_type": type(diff).__name__},
            )
        missing_diff = required_diff - set(diff.keys())
        if missing_diff:
            logger.warning(
                "Output structure validation failed",
                extra={
                    "event": "guardrail_structure_failed",
                    "reason": "differentiator_missing_keys",
                    "index": i,
                    "missing_keys": list(missing_diff),
                },
            )
            raise ParseError(
                f"Differentiator at index {i} missing required fields: {', '.join(missing_diff)}",
                code=ErrorCode.PARSE_SCHEMA_INVALID,
                details={"index": i, "missing_keys": list(missing_diff)},
            )
        # Validate products within each differentiator
        diff_products = diff.get("products")
        if not isinstance(diff_products, list) or not diff_products:
            logger.warning(
                "Output structure validation failed",
                extra={
                    "event": "guardrail_structure_failed",
                    "reason": "differentiator_products_invalid",
                    "diff_index": i,
                },
            )
            raise ParseError(
                f"Differentiator at index {i} 'products' must be a non-empty list",
                code=ErrorCode.PARSE_SCHEMA_INVALID,
                details={"diff_index": i},
            )
        for j, dp in enumerate(diff_products):
            if not isinstance(dp, dict):
                raise ParseError(
                    f"Differentiator {i} product at index {j} is not a valid object",
                    code=ErrorCode.PARSE_SCHEMA_INVALID,
                    details={"diff_index": i, "product_index": j},
                )
            missing_dp = required_diff_product - set(dp.keys())
            if missing_dp:
                raise ParseError(
                    f"Differentiator {i} product at index {j} missing: {', '.join(missing_dp)}",
                    code=ErrorCode.PARSE_SCHEMA_INVALID,
                    details={"diff_index": i, "product_index": j, "missing_keys": list(missing_dp)},
                )

    # Validate similarities
    similarities = parsed.get("similarities")
    if not isinstance(similarities, list):
        logger.warning(
            "Output structure validation failed",
            extra={
                "event": "guardrail_structure_failed",
                "reason": "invalid_similarities",
            },
        )
        raise ParseError(
            "LLM response 'similarities' must be a list",
            code=ErrorCode.PARSE_SCHEMA_INVALID,
            details={"similarities_type": type(similarities).__name__},
        )

    logger.debug(
        "Output structure check passed",
        extra={
            "event": "guardrail_structure_success",
            "quickPick_count": len(quick_pick),
            "differentiator_count": len(differentiators),
        },
    )


def reorder_quick_picks(
    summary: ComparisonSummary,
    *,
    expected_model_ids: list[str],
) -> ComparisonSummary:
    """
    Reorder quickPick entries to match the request product order.

    Extracts the product ID from each quickPick string (format: "Pick {productId} if ...")
    and reorders them to match the order of expected_model_ids.

    Any quickPick entries whose product ID cannot be extracted or doesn't match
    an expected ID are appended at the end.

    Returns a new ComparisonSummary with reordered quickPick.
    """
    # Build a map from productId -> quickPick string
    qp_map: dict[str, str] = {}
    unmatched: list[str] = []

    for qp in summary.quickPick:
        match = re.match(r"^Pick\s+(\S+)\s+if\s+", qp, re.IGNORECASE)
        if match:
            pid = match.group(1)
            qp_map[pid] = qp
        else:
            unmatched.append(qp)

    # Rebuild in request order
    ordered: list[str] = []
    for pid in expected_model_ids:
        if pid in qp_map:
            ordered.append(qp_map.pop(pid))

    # Append any remaining (shouldn't happen after hallucination check, but be safe)
    ordered.extend(qp_map.values())
    ordered.extend(unmatched)

    if ordered != list(summary.quickPick):
        logger.info(
            "Quick picks reordered to match request order",
            extra={
                "event": "quick_pick_reorder",
                "expected_order": expected_model_ids,
            },
        )

    return summary.model_copy(update={"quickPick": ordered})


def validate_no_hallucinations(
    summary: ComparisonSummary,
    *,
    expected_model_ids: list[str],
    strict: bool = False,
) -> None:
    """
    Minimal hallucination guard: ensure product IDs match inputs.

    Checks that productIds in quickPick and differentiators match expected inputs.

    Args:
        summary: The comparison summary to validate.
        expected_model_ids: List of product IDs that should be in the response.
        strict: If True, raises error on mismatch. If False, only logs.

    Raises:
        GuardrailError: If strict=True and product IDs don't match.
    """
    logger.debug(
        "Checking for hallucinations",
        extra={
            "event": "guardrail_hallucination_start",
            "expected_ids": expected_model_ids,
        },
    )

    # Extract product IDs from quickPick strings (format: "Pick {productId} if ...")
    out_ids: list[str] = []
    for qp in summary.quickPick:
        # Extract productId from "Pick {productId} if ..." format
        match = re.match(r"^Pick\s+(\S+)\s+if\s+", qp, re.IGNORECASE)
        if match:
            out_ids.append(match.group(1))

    if set(out_ids) != set(expected_model_ids):
        extra_ids = set(out_ids) - set(expected_model_ids)
        missing_ids = set(expected_model_ids) - set(out_ids)

        logger.warning(
            "Product ID mismatch detected",
            extra={
                "event": "guardrail_hallucination_mismatch",
                "expected_ids": expected_model_ids,
                "output_ids": out_ids,
                "extra_ids": list(extra_ids),
                "missing_ids": list(missing_ids),
                "strict": strict,
            },
        )

        if strict:
            raise GuardrailError(
                "LLM response contains unexpected or missing products",
                code=ErrorCode.GUARDRAIL_HALLUCINATION,
                details={
                    "expected_ids": expected_model_ids,
                    "output_ids": out_ids,
                    "extra_ids": list(extra_ids),
                    "missing_ids": list(missing_ids),
                },
            )

    logger.debug("Hallucination check passed", extra={"event": "guardrail_hallucination_success"})


# ---------------------------------------------------------------------------
# Legacy function signatures for backward compatibility
# ---------------------------------------------------------------------------


def check_prohibited_terms(summary: ComparisonSummary) -> tuple[bool, str | None]:
    """Legacy wrapper - prefer validate_prohibited_terms()."""
    try:
        validate_prohibited_terms(summary)
        return True, None
    except GuardrailError as e:
        return False, e.code.value


def check_output_structure(parsed: dict[str, Any]) -> tuple[bool, str | None]:
    """Legacy wrapper - prefer validate_output_structure()."""
    try:
        validate_output_structure(parsed)
        return True, None
    except ParseError as e:
        return False, e.code.value


def check_no_hallucinations(
    summary: ComparisonSummary, *, expected_model_ids: list[str]
) -> tuple[bool, str | None]:
    """Legacy wrapper - prefer validate_no_hallucinations()."""
    try:
        validate_no_hallucinations(summary, expected_model_ids=expected_model_ids, strict=False)
        return True, None
    except GuardrailError as e:
        return False, e.code.value
