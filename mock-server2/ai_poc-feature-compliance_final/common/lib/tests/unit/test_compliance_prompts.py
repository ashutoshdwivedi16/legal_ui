"""Unit tests for compliance prompts wiring."""
from services.compliance.prompts import (
    get_system_prompt,
    get_validation_prompt,
    get_prompt_validation_system_prompt,
    get_prompt_validation_user_prompt,
)


def test_prompt_helpers_return_strings():
    rules = [
        {
            "id": "legal_rule_01",
            "rule_name": "No Superlatives",
            "prompt_instruction": "Avoid superlatives.",
            "severity": "CRITICAL",
        }
    ]
    system_prompt = get_system_prompt(rules)
    validation_prompt = get_validation_prompt("sample content")
    system_prompt_2 = get_prompt_validation_system_prompt()
    user_prompt_2 = get_prompt_validation_user_prompt("sample")

    assert isinstance(system_prompt, str)
    assert isinstance(validation_prompt, str)
    assert isinstance(system_prompt_2, str)
    assert isinstance(user_prompt_2, str)
