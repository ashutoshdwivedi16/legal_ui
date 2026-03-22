"""Retail monitor sub-agent using Google ADK."""
from typing import Any

from google.adk.agents import Agent
from sqlalchemy.ext.asyncio import AsyncSession

from common.tools.retail_monitor_mock_tools import (
    check_competitor_pricing,
    check_pricing_changes
)
from common.agents.retail_monitor.prompts.templates import RETAIL_MONITOR_INSTRUCTION
from common.llm.client import get_adk_litellm_model
from common.lib.utils.logging import get_logger, log_event
from common.constants.logging import (
    SERVICE_KPI_MONITOR_AGENT,
    AGENT_RETAIL_MONITOR,
    INFO,
    ERROR,
    AGENT_EXECUTION_STARTED,
    AGENT_EXECUTION_COMPLETED,
    AGENT_EXECUTION_FAILED,
    TOOL_EXECUTION_STARTED
)

logger = get_logger(__name__)


class RetailMonitorAgent:
    """Sub-agent for retail/e-commerce KPI investigation using Google ADK."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.agent = self._create_agent()
    
    def _create_agent(self) -> Agent:
        """Create Google ADK agent with tools."""
        return Agent(
            model=get_adk_litellm_model(),
            name="retail_monitor",
            description=(
                "Investigates retail and e-commerce KPI anomalies by checking "
                "competitor pricing and internal pricing changes. "
                "Analyzes data to identify root causes and provide actionable recommendations."
            ),
            instruction=RETAIL_MONITOR_INSTRUCTION,
            tools=[
                check_competitor_pricing,
                check_pricing_changes
            ],
        )
    
    async def investigate(self, anomaly_data: dict[str, Any]) -> dict[str, Any]:
        """
        Investigate retail anomaly using Google ADK agent.
        
        Args:
            anomaly_data: Dictionary containing anomaly details
        
        Returns:
            Investigation results with root cause and recommendations
        """
        log_event(
            level=INFO,
            message=f"Retail agent investigating: {anomaly_data.get('category')} - {anomaly_data.get('metric_name')}",
            event=AGENT_EXECUTION_STARTED,
            service=SERVICE_KPI_MONITOR_AGENT,
            agent=AGENT_RETAIL_MONITOR
        )
        
        try:
            # Create investigation prompt for the agent
            query = (
                f"Investigate the following anomaly:\n"
                f"Anomaly Type: {anomaly_data.get('anomaly_type', 'unknown')}\n"
                f"Category: {anomaly_data.get('category', 'unknown')}\n"
                f"Metric: {anomaly_data.get('metric_name', 'unknown')}\n"
                f"Current Value: {anomaly_data.get('metric_value', 0)}\n"
                f"Change: {anomaly_data.get('change_percentage', 0)}%\n"
                f"Detected At: {anomaly_data.get('detected_at', '')}\n\n"
                f"Use the available tools to check inventory, pricing, and competitor activity. "
                f"Then provide a comprehensive analysis with root cause and recommendations."
            )
            
            # Execute agent
            log_event(
                level=INFO,
                message="Executing retail monitor tools (competitor pricing, pricing changes)",
                event=TOOL_EXECUTION_STARTED,
                service=SERVICE_KPI_MONITOR_AGENT,
                agent=AGENT_RETAIL_MONITOR
            )
            
            response = await self.agent.run_async(query)
            
            # Extract results from agent response
            result_text = str(response)
            
            # Parse the response to extract root cause and recommendations
            # The agent should structure its response appropriately
            root_cause = self._extract_section(result_text, "Root Cause", "Recommendations")
            recommendations = self._extract_section(result_text, "Recommendations", None)
            
            if not root_cause:
                root_cause = result_text[:500] if result_text else "Unable to determine root cause"
            if not recommendations:
                recommendations = "See analysis for details"
            
            log_event(
                level=INFO,
                message="Retail agent investigation completed",
                event=AGENT_EXECUTION_COMPLETED,
                service=SERVICE_KPI_MONITOR_AGENT,
                agent=AGENT_RETAIL_MONITOR
            )
            
            return {
                "root_cause": root_cause.strip(),
                "recommendations": recommendations.strip(),
                "tool_results": {"agent_response": result_text}
            }
        
        except Exception as e:
            log_event(
                level=ERROR,
                message=f"Retail agent investigation error: {str(e)}",
                event=AGENT_EXECUTION_FAILED,
                service=SERVICE_KPI_MONITOR_AGENT,
                agent=AGENT_RETAIL_MONITOR
            )
            return {
                "root_cause": f"Investigation error: {str(e)}",
                "recommendations": "Manual investigation required",
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
