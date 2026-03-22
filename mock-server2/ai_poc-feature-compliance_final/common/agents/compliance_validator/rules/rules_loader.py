# rules_loader.py
# Single source of truth for compliance rules is rules.json.
from __future__ import annotations

import json
from typing import Any

from pathlib import Path

from common.agents.compliance_validator.config.rules_config import RULES_JSON_PATH


def _validate_rules_schema(rules: Any) -> list[dict]:
    if not isinstance(rules, list):
        raise RuntimeError("Compliance rules must be a list of rule objects")
    required_keys = {"id", "rule_name", "prompt_instruction", "severity"}
    for idx, rule in enumerate(rules):
        if not isinstance(rule, dict):
            raise RuntimeError(f"Rule at index {idx} must be an object")
        missing = required_keys - set(rule.keys())
        if missing:
            missing_str = ", ".join(sorted(missing))
            raise RuntimeError(f"Rule at index {idx} missing keys: {missing_str}")
    return rules


def _read_rules(path: Path) -> list[dict]:
    try:
        rules = json.loads(path.read_text(encoding="utf-8"))
        return _validate_rules_schema(rules)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Compliance rules file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in compliance rules file: {path}") from exc


def _path_from_uri(path_or_uri: str | Path | None) -> Path:
    if path_or_uri is None:
        return RULES_JSON_PATH
    if isinstance(path_or_uri, Path):
        return path_or_uri
    if path_or_uri.startswith("file://"):
        return Path(path_or_uri.replace("file://", "", 1))
    if path_or_uri.startswith("s3://"):
        raise RuntimeError(f"S3 rules URI not supported yet: {path_or_uri}")
    return Path(path_or_uri)


def load_rules(path_or_uri: str | Path | None = None) -> list[dict]:
    path = _path_from_uri(path_or_uri)
    return _read_rules(path)


def merge_rules(base_rules: list[dict], override_rules: list[dict]) -> list[dict]:
    base_order = [r.get("id") for r in base_rules]
    base_map = {r.get("id"): r for r in base_rules}

    # Override or add
    for rule in override_rules:
        rule_id = rule.get("id")
        if rule_id is None:
            continue
        base_map[rule_id] = rule

    # Preserve base ordering, append new rules after
    merged = []
    seen = set()
    for rule_id in base_order:
        if rule_id in base_map and rule_id not in seen:
            merged.append(base_map[rule_id])
            seen.add(rule_id)
    for rule in override_rules:
        rule_id = rule.get("id")
        if rule_id and rule_id not in seen:
            merged.append(rule)
            seen.add(rule_id)
    return merged


def validate_rules_data(rules: Any) -> list[dict]:
    """Public validator for rules JSON payloads."""
    return _validate_rules_schema(rules)


RULES = load_rules()
