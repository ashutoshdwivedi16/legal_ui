"""LLM call configuration for compliance validation."""
from __future__ import annotations

# ── Output token sizing ───────────────────────────────────────────────────────
# Controls how many items are sent per LLM call during compliance validation.
# Other modules using LLMValidator may have different output shapes — tune here,
# not in common/ code.
#
# Each item's response JSON is roughly:
#   {"item_index":N,"compliance_score":0.0,"violations":[...],"summary":"..."}
# A PASS entry is ~50 tokens; a FAIL with 2 violations is ~150 tokens.
# Observed actual usage: ~120 tokens/item — set to 200 to give safe headroom
# and avoid truncated JSON (which causes JSONDecodeError on the closing chars).
LLM_TOKENS_PER_ITEM_RESPONSE = 200

# Hard cap on output tokens — most LLM providers support up to 4096 per call.
# Increase this if you upgrade to a model/tier with a higher output limit.
LLM_MAX_OUTPUT_TOKENS = 4096
