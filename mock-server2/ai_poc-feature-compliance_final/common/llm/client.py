"""LiteLLM configuration for Google ADK agents."""
from google.adk.models.lite_llm import LiteLlm

from common.config.llm import settings


def get_adk_litellm_model(model_name: str | None = None) -> LiteLlm:
    """
    Get LiteLLM model instance for ADK agents.

    Args:
        model_name: Optional model name override. If None, uses config default.

    Returns:
        LiteLlm instance configured with global settings
    """
    LiteLlm.use_litellm_proxy = False
    model = model_name or settings.llm_model
    return LiteLlm(model=model)
