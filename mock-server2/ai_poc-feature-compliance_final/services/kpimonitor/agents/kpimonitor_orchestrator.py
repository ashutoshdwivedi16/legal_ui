"""Orchestrator agent using Google ADK for routing anomalies to sub-agents."""
from typing import Any

from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
from sqlalchemy.ext.asyncio import AsyncSession

from common.models.requests import AnomalyDetectionRequest
from common.models.responses import InvestigationResponse
from common.lib.db.models import AnomalyAudit
from common.agents.retail_monitor.agent import RetailMonitorAgent
from common.agents.inventory.agent import InventoryAgent
from common.llm.client import get_adk_litellm_model
from common.lib.utils.logging import get_logger, log_event
from common.constants.logging import (
    SERVICE_KPI_MONITOR_AGENT,
    AGENT_ORCHESTRATOR,
    INFO,
    ERROR,
    INVESTIGATION_STARTED,
    INVESTIGATION_COMPLETED,
    INVESTIGATION_FAILED,
    AGENT_DELEGATED,
    DATABASE_INSERT
)

logger = get_logger(__name__)

ORCHESTRATOR_INSTRUCTION = """You are the KPI Monitor Orchestrator.

Your role is to coordinate anomaly investigations by:
1. Understanding the type of anomaly reported
2. Delegating to the appropriate specialist sub-agent(s)
3. Ensuring comprehensive investigation with tool usage
4. Synthesizing findings into clear root cause and recommendations

Available Sub-Agents:
- retail_monitor: Handles retail and e-commerce KPI anomalies (conversion rates, sales metrics, product performance, competitor pricing)
- inventory_monitor: Handles inventory-related anomalies (stock levels, stockouts, warehouse capacity)

When an anomaly is reported:
1. Determine which agent(s) are most relevant (you can use multiple agents if needed)
2. Use retail_monitor for pricing and competitive analysis
3. Use inventory_monitor for stock availability and warehouse issues
4. Ensure the sub-agents use all available tools to gather evidence
5. Synthesize the findings clearly

Always delegate to the appropriate sub-agent(s) for investigation."""


class OrchestratorAgent:
    """
    Orchestrator agent using Google ADK with sub-agents as tools.
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
        # Initialize sub-agents
        self.retail_agent = RetailMonitorAgent(session)
        self.inventory_agent = InventoryAgent(session)
        # Create orchestrator with sub-agents as tools
        self.orchestrator = self._create_orchestrator()
    
    def _create_orchestrator(self) -> Agent:
        """Create Google ADK orchestrator agent with sub-agent tools."""
        return Agent(
            model=get_adk_litellm_model(),
            name="kpi_orchestrator",
            description=(
                "Orchestrates KPI anomaly investigations by routing to specialist "
                "sub-agents and synthesizing their findings."
            ),
            instruction=ORCHESTRATOR_INSTRUCTION,
            tools=[
                AgentTool(agent=self.retail_agent.agent),
                AgentTool(agent=self.inventory_agent.agent),
            ],
        )
    
    async def investigate(self, request: AnomalyDetectionRequest) -> InvestigationResponse:
        """
        Main investigation entry point using Google ADK orchestrator.
        
        Args:
            request: Anomaly detection request
        
        Returns:
            Investigation response with results
        """
        log_event(
            level=INFO,
            message=f"Starting investigation: {request.anomaly_type} - {request.metric_name} ({request.change_percentage}% change)",
            event=INVESTIGATION_STARTED,
            service=SERVICE_KPI_MONITOR_AGENT,
            agent=AGENT_ORCHESTRATOR
        )
        
        # Create audit record
        audit = AnomalyAudit(
            anomaly_type=request.anomaly_type,
            category=request.category,
            metric_name=request.metric_name,
            metric_value=request.metric_value,
            change_percentage=request.change_percentage,
            detected_at=request.detected_at,
            assigned_agent="kpi_orchestrator",
            investigation_status="in_progress",
            metadata_json=request.metadata
        )
        
        self.session.add(audit)
        await self.session.flush()
        
        log_event(
            level=INFO,
            message=f"Created audit record ID: {audit.id}",
            event=DATABASE_INSERT,
            service=SERVICE_KPI_MONITOR_AGENT,
            agent=AGENT_ORCHESTRATOR
        )
        
        try:
            # Create query for orchestrator
            query = (
                f"Investigate this anomaly:\\n"
                f"Type: {request.anomaly_type}\\n"
                f"Category: {request.category}\\n"
                f"Metric: {request.metric_name}\\n"
                f"Current Value: {request.metric_value}\\n"
                f"Change: {request.change_percentage}%\\n"
                f"Detected At: {request.detected_at}\\n\\n"
                f"Use the appropriate sub-agent(s) to perform a thorough investigation. "
                f"Consider both retail/pricing factors and inventory factors."
            )
            
            # Execute orchestrator agent
            log_event(
                level=INFO,
                message="Delegating investigation to sub-agents",
                event=AGENT_DELEGATED,
                service=SERVICE_KPI_MONITOR_AGENT,
                agent=AGENT_ORCHESTRATOR
            )
            
            response = await self.orchestrator.run_async(query)
            
            # Parse response
            result_text = str(response)
            
            log_event(
                level=INFO,
                message=f"Investigation completed for audit {audit.id}",
                event=INVESTIGATION_COMPLETED,
                service=SERVICE_KPI_MONITOR_AGENT,
                agent=AGENT_ORCHESTRATOR
            )
            
            # Extract root cause and recommendations from response
            root_cause = self._extract_section(result_text, "Root Cause", "Recommendations")
            recommendations = self._extract_section(result_text, "Recommendations", None)
            
            if not root_cause:
                root_cause = result_text[:500] if result_text else "Investigation completed"
            if not recommendations:
                recommendations = "See investigation details"
            
            # Update audit with results
            audit.root_cause = root_cause.strip()
            audit.recommendations = recommendations.strip()
            audit.tool_results = {"orchestrator_response": result_text}
            audit.investigation_status = "completed"
            audit.assigned_agent = "retail_monitor"
            
            await self.session.commit()
            
            return InvestigationResponse(
                audit_id=audit.id,
                anomaly_type=audit.anomaly_type,
                category=audit.category,
                assigned_agent=audit.assigned_agent,
                investigation_status=audit.investigation_status,
                root_cause=audit.root_cause,
                recommendations=audit.recommendations,
                created_at=audit.created_at
            )
        
        except Exception as e:
            log_event(
                level=ERROR,
                message=f"Investigation failed: {str(e)}",
                event=INVESTIGATION_FAILED,
                service=SERVICE_KPI_MONITOR_AGENT,
                agent=AGENT_ORCHESTRATOR
            )
            audit.investigation_status = "failed"
            audit.root_cause = f"Investigation error: {str(e)}"
            await self.session.commit()
            raise
    
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
