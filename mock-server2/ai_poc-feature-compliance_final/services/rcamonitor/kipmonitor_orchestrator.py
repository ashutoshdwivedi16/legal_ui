"""RCA Orchestrator - Main multi-agent system."""
import uuid
import warnings
from typing import Any
from google.adk.agents import LlmAgent
from google.adk.tools.agent_tool import AgentTool
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

# Suppress Pydantic serialization warnings from LiteLLM/ADK
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

from common.llm.client import get_adk_litellm_model
from common.tools.inventory_mock_tools import (
    check_inventory_levels,
    check_stockout_history,
    check_warehouse_capacity,
)
from common.tools.retail_monitor_mock_tools import (
    check_competitor_pricing,
    check_pricing_changes,
)
from common.agents.inventory.prompts.templates import INVENTORY_AGENT_INSTRUCTION
from common.agents.retail_monitor.prompts.templates import RETAIL_MONITOR_INSTRUCTION
from common.lib.utils.logging import get_logger, log_event
from common.constants.logging import (
    SERVICE_KPI_MONITOR_AGENT,
    INFO,
    ERROR,
    INVESTIGATION_STARTED,
    INVESTIGATION_COMPLETED,
    INVESTIGATION_FAILED,
)

logger = get_logger(__name__)
session_service = InMemorySessionService()

ORCHESTRATOR_INSTRUCTION = """You are the RCA (Root Cause Analysis) Orchestrator.

Your role is to coordinate anomaly investigations by:
1. Understanding the type of anomaly reported
2. Delegating to the appropriate specialist sub-agent(s)
3. Ensuring comprehensive investigation with tool usage
4. Synthesizing findings into clear root cause and recommendations

Available Sub-Agents:
- inventory_monitor: Handles inventory-related anomalies (stock levels, stockouts, warehouse capacity)
- retail_monitor: Handles retail and e-commerce KPI anomalies (pricing, competitor analysis)
- SynthesisAgent: Combines findings from multiple agents into a final report

When an anomaly is reported:
1. Determine which agent(s) are most relevant
2. Use inventory_monitor for stock availability and warehouse issues
3. Use retail_monitor for pricing and competitive analysis
4. Pass all findings to SynthesisAgent for final report
5. Ensure the sub-agents use all available tools to gather evidence"""

# Sub-agents
inventory_checker_agent = LlmAgent(
    model=get_adk_litellm_model(),
    name="inventory_monitor",
    description=(
        "Investigates inventory-related KPI anomalies by checking "
        "stock levels, stockout history, and warehouse capacity."
    ),
    instruction=INVENTORY_AGENT_INSTRUCTION,
    tools=[check_inventory_levels, check_stockout_history, check_warehouse_capacity],
)

price_checker_agent = LlmAgent(
    model=get_adk_litellm_model(),
    name="retail_monitor",
    description=(
        "Investigates retail and e-commerce KPI anomalies by checking "
        "competitor pricing and internal pricing changes."
    ),
    instruction=RETAIL_MONITOR_INSTRUCTION,
    tools=[check_competitor_pricing, check_pricing_changes],
)

synthesis_agent = LlmAgent(
    model=get_adk_litellm_model(),
    name="SynthesisAgent",
    description="Synthesizes findings from multiple investigation agents into a final report",
    instruction=(
        "You are a Synthesis Agent. Your role is to combine findings from multiple "
        "investigation agents into a clear, structured final report. Include: "
        "1) Root Cause summary, 2) Evidence from each agent, 3) Recommendations."
    ),
)

# Main Orchestrator
rca_orchestrator = LlmAgent(
    model=get_adk_litellm_model(),
    name="RCAOrchestrator",
    description="Intelligent Root Cause Analysis orchestrator",
    instruction=ORCHESTRATOR_INSTRUCTION,
    tools=[
        AgentTool(agent=inventory_checker_agent),
        AgentTool(agent=price_checker_agent),
        AgentTool(agent=synthesis_agent),
    ]
)


async def investigate_anomaly(anomaly_data: dict[str, Any]) -> dict[str, Any]:
    """
    Investigate an anomaly using the RCA multi-agent system.
    
    Args:
        anomaly_data: Dictionary containing:
            - anomaly_type: "sku_level", "category_level", etc.
            - sku or mdsku: Product identifier
            - metric_name: "revenue", "conversion_rate", etc.
            - metric_value: Current value
            - change_percentage: Percentage change
            - detected_at: ISO timestamp
            - category: Product category (optional)
            
    Returns:
        Dictionary with RCA findings
    """
    # Build investigation query
    query = _build_investigation_query(anomaly_data)
    content = types.Content(role='user', parts=[types.Part(text=query)])
    
    log_event(
        level=INFO,
        message=f"RCA Investigation started: {anomaly_data.get('anomaly_type')} - {anomaly_data.get('sku', 'N/A')}",
        event=INVESTIGATION_STARTED,
        service=SERVICE_KPI_MONITOR_AGENT
    )
    
    # Create session
    session_id = str(uuid.uuid4())
    user_id = "rca_system"
    
    await session_service.create_session(
        session_id=session_id,
        user_id=user_id,
        app_name="RCA-System"
    )
    
    # Create runner
    runner = Runner(
        agent=rca_orchestrator,
        app_name="RCA-System",
        session_service=session_service
    )
    
    try:
        full_response = ""
        reasoning_steps = []
        tool_calls = []
        
        async for event in runner.run_async(
            session_id=session_id,
            user_id=user_id,
            new_message=content
        ):
            # 1. Capture tool calls (sub-agent delegation)
            if event.get_function_calls():
                for call in event.get_function_calls():
                    log_event(
                        level=INFO,
                        message=f"🤔 Thinking: Delegating to {call.name}...",
                        event="agent_delegating",
                        service=SERVICE_KPI_MONITOR_AGENT
                    )
            
            # 2. Capture sub-agent results
            if event.get_function_responses():
                for resp in event.get_function_responses():
                    tool_calls.append({
                        "tool": resp.name,
                        "result_preview": str(resp.response)
                    })
                    log_event(
                        level=INFO,
                        message=f"✅ Received output from {resp.name}",
                        event="tool_result",
                        service=SERVICE_KPI_MONITOR_AGENT
                    )
            
            # 3. Capture thinking/intermediate text
            if hasattr(event, 'content') and event.content and hasattr(event.content, 'parts'):
                for part in event.content.parts or []:
                    if hasattr(part, 'text') and part.text and not event.is_final_response():
                        log_event(
                            level=INFO,
                            message=f"💭 Thinking: {part.text}...",
                            event="agent_thinking",
                            service=SERVICE_KPI_MONITOR_AGENT
                        )
            
            # 4. Final response
            if event.is_final_response():
                if hasattr(event, 'content') and event.content and hasattr(event.content, 'parts'):
                    for part in event.content.parts or []:
                        if hasattr(part, 'text') and part.text:
                            full_response = part.text
                
                log_event(
                    level=INFO,
                    message=f"✅ RCA Complete. Tools used: {len(tool_calls)}",
                    event=INVESTIGATION_COMPLETED,
                    service=SERVICE_KPI_MONITOR_AGENT
                )
        
        return {
            "anomaly_type": anomaly_data.get('anomaly_type'),
            "sku": anomaly_data.get('sku') or anomaly_data.get('mdsku'),
            "investigation_complete": True,
            "root_cause_analysis": full_response,
            "reasoning_steps": reasoning_steps,
            "tools_used": tool_calls,
            "session_id": session_id
        }
        
    except Exception as e:
        log_event(
            level=ERROR,
            message=f"RCA failed: {e}",
            event=INVESTIGATION_FAILED,
            service=SERVICE_KPI_MONITOR_AGENT
        )
        raise


def _build_investigation_query(anomaly_data: dict[str, Any]) -> str:
    """Build investigation query from anomaly data."""
    anomaly_type = anomaly_data.get('anomaly_type', 'unknown')
    sku = anomaly_data.get('sku') or anomaly_data.get('mdsku', 'N/A')
    metric = anomaly_data.get('metric_name', 'unknown_metric')
    value = anomaly_data.get('metric_value', 'N/A')
    change = anomaly_data.get('change_percentage', 'N/A')
    timestamp = anomaly_data.get('detected_at', 'N/A')
    category = anomaly_data.get('category', 'N/A')
    
    query = f"""**ANOMALY INVESTIGATION REQUEST**

**Anomaly Type:** {anomaly_type}
**Product SKU/MDSKU:** {sku}
**Category:** {category}
**Metric:** {metric}
**Current Value:** {value}
**Change:** {change}%
**Detected At:** {timestamp}

**Your Task:**
Investigate this anomaly and determine the root cause.

1. First, assess if you have the right tools:
   - SKU-level anomaly → Use PriceCheckerAgent + InventoryCheckerAgent
   - Category/Site-level → Explain what tools are needed

2. If you can investigate:
   - Call PriceCheckerAgent with sku='{sku}' and timestamp='{timestamp}'
   - Call InventoryCheckerAgent with mdsku='{sku}' and timestamp='{timestamp}'
   - Analyze the data you receive

3. Finally:
   - Pass all findings to SynthesisAgent for final report
   - Include pricing data, inventory data, and your analysis

Begin investigation now.
"""
    return query
