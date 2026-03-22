from __future__ import annotations

# TODO: Review and tune these lists with Legal/Brand. Ensure we don't block acceptable
# cases (e.g., referencing LG itself if required). Consider locale-specific variants.

COMPETITOR_BRANDS: set[str] = {
    "samsung",
    "sony",
    "whirlpool",
    "ge",
    "bosch",
    "electrolux",
    "kitchenaid",
    "panasonic",
    # Add only if business requires it.
}

SUPERLATIVES: set[str] = {
    #     "best",
    #     "perfect",
    #     "guaranteed",
    #     "unmatched",
    #     "world-class",
    #     "ultimate",
    #     "number one",
    #     "leading",
    #     "revolutionary",
}

PROHIBITED_CLAIMS: set[str] = {
    "lifetime",
    # "certified", # "Energy Star certified" is a valid claim
    "approved by",
    "guaranteed to",
    "risk-free",
}
