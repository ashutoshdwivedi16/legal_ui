"""Fullstory agent using Google ADK."""
from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext

from services.rcamonitor.fullstory.tools.fullstory_tools import (
    get_session_data,
    search_sessions,
)
from services.rcamonitor.fullstory.prompts.templates import (
    FULLSTORY_AGENT_INSTRUCTION,
)
from common.llm.client import get_adk_litellm_model
from common.lib.utils.logging import get_logger

logger = get_logger(__name__)


def log_agent_thinking(callback_context: CallbackContext, **kwargs) -> None:
    """Log agent's thinking/reasoning after model response."""
    response = kwargs.get('llm_response') or getattr(callback_context, 'response', None)
    if response and hasattr(response, 'content') and response.content:
        for part in response.content.parts:
            if hasattr(part, 'text') and part.text:
                logger.info(f"Agent Thinking: {part.text[:500]}")
            if hasattr(part, 'function_call') and part.function_call:
                logger.info(f"Agent Action: {part.function_call.name}({part.function_call.args})")


# Fullstory Agent for session replay and user behavior analysis
fullstory_agent = LlmAgent(
    model=get_adk_litellm_model(),
    name="FullstoryAgent",
    description="Queries Fullstory API for session replay and user behavior data",
    instruction=FULLSTORY_AGENT_INSTRUCTION,
    tools=[get_session_data, search_sessions],
    after_model_callback=log_agent_thinking,
)
