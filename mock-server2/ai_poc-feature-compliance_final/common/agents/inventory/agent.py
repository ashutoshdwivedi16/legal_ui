"""Inventory agent using Google ADK."""
from typing import Any

from google.adk.agents import Agent
from sqlalchemy.ext.asyncio import AsyncSession

from common.tools.inventory_mock_tools import (
    check_inventory_levels,
    check_stockout_history,
    check_warehouse_capacity
)
from common.agents.inventory.prompts.templates import INVENTORY_AGENT_INSTRUCTION
from common.llm.client import get_adk_litellm_model
from common.lib.utils.logging import get_logger, log_event
from common.constants.logging import (
    SERVICE_KPI_MONITOR_AGENT,
    AGENT_INVENTORY,
    INFO,
    ERROR,
    AGENT_EXECUTION_STARTED,
    AGENT_EXECUTION_COMPLETED,
    AGENT_EXECUTION_FAILED,
    TOOL_EXECUTION_STARTED
)

logger = get_logger(__name__)


class InventoryAgent:
    """Sub-agent for inventory-related KPI investigation using Google ADK."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.agent = self._create_agent()
    
    def _create_agent(self) -> Agent:
        """Create Google ADK agent with inventory tools."""
        return Agent(
            model=get_adk_litellm_model(),
            name="inventory_monitor",
            description=(
                "Investigates inventory-related KPI anomalies by checking "
                "stock levels, stockout history, and warehouse capacity. "
                "Analyzes how inventory issues contribute to business metrics."
            ),
            instruction=INVENTORY_AGENT_INSTRUCTION,
            tools=[
                check_inventory_levels,
                check_stockout_history,
                check_warehouse_capacity
            ],
        )
    
    async def investigate(self, anomaly_data: dict[str, Any]) -> dict[str, Any]:
        """
        Investigate inventory-related anomaly using Google ADK agent.
        
        Args:
            anomaly_data: Dictionary containing anomaly details
        
        Returns:
            Investigation results with root cause and recommendations
        """
        log_event(
            level=INFO,
            message=f"Inventory agent investigating: {anomaly_data.get('category')} - {anomaly_data.get('metric_name')}",
            event=AGENT_EXECUTION_STARTED,
            service=SERVICE_KPI_MONITOR_AGENT,
            agent=AGENT_INVENTORY
        )
        
        try:
            # Create investigation prompt for the agent
            query = (
                f"Investigate the following anomaly from an inventory perspective:\\n"
                f"Anomaly Type: {anomaly_data.get('anomaly_type', 'unknown')}\\n"
                f"Category: {anomaly_data.get('category', 'unknown')}\\n"
                f"Metric: {anomaly_data.get('metric_name', 'unknown')}\\n"
                f"Current Value: {anomaly_data.get('metric_value', 0)}\\n"
                f"Change: {anomaly_data.get('change_percentage', 0)}%\\n"
                f"Detected At: {anomaly_data.get('detected_at', '')}\\n\\n"
                f"Use the available tools to check inventory levels, stockout history, and warehouse capacity. "
                f"Determine if inventory issues are contributing to this anomaly and provide recommendations."
            )
            
            # Execute agent
            log_event(
                level=INFO,
                message="Executing inventory tools (stock levels, stockout history, warehouse capacity)",
                event=TOOL_EXECUTION_STARTED,
                service=SERVICE_KPI_MONITOR_AGENT,
                agent=AGENT_INVENTORY
            )
            
            response = await self.agent.run_async(query)
            
            # Extract results from agent response
            result_text = str(response)
            
            # Parse the response to extract root cause and recommendations
            root_cause = self._extract_section(result_text, "Root Cause", "Recommendations")
            recommendations = self._extract_section(result_text, "Recommendations", None)
            
            if not root_cause:
                root_cause = result_text[:500] if result_text else "Unable to determine inventory-related root cause"
            if not recommendations:
                recommendations = "See analysis for details"
            
            log_event(
                level=INFO,
                message="Inventory agent investigation completed",
                event=AGENT_EXECUTION_COMPLETED,
                service=SERVICE_KPI_MONITOR_AGENT,
                agent=AGENT_INVENTORY
            )
            
            return {
                "root_cause": root_cause.strip(),
                "recommendations": recommendations.strip(),
                "tool_results": {"agent_response": result_text}
            }
        
        except Exception as e:
            log_event(
                level=ERROR,
                message=f"Inventory agent investigation error: {str(e)}",
                event=AGENT_EXECUTION_FAILED,
                service=SERVICE_KPI_MONITOR_AGENT,
                agent=AGENT_INVENTORY
            )
            return {
                "root_cause": f"Inventory investigation error: {str(e)}",
                "recommendations": "Manual inventory review required",
                "tool_results": {}
            }
    
    def _extract_section(self, text: str, start_marker: str, end_marker: str | None) -> str:
        """Extract a section of text between markers."""
        try:
            start_idx = text.find(start_marker)
            if start_idx == -1:
                return ""
            
            start_idx += len(start_marker)
            
            if end_marker:
                end_idx = text.find(end_marker, start_idx)
                if end_idx == -1:
                    return text[start_idx:].strip()
                return text[start_idx:end_idx].strip()
            else:
                return text[start_idx:].strip()
        except Exception:
            return ""

