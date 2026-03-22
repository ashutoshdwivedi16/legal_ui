"""Prompt injection service exports."""
from services.compliance.prompt_injection.services.service import (
    run_prompt_injection,
    get_latest_prompt_injection_run_detail,
)

__all__ = [
    "run_prompt_injection",
    "get_latest_prompt_injection_run_detail",
]
