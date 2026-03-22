"""LG Product Agent (Google ADK-backed)

This module provides a small ADK-style agent that can answer product
information queries for LG products. It exposes `agent` (wrapper) and
`root_agent` for ADK loader compatibility.
"""

import os
import sys

# Ensure the project root (3 levels up from this file) is on sys.path so that
# `common.*` imports work regardless of how ADK web modifies sys.path.
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from typing import Any, Dict, List

try:
    from google.adk.agents import Agent 
    from common.llm.client import get_adk_litellm_model
except Exception:
    Agent = None 
    get_adk_litellm_model = None

from common.lib.utils.logging import get_logger, log_event

logger = get_logger(__name__)


# Fallback lightweight Agent shim when google.adk isn't importable in this
# runtime (e.g., local import-time conflicts). This allows the module to be
# imported and unit-tested without failing, while still using the real ADK
# when available.
if Agent is None:
    import asyncio

    class _AgentShim:
        def __init__(self, *args, tools=None, **kwargs):
            self.tools = tools or []

        async def run_async(self, prompt: str):
            # Very small heuristic-driven runner: call tools based on prompt.
            prompt_l = prompt.lower()
            if "get product by id" in prompt_l or "get product by id:" in prompt_l:
                # extract id after colon
                if ":" in prompt:
                    product_id = prompt.split(":", 1)[1].strip()
                else:
                    product_id = prompt.split()[-1]
                for t in self.tools:
                    if t.__name__.lower().find("id") != -1:
                        return await t(product_id)
                return {"found": False}
            if "search products" in prompt_l or "search products matching" in prompt_l:
                # extract query
                if ":" in prompt:
                    query = prompt.split(":", 1)[1].strip()
                else:
                    query = prompt
                for t in self.tools:
                    if t.__name__.lower().find("search") != -1:
                        return await t(query)
                return {"count": 0, "results": []}
            # default: list products
            for t in self.tools:
                if t.__name__.lower().find("search") != -1:
                    return await t("")
            return {"count": 0, "results": []}

    Agent = _AgentShim


# In-memory product catalog (kept simple for demo/testing)
_PRODUCTS: List[Dict[str, Any]] = [
    {
        "id": "lg-oled-c2-55",
        "name": "LG OLED C2 55\"",
        "category": "TV",
        "specs": {"display": "OLED", "resolution": "4K", "size": "55 inch"},
        "price_usd": 1299.99,
        "description": "LG C2 OLED 55-inch 4K smart TV with webOS.",
    },
    {
        "id": "lg-washer-twinwash",
        "name": "LG TwinWash Washer",
        "category": "Appliance",
        "specs": {"capacity_kg": 10.5, "spin_speed_rpm": 1400},
        "price_usd": 899.00,
        "description": "LG TwinWash with SmartThinQ connectivity.",
    },
]


async def _tool_get_product_by_id(product_id: str) -> Dict[str, Any]:
    """Tool: return product by id."""
    logger.info("Tool: get_product_by_id %s", product_id)
    for p in _PRODUCTS:
        if p["id"].lower() == product_id.lower():
            return {"found": True, "product": p}
    return {"found": False, "product": None}


async def _tool_search_products(query: str) -> Dict[str, Any]:
    """Tool: search products by simple substring match."""
    logger.info("Tool: search_products %s", query)
    q = query.lower()
    results = [p for p in _PRODUCTS if q in p["name"].lower() or q in p["description"].lower() or q in p["category"].lower()]
    return {"count": len(results), "results": results}



from common.config.llm import settings
from dotenv import load_dotenv

# Load .env from repository root if present, otherwise fall back to any .env
dotenv_path = os.path.join(_project_root, ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=False)
else:
    load_dotenv()

# Prefer explicit .env / OS env var values, then pydantic settings
LITELLM_BASE_URL = os.environ.get("LITELLM_BASE_URL")
LITELLM_API_KEY = os.environ.get("LITELLM_API_KEY")
LLM_MODEL = os.environ.get("LLM_MODEL")

class LGProductAgent:
    """ADK-style wrapper around a Google ADK `Agent` for LG product info."""

    def __init__(self):
        self.agent: Agent = self._create_agent()

    def _create_agent(self) -> Agent:
        try:
            from google.adk.models.lite_llm import LiteLlm
            model = LiteLlm(
                model=LLM_MODEL,
                api_base=LITELLM_BASE_URL,
                api_key=LITELLM_API_KEY,
            )
        except Exception as exc:
            logger.error("Failed to instantiate LiteLlm: %s", exc)
            model = None
        return Agent(
            model=model,
            name="lg_product_agent",
            description="Provides LG product information using catalog lookup tools.",
            instruction=(
                "You are a product assistant for LG. Use the provided tools to lookup "
                "products by id or to search the product catalog. When returning results, "
                "structure them as JSON with keys 'found'/'count' and 'product'/'results'."
            ),
            tools=[_tool_get_product_by_id, _tool_search_products],
        )

    async def get_info(self, *, product_id: str | None = None, query: str | None = None) -> Dict[str, Any]:
        """Query the ADK agent to get product information.

        Either `product_id` or `query` should be provided.
        """
        if product_id:
            prompt = f"Get product by id: {product_id}. Use tool get_product_by_id."
        elif query:
            prompt = f"Search products matching: {query}. Use tool search_products."
        else:
            prompt = "List available products."

        log_event(logger, "INFO", f"Invoking LG product agent: {product_id or query}")

        try:
            response = await self.agent.run_async(prompt)
            # return the raw response for now; callers may parse
            return {"status": "ok", "response": str(response)}
        except Exception as exc:
            logger.error("LGProductAgent error: %s", exc)
            return {"status": "error", "message": str(exc)}


# Exported instances for ADK loader and local importers
product_agent = LGProductAgent()
agent = product_agent
root_agent = product_agent.agent  # ADK requires a bare Agent instance, not a wrapper
