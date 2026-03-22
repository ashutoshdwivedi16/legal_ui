"""
Compliance Scheduler - Schedule and run periodic compliance validation jobs.

This module provides scheduling capabilities for compliance validation:
1. APScheduler integration for cron-based scheduling
2. Background task running
3. Configuration-based project source setup

Usage:
    # In your application startup
    from common.agents.compliance_validator.scheduler import ComplianceScheduler
    
    scheduler = ComplianceScheduler()
    scheduler.configure_from_env()  # or configure_from_config()
    scheduler.start()
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Callable
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from common.agents.compliance_validator.batch_runner import BatchComplianceRunner
from common.lib.utils.logging import get_logger

logger = get_logger(__name__)


class ComplianceScheduler:
    """
    Scheduler for running compliance validation jobs periodically.
    
    Supports:
    - Cron-based scheduling (e.g., daily at 2 AM)
    - Manual trigger
    - Configuration from environment or config file
    """
    
    def __init__(
        self,
        database_url: Optional[str] = None,
        on_job_complete: Optional[Callable] = None
    ):
        """
        Initialize the compliance scheduler.
        
        Args:
            database_url: Database connection URL. If not provided, uses DATABASE_URL env var.
            on_job_complete: Optional callback when a job completes
        """
        self.database_url = database_url or os.getenv("DATABASE_URL")
        self.on_job_complete = on_job_complete
        self.scheduler = AsyncIOScheduler()
        self.project_configs: dict[int, list[dict]] = {}
        self._engine = None
        self._session_factory = None
    
    def _get_session_factory(self):
        """Get or create async session factory."""
        if self._session_factory is None:
            self._engine = create_async_engine(self.database_url, echo=False)
            self._session_factory = async_sessionmaker(
                self._engine, 
                class_=AsyncSession, 
                expire_on_commit=False
            )
        return self._session_factory
    
    def configure_project(
        self, 
        project_id: int, 
        sources: list[dict]
    ) -> "ComplianceScheduler":
        """
        Configure content sources for a project.
        
        Args:
            project_id: Project ID
            sources: List of source configurations
            
        Returns:
            Self for chaining
        """
        self.project_configs[project_id] = sources
        logger.info(f"Configured project {project_id} with {len(sources)} sources")
        return self
    
    def configure_from_env(self) -> "ComplianceScheduler":
        """
        Configure projects from environment variable.
        
        Expects COMPLIANCE_PROJECT_CONFIGS env var with JSON:
        {
            "project-id-1": [
                {"type": "database", "table": "...", "column": "..."}
            ]
        }
        
        Returns:
            Self for chaining
        """
        config_json = os.getenv("COMPLIANCE_PROJECT_CONFIGS")
        if config_json:
            try:
                self.project_configs = json.loads(config_json)
                logger.info(f"Loaded {len(self.project_configs)} projects from environment")
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse COMPLIANCE_PROJECT_CONFIGS: {e}")
        return self
    
    def configure_from_file(self, config_path: str) -> "ComplianceScheduler":
        """
        Configure projects from a JSON config file.
        
        Args:
            config_path: Path to JSON configuration file
            
        Returns:
            Self for chaining
        """
        try:
            with open(config_path, 'r') as f:
                self.project_configs = json.load(f)
            logger.info(f"Loaded {len(self.project_configs)} projects from {config_path}")
        except Exception as e:
            logger.error(f"Failed to load config from {config_path}: {e}")
        return self
    
    async def _run_compliance_job(self):
        """Internal method to run the compliance job."""
        logger.info("Starting scheduled compliance validation job")
        
        if not self.project_configs:
            logger.warning("No projects configured for compliance validation")
            return
        
        try:
            session_factory = self._get_session_factory()
            async with session_factory() as session:
                runner = BatchComplianceRunner(session)
                
                # Configure all projects
                for project_id, sources in self.project_configs.items():
                    runner.configure_project_sources(project_id, sources)
                
                # Run validation
                results = await runner.run_all()
                
                # Log results
                completed = sum(1 for r in results.values() if r.status == "COMPLETED")
                failed = sum(1 for r in results.values() if r.status == "FAILED")
                
                logger.info(
                    f"Scheduled compliance job complete: "
                    f"{completed} projects succeeded, {failed} failed"
                )
                
                # Call completion callback if provided
                if self.on_job_complete:
                    try:
                        self.on_job_complete(results)
                    except Exception as e:
                        logger.error(f"Error in job completion callback: {e}")
                
        except Exception as e:
            logger.error(f"Scheduled compliance job failed: {e}")
    
    def schedule_daily(
        self, 
        hour: int = 2, 
        minute: int = 0,
        timezone: str = "UTC"
    ) -> "ComplianceScheduler":
        """
        Schedule compliance job to run daily at specified time.
        
        Args:
            hour: Hour of day (0-23)
            minute: Minute (0-59)
            timezone: Timezone string
            
        Returns:
            Self for chaining
        """
        self.scheduler.add_job(
            self._run_compliance_job,
            CronTrigger(hour=hour, minute=minute, timezone=timezone),
            id="daily_compliance_job",
            name="Daily Compliance Validation",
            replace_existing=True
        )
        logger.info(f"Scheduled daily compliance job at {hour:02d}:{minute:02d} {timezone}")
        return self
    
    def schedule_cron(
        self, 
        cron_expression: str,
        timezone: str = "UTC"
    ) -> "ComplianceScheduler":
        """
        Schedule compliance job using cron expression.
        
        Args:
            cron_expression: Cron expression (e.g., "0 2 * * *" for 2 AM daily)
            timezone: Timezone string
            
        Returns:
            Self for chaining
        """
        # Parse cron expression (minute hour day month day_of_week)
        parts = cron_expression.split()
        if len(parts) >= 5:
            trigger = CronTrigger(
                minute=parts[0],
                hour=parts[1],
                day=parts[2],
                month=parts[3],
                day_of_week=parts[4],
                timezone=timezone
            )
            self.scheduler.add_job(
                self._run_compliance_job,
                trigger,
                id="cron_compliance_job",
                name="Cron Compliance Validation",
                replace_existing=True
            )
            logger.info(f"Scheduled compliance job with cron: {cron_expression}")
        else:
            logger.error(f"Invalid cron expression: {cron_expression}")
        return self
    
    def start(self):
        """Start the scheduler."""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Compliance scheduler started")
    
    def stop(self):
        """Stop the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Compliance scheduler stopped")
    
    async def run_now(self) -> dict:
        """
        Trigger an immediate compliance run (bypass scheduler).
        
        Returns:
            Dictionary of results by project_id
        """
        logger.info("Triggering immediate compliance run")
        await self._run_compliance_job()


# Example usage and configuration
EXAMPLE_CONFIG = """
# Example compliance_projects.json configuration file:
{
    "retail-product-summaries": [
        {
            "type": "database",
            "table": "products",
            "column": "ai_description",
            "id_column": "sku",
            "content_type": "product_description",
            "where": "ai_description IS NOT NULL"
        }
    ],
    "marketing-campaigns": [
        {
            "type": "database",
            "table": "campaign_content",
            "column": "generated_copy",
            "content_type": "marketing_copy"
        },
        {
            "type": "api",
            "url": "https://cms.internal/api/v1/ai-content",
            "api_key": "${CMS_API_KEY}",
            "content_type": "cms_content"
        }
    ],
    "customer-emails": [
        {
            "type": "database",
            "table": "email_templates",
            "column": "ai_body",
            "content_type": "email_template",
            "where": "status = 'draft'"
        }
    ]
}
"""
