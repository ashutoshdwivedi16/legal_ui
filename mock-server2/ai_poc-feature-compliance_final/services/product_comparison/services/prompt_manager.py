from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from common.config import get_logger

logger = get_logger(__name__)

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = ROOT / "prompts" / "templates"
CATEGORY_DIR = TEMPLATES_DIR / "category"


def _available_category_stems() -> list[str]:
    """Return lowercased stems of all .md files in the category template directory."""
    try:
        return [p.stem.lower() for p in CATEGORY_DIR.glob("*.md")]
    except OSError:
        return []


def resolve_category(raw: str | list | None) -> str:
    """Resolve a raw PDS category value to a prompt-template category name.

    The PDS ``category`` column is a JSON array (e.g.
    ``["b2c", "computing", "monitor_tv", "monitors"]``).  This function
    finds the first element that contains an available category-template
    stem as a substring (scanning from most-specific to least-specific)
    and returns that stem.

    Accepts:
      - A Python list (asyncmy deserialises MySQL JSON columns)
      - A JSON-encoded string
      - A plain string such as ``"TV"`` (used in test mocks)
      - None

    Returns a lowercased category name (e.g. ``"tv"``, ``"monitor"``)
    or ``"unknown"`` when no match is found.
    """
    if raw is None:
        return "unknown"

    # --- normalise to a list of strings -----------------------------------
    items: list[str] | None = None

    if isinstance(raw, list):
        items = [str(i) for i in raw]
    elif isinstance(raw, str):
        stripped = raw.strip()
        if stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, list):
                    items = [str(i) for i in parsed]
            except (json.JSONDecodeError, ValueError):
                pass
        # Plain string (e.g. "TV") — wrap so the matching loop works the same
        if items is None:
            items = [stripped]

    if not items:
        return "unknown"

    stems = _available_category_stems()
    if not stems:
        # No category templates on disk — fall back to last element
        return items[-1].lower()

    # Walk from the end (most-specific PDS segment) to the front
    for element in reversed(items):
        lower = element.lower()
        for stem in stems:
            if stem in lower:
                logger.debug(
                    "Category resolved",
                    extra={
                        "event": "category_resolve",
                        "raw": raw if not isinstance(raw, list) else items,
                        "matched_element": element,
                        "resolved": stem,
                    },
                )
                return stem

    # No stem matched — return last element lowercased
    fallback = items[-1].lower()
    logger.debug(
        "Category resolved via fallback",
        extra={
            "event": "category_resolve_fallback",
            "raw": raw if not isinstance(raw, list) else items,
            "resolved": fallback,
        },
    )
    return fallback


def _read_text(path: Path) -> str | None:
    try:
        content = path.read_text(encoding="utf-8")
        logger.debug(
            "File template loaded",
            extra={"event": "template_file_read", "path": str(path), "size": len(content)},
        )
        return content
    except Exception as e:
        logger.debug(
            "File template not found",
            extra={"event": "template_file_not_found", "path": str(path), "error": str(e)},
        )
        return None


async def load_prompts(category: str) -> tuple[str, str, str | None] | None:
    """
    Load system and user prompt templates for a category.
    All prompts are loaded from filesystem (per decision A3).

    The user prompt is always user_default.md. If a matching category file
    exists in prompts/templates/category/{category}.md, its content is
    returned as the category_addendum to be injected into the
    {CATEGORY_ADDENDUM} placeholder.

    Returns (system_prompt, user_template, category_addendum) or None if
    the required base templates are not found.
    """
    logger.debug(
        "Loading prompts for category",
        extra={"event": "prompts_load_start", "category": category},
    )

    # Load system prompt (always system_default.md)
    system_default = _read_text(TEMPLATES_DIR / "system_default.md")

    # Load user prompt (always user_default.md)
    user_default = _read_text(TEMPLATES_DIR / "user_default.md")

    # Load optional category-specific addendum
    category_addendum = _read_text(TEMPLATES_DIR / "category" / f"{category.lower()}.md")

    if system_default and user_default:
        logger.info(
            "Loaded prompts from filesystem",
            extra={
                "event": "prompts_load_files",
                "category": category,
                "has_category_addendum": category_addendum is not None,
            },
        )
        return system_default, user_default, category_addendum

    logger.warning(
        "No prompts found for category",
        extra={"event": "prompts_not_found", "category": category},
    )
    return None


def _flatten_specs(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flatten nested spec attributes into compact key-value maps to reduce token usage.

    Converts from:
        {"refrigerator_energy_spec": {"spec_attributes": [{"spec_name": "X", "spec_value": "Y"}], "spec_group_name": "Energy"}}
    To:
        {"Energy": {"X": "Y"}}
    """
    result = []
    for product in products:
        p = dict(product)
        specs_raw = p.get("specs")
        if specs_raw:
            specs = json.loads(specs_raw) if isinstance(specs_raw, str) else specs_raw
            flat: dict[str, dict[str, str]] = {}
            for group_key, group in specs.items():
                if isinstance(group, dict) and "spec_attributes" in group:
                    group_name = group.get("spec_group_name", group_key)
                    flat[group_name] = {
                        attr["spec_name"]: attr["spec_value"]
                        for attr in group["spec_attributes"]
                        if "spec_name" in attr and "spec_value" in attr
                    }
            p["specs"] = json.dumps(flat, ensure_ascii=False) if isinstance(specs_raw, str) else flat
        result.append(p)
    return result


def build_user_prompt(
    user_template: str,
    *,
    products: list[dict[str, Any]],
    category: str | None = None,
    category_addendum: str | None = None,
) -> str:
    """Render the user prompt template.

    Supports the newer template variables:
      - {CATEGORY}
      - {CATEGORY_ADDENDUM}
      - {PRODUCT_DATA_JSON}

    Falls back to the legacy "PRODUCT_DATA=" injection if those placeholders
    aren't present.
    """
    payload = {"products": _flatten_specs(products)}
    data_json = json.dumps(payload, ensure_ascii=False, indent=2)

    rendered = user_template

    if (
        "{PRODUCT_DATA_JSON}" in rendered
        or "{CATEGORY}" in rendered
        or "{CATEGORY_ADDENDUM}" in rendered
    ):
        rendered = rendered.replace("{PRODUCT_DATA_JSON}", data_json)
        rendered = rendered.replace("{CATEGORY}", (category or ""))
        rendered = rendered.replace("{CATEGORY_ADDENDUM}", (category_addendum or ""))
        logger.debug(
            "User prompt built with template variables",
            extra={
                "event": "prompt_built",
                "template_style": "new",
                "product_count": len(products),
                "prompt_length": len(rendered),
            },
        )
        return rendered

    # Legacy fallback
    legacy_prompt = f"{user_template.strip()}\n\nPRODUCT_DATA=\n{data_json}\n"
    logger.debug(
        "User prompt built with legacy style",
        extra={
            "event": "prompt_built",
            "template_style": "legacy",
            "product_count": len(products),
            "prompt_length": len(legacy_prompt),
        },
    )
    return legacy_prompt
