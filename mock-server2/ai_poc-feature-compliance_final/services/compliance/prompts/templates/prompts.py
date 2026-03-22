"""Compliance prompt templates (re-exported from common agents)."""
from common.agents.compliance_validator.prompts.templates import (
    get_system_prompt,
    get_validation_prompt,
    get_prompt_validation_system_prompt,
    get_prompt_validation_user_prompt,
)

__all__ = [
    "get_system_prompt",
    "get_validation_prompt",
    "get_prompt_validation_system_prompt",
    "get_prompt_validation_user_prompt",
]
