"""
Validation module for product comparison input and output.
"""

from common.lib.validation.input import validate_product_id, validate_request
from common.lib.validation.output import (
    check_no_hallucinations,
    check_output_structure,
    check_prohibited_terms,
    validate_no_hallucinations,
    validate_output_structure,
    validate_prohibited_terms,
)

__all__ = [
    # Input validation
    "validate_request",
    "validate_product_id",
    # Output validation (new API)
    "validate_prohibited_terms",
    "validate_output_structure",
    "validate_no_hallucinations",
    # Output validation (legacy API)
    "check_prohibited_terms",
    "check_output_structure",
    "check_no_hallucinations",
]
