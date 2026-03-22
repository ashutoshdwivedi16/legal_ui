"""
Batch Compliance Runner - Runs compliance validation across all projects/content sources.

This module provides:
1. BatchComplianceRunner - Orchestrates fetching content and running validation
2. Integration with job scheduling (can be triggered by cron, API, or event)
3. Support for running against all projects or specific project filters
"""

import asyncio
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.lib.db.models import Project, ComplianceJob
from common.agents.compliance_validator.agent import ComplianceValidatorAgent
from common.agents.compliance_validator.models.schemas import ContentItem, ComplianceJobResponse
from common.agents.compliance_validator.services.content_fetcher import ContentFetcher
from common.lib.utils.logging import get_logger

logger = get_logger(__name__)


class BatchComplianceRunner:
    """
    Orchestrates batch compliance validation across all projects.
    
    This is the main entry point for scheduled jobs that need to validate
    AI-generated content against the master system prompt (legal rules).
    
    Usage:
        runner = BatchComplianceRunner(session)
        
        # Configure content sources for each project
        runner.configure_project_sources("project-123", [
            {"type": "database", "table": "product_summaries", "column": "ai_summary"},
            {"type": "api", "url": "https://api.example.com/content"}
        ])
        
        # Run validation for all configured projects
        results = await runner.run_all()
    """
    
    def __init__(self, session: AsyncSession):
        """
        Initialize batch compliance runner.
        
        Args:
            session: Database session
        """
        self.session = session
        self.agent = ComplianceValidatorAgent(session)
        self.project_sources: dict[str, list[dict]] = {}
    
    def configure_project_sources(
        self, 
        project_id: str, 
        sources: list[dict]
    ) -> "BatchComplianceRunner":
        """
        Configure content sources for a project.
        
        Args:
            project_id: Project ID
            sources: List of source configurations, each with:
                - type: "database" or "api"
                - For database: table, column, id_column (optional), where (optional)
                - For api: url, api_key (optional), headers (optional)
                - content_type (optional): Type of content being validated
                
        Returns:
            Self for chaining
        """
        self.project_sources[project_id] = sources
        return self
    
    async def _build_content_fetcher(
        self, 
        project_id: str
    ) -> ContentFetcher:
        """Build a content fetcher for a specific project."""
        fetcher = ContentFetcher(self.session)
        
        sources = self.project_sources.get(project_id, [])
        
        for source_config in sources:
            source_type = source_config.get("type", "database")
            content_type = source_config.get("content_type", "summary")
            
            if source_type == "database":
                fetcher.add_database_source(
                    table_name=source_config["table"],
                    content_column=source_config["column"],
                    id_column=source_config.get("id_column", "id"),
                    content_type=content_type,
                    where_clause=source_config.get("where")
                )
            elif source_type == "api":
                fetcher.add_api_source(
                    api_url=source_config["url"],
                    api_key=source_config.get("api_key"),
                    content_type=content_type,
                    headers=source_config.get("headers")
                )
        
        return fetcher
    
    async def run_for_project(
        self, 
        project_id: int,
        content_items: Optional[list[ContentItem]] = None
    ) -> ComplianceJobResponse:
        """
        Run compliance validation for a specific project.
        
        Args:
            project_id: Project ID
            content_items: Optional pre-fetched content. If not provided,
                          will fetch from configured sources.
                          
        Returns:
            ComplianceJobResponse with results
        """
        try:
            # If content not provided, fetch from configured sources
            if content_items is None:
                fetcher = await self._build_content_fetcher(project_id)
                content_items = await fetcher.fetch_all_content()
            
            if not content_items:
                logger.warning(f"No content items found for project {project_id}")
                return ComplianceJobResponse(
                    job_id=0,
                    status="COMPLETED",
                    message="No content items to validate"
                )
            
            logger.info(f"Running compliance validation for project {project_id} with {len(content_items)} items")
            
            # Run the compliance job
            project_prompt = None
            rules = None
            try:
                project_result = await self.session.execute(
                    select(Project).where(Project.id == project_id)
                )
                project = project_result.scalar_one_or_none()
                project_prompt = project.project_prompt if project else None
                rules_mode = project.rules_mode if project else "global"
                rules_uri = project.rules_uri if project else None
                from common.agents.compliance_validator.rules.rules_loader import load_rules, merge_rules
                if rules_mode == "global":
                    rules = load_rules()
                elif rules_mode == "project":
                    if not rules_uri:
                        raise ValueError("rules_uri is required for project rules mode")
                    rules = load_rules(rules_uri)
                elif rules_mode == "global+project":
                    if not rules_uri:
                        raise ValueError("rules_uri is required for global+project rules mode")
                    rules = merge_rules(load_rules(), load_rules(rules_uri))
                else:
                    raise ValueError(f"Invalid rules_mode: {rules_mode}")
            except Exception as e:
                logger.error(f"Rules resolution failed for project {project_id}: {e}")
                return ComplianceJobResponse(
                    job_id=0,
                    status="FAILED",
                    message=f"Rules resolution failed: {str(e)}"
                )

            result = await self.agent.run_compliance_job(
                project_id=project_id,
                content_items=content_items,
                project_prompt=project_prompt,
                rules=rules,
                rules_mode=rules_mode,
                rules_uri=rules_uri,
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error running compliance for project {project_id}: {e}")
            return ComplianceJobResponse(
                job_id=0,
                status="FAILED",
                message=f"Error: {str(e)}"
            )
    
    async def run_all(
        self, 
        project_ids: Optional[list[int]] = None
    ) -> dict[int, ComplianceJobResponse]:
        """
        Run compliance validation for all (or specified) projects.
        
        Args:
            project_ids: Optional list of specific project IDs to run.
                        If not provided, runs for all projects with configured sources.
                        
        Returns:
            Dictionary mapping project_id to ComplianceJobResponse
        """
        # Determine which projects to run
        if project_ids is None:
            project_ids = list(self.project_sources.keys())
        
        if not project_ids:
            logger.warning("No projects configured for batch compliance run")
            return {}
        
        logger.info(f"Starting batch compliance run for {len(project_ids)} projects")
        
        results = {}
        for project_id in project_ids:
            result = await self.run_for_project(project_id)
            results[project_id] = result
            
            # Log progress
            logger.info(
                f"Project {project_id}: {result.status} - {result.message}"
            )
        
        # Summary
        completed = sum(1 for r in results.values() if r.status == "COMPLETED")
        failed = sum(1 for r in results.values() if r.status == "FAILED")
        
        logger.info(
            f"Batch compliance run complete: {completed} succeeded, {failed} failed"
        )
        
        return results


async def run_scheduled_compliance_job(
    session: AsyncSession,
    project_configs: dict[str, list[dict]]
) -> dict[str, ComplianceJobResponse]:
    """
    Entry point for scheduled compliance jobs (e.g., from a cron job or scheduler).
    
    This function should be called by your job scheduler (APScheduler, Celery, etc.)
    
    Args:
        session: Database session
        project_configs: Dictionary mapping project_id to list of source configs
        
    Returns:
        Dictionary mapping project_id to job results
        
    Example project_configs:
        {
            "project-retail-summaries": [
                {
                    "type": "database",
                    "table": "product_descriptions",
                    "column": "ai_summary",
                    "content_type": "product_summary"
                }
            ],
            "project-marketing-content": [
                {
                    "type": "api",
                    "url": "https://cms.example.com/api/ai-content",
                    "api_key": "xxx",
                    "content_type": "marketing_copy"
                }
            ]
        }
    """
    runner = BatchComplianceRunner(session)
    
    # Configure all project sources
    for project_id, sources in project_configs.items():
        runner.configure_project_sources(project_id, sources)
    
    # Run validation for all projects
    return await runner.run_all()
