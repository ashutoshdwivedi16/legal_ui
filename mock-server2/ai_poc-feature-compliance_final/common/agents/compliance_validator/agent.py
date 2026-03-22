"""Legal Compliance Validator Agent."""

import json
from datetime import datetime
from typing import Optional, Any
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.lib.db.models import Project, ComplianceJob, AuditResult, ProjectUrl
from common.lib.utils.logging import get_logger
from .models.schemas import (
    ContentItem,
    ValidationRequest,
    ValidationResult,
    Violation,  # Add this import
    ComplianceJobResponse,
    ValidatePromptRequest,
    ValidatePromptResponse,
    PromptViolation,
    RuleViolation
)
from services.compliance.prompts import (
    get_system_prompt,
    get_validation_prompt,
    get_prompt_validation_system_prompt,
    get_prompt_validation_user_prompt,
)
from .tools.llm_validator import LLMValidator

logger = get_logger(__name__)


def _make_preview(text: str | None) -> str:
    """
    Return a short human-readable preview of a content item's text.

    If the text is a JSON blob (dict/list), walks it and joins the first
    3 meaningful string values (>20 chars) with ' | '.
    Plain text is simply truncated to 300 chars.
    The raw input_text is preserved separately for audit/export.
    """
    if not text:
        return ""
    text = text.strip()

    if text.startswith(("{", "[")):
        try:
            obj = json.loads(text)
            strings: list[str] = []

            def _collect(node: Any) -> None:
                if isinstance(node, str) and len(node) > 20:
                    strings.append(node)
                elif isinstance(node, dict):
                    for v in node.values():
                        _collect(v)
                elif isinstance(node, list):
                    for v in node:
                        _collect(v)

            _collect(obj)
            if strings:
                preview = " | ".join(strings[:3])
                return preview[:300] + ("..." if len(preview) > 300 else "")
        except Exception:
            pass
        # JSON but unparseable — truncate raw
        return text[:300] + "..."

    # Plain text
    return text[:300] + ("..." if len(text) > 300 else "")


class ComplianceValidatorAgent:
    """Agent for validating AI-generated content against legal rules."""

    def __init__(self, session: AsyncSession | None = None, model: Any = None):
        """
        Initialize the compliance validator agent.

        Args:
            session: Database session
            model: Optional LLM model to use
        """
        self.session = session

        # Enforce shared ADK model usage for compliance validation
        if model is None:
            try:
                from common.llm.client import get_adk_litellm_model
                model = get_adk_litellm_model()
                logger.info("Using shared Google ADK model for Compliance Validator")
            except Exception as e:
                logger.error(f"Failed to load shared ADK model: {e}")
                raise RuntimeError("Compliance validation requires shared ADK model configuration") from e

        self.llm_validator = LLMValidator(model=model)

    async def get_active_rules(self, rules: list[dict] | None = None) -> list[dict]:
        """
        Get all active compliance rules.
        Source of truth is rules.json (no database lookup).

        Returns:
            List of rule dictionaries
        """
        from common.agents.compliance_validator.rules.rules_loader import load_rules
        rules = rules or load_rules()
        return [r for r in rules if r.get("is_active", True)]

    async def validate_system_prompt(
        self,
        request: ValidatePromptRequest
    ) -> ValidatePromptResponse:
        """
        Validate a system prompt or JSON content against compliance rules.
        Does NOT require database access.
        """
        try:
            # Get content to validate
            content_to_validate = request.get_content_for_validation()
            content_type = request.content_type or ("json_response" if request.is_json_content() else "prompt")

            # Use LLM validator to check against rules
            result = await self.llm_validator.validate_content_standalone(
                content=content_to_validate,
                content_type=content_type,
                application_name=request.application_name or "Unknown Application"
            )

            # Convert to response
            violations = [
                RuleViolation(
                    rule_id=v.get("rule_id", "unknown"),
                    rule_name=v.get("rule_name", "Unknown Rule"),
                    severity=v.get("severity", "MEDIUM"),
                    message=v.get("message", v.get("issue", "")),
                    field=v.get("field"),
                    expected_value=v.get("expected_value"),
                    actual_value=v.get("actual_value")
                )
                for v in result.get("violations", [])
            ]

            compliance_score = result.get("compliance_score", 1.0 if not violations else 0.0)
            is_compliant = compliance_score >= 0.7 and len(violations) == 0

            return ValidatePromptResponse(
                is_compliant=is_compliant,
                compliance_score=compliance_score,
                total_rules_checked=result.get("total_rules_checked", 14),
                violations_count=len(violations),
                violations=violations,
                summary=result.get("summary", f"Validation complete. Found {len(violations)} violation(s)."),
                content_type=content_type
            )

        except Exception as e:
            logger.error(f"Error during prompt validation: {e}")
            return ValidatePromptResponse(
                is_compliant=False,
                compliance_score=0.0,
                total_rules_checked=0,
                violations_count=0,
                violations=[],
                summary=f"Error during validation: {str(e)}",
                content_type=request.content_type or "prompt"
            )

    async def validate_single_item(
        self,
        content_item: ContentItem,
        system_prompt: str,
        rules: list[dict] | None = None
    ) -> tuple[ContentItem, ValidationResult]:
        """
        Validate a single content item.

        Args:
            content_item: The content item to validate
            system_prompt: The system prompt with rules (not used - rules passed directly)
            rules: List of compliance rules from database

        Returns:
            Tuple of (content_item, validation_result)
        """
        try:
            # Use llm_validator with standalone method, passing rules
            result = await self.llm_validator.validate_content_standalone(
                content=content_item.text,
                content_type=content_item.content_type,
                application_name=content_item.source or "Unknown",
                rules=rules
            )

            # Log raw result for debugging
            logger.debug(f"LLM result for {content_item.content_id}: {result}")

            # Convert LLM result to Violation objects (matching ValidationResult schema)
            violations = []
            for v in result.get("violations", []):
                violations.append(
                    Violation(
                        rule_id=v.get("rule_id", "unknown"),
                        severity=v.get("severity", "MEDIUM"),
                        reasoning=v.get("message", "") or v.get("reasoning", "No details provided"),
                        action_required=v.get("suggestion", "") or v.get("action_required", "Review and fix the violation")
                    )
                )

            compliance_score = result.get("compliance_score", 0.0)

            # Determine status based on violations first, then score
            if len(violations) > 0:
                status = "FAIL"
            elif compliance_score >= 0.7:
                status = "PASS"
            else:
                status = "FAIL"

            validation_result = ValidationResult(
                score=compliance_score,
                status=status,
                violations=violations
            )

            logger.info(f"Validated item {content_item.content_id}: {status} (score: {compliance_score}, violations: {len(violations)})")
            return (content_item, validation_result)

        except Exception as e:
            logger.error(f"Error validating item {content_item.content_id}: {e}", exc_info=True)
            return (content_item, ValidationResult(
                score=0.0,
                status="ERROR",
                violations=[]
            ))

    async def run_compliance_job(
        self,
        project_id: int,
        content_items: list[ContentItem],
        max_concurrent: int = 5,
        project_prompt: str | None = None,
        rules: list[dict] | None = None,
        rules_mode: str | None = None,
        rules_uri: str | None = None,
    ) -> ComplianceJobResponse:
        """
        Run a compliance validation job.

        Args:
            project_id: The project ID
            content_items: List of content items to validate
            max_concurrent: Maximum concurrent validations

        Returns:
            ComplianceJobResponse with job details
        """
        try:
            # Verify project exists
            project_result = await self.session.execute(
                select(Project).where(Project.id == project_id)
            )
            project = project_result.scalar_one_or_none()

            if not project:
                return ComplianceJobResponse(
                    job_id=0,
                    status="FAILED",
                    message=f"Project {project_id} not found"
                )

            # Get active rules
            rules = await self.get_active_rules(rules)

            if not rules:
                return ComplianceJobResponse(
                    job_id=0,
                    status="FAILED",
                    message="No active compliance rules found"
                )

            # Create job record (let DB autogenerate id)
            from sqlalchemy.exc import IntegrityError
            job = ComplianceJob(
                project_id=project_id,
                status="RUNNING",
                run_date=datetime.utcnow(),
                total_scanned=len(content_items),
                pass_count=0,
                fail_count=0,
                error_count=0,
                applied_rule_ids={
                    "rules": [r["id"] for r in rules],
                    "mode": rules_mode or ("custom" if rules is not None else "global"),
                    "uri": rules_uri,
                }
            )
            self.session.add(job)
            try:
                await self.session.commit()
                await self.session.refresh(job)
                job_id = job.id
                logger.info(f"Started compliance job {job_id} for project {project_id}")
            except IntegrityError as ie:
                await self.session.rollback()
                logger.error(f"IntegrityError creating compliance job: {ie}")
                return ComplianceJobResponse(
                    job_id=0,
                    status="FAILED",
                    message="Failed to create compliance job: duplicate or constraint violation. Please check for existing jobs or data integrity."
                )
            except Exception as e:
                await self.session.rollback()
                logger.error(f"Unexpected error creating compliance job: {e}")
                return ComplianceJobResponse(
                    job_id=0,
                    status="FAILED",
                    message=f"Failed to create compliance job: {str(e)}"
                )

            # Generate system prompt
            system_prompt = get_system_prompt(rules, extra_instructions=project_prompt)

            # ── Single LLM call for ALL items ─────────────────────────────────
            # Rules prompt (~1,200 tokens) is paid ONCE regardless of N items.
            # LLM returns a JSON array with one entry per item (indexed by position)
            # so each item still gets its own AuditResult row below.
            logger.info(f"Running {len(content_items)} items in 1 LLM call")

            all_items_input = [
                {"content_id": item.content_id, "content": item.text, "content_type": item.content_type}
                for item in content_items
            ]
            llm_results = await self.llm_validator.validate_batch(
                items=all_items_input,
                rules=rules,
                application_name=f"Project {project_id}",
            )

            # Pair each ContentItem with its LLM result by position (item_index)
            results = []
            for item, llm_result in zip(content_items, llm_results):
                violations = [
                    Violation(
                        rule_id=v.get("rule_id", "unknown"),
                        severity=v.get("severity", "MEDIUM"),
                        reasoning=v.get("message", "") or v.get("reasoning", ""),
                        action_required=v.get("suggestion", "") or v.get("action_required", ""),
                    )
                    for v in llm_result.get("violations", [])
                ]
                score = llm_result.get("compliance_score", 0.0)
                # LLM scoring: 1.0=clean, 0.7-0.9=MEDIUM only, 0.4-0.6=HIGH, 0.0-0.3=CRITICAL
                # PASS = score >= 0.7 (MEDIUM violations are advisory, not blockers)
                # FAIL = score < 0.7  (HIGH or CRITICAL violations present)
                status = "PASS" if score >= 0.7 else "FAIL"
                results.append((item, ValidationResult(score=score, status=status, violations=violations)))

            # Process results and save to database
            pass_count = 0
            fail_count = 0
            error_count = 0

            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Validation task failed: {result}")
                    error_count += 1
                    continue

                content_item, validation_result = result

                # Determine violation type (highest severity)
                violation_type = None
                if validation_result.violations:
                    severities = [v.severity for v in validation_result.violations]
                    if "CRITICAL" in severities:
                        violation_type = "CRITICAL"
                    elif "HIGH" in severities:
                        violation_type = "HIGH"
                    elif "MEDIUM" in severities:
                        violation_type = "MEDIUM"
                    else:
                        violation_type = "LOW"

                # Count status
                if validation_result.status == "PASS":
                    pass_count += 1
                elif validation_result.status == "FAIL":
                    fail_count += 1
                elif validation_result.status == "ERROR":
                    error_count += 1

                # Build reasoning string with full details
                llm_reasoning = None
                if validation_result.violations:
                    reasoning_parts = []
                    for v in validation_result.violations:
                        reasoning_parts.append(
                            f"[{v.rule_id}] ({v.severity}): {v.reasoning}"
                        )
                    llm_reasoning = "\n\n".join(reasoning_parts)

                # Build correction hints
                correction_hint = None
                if validation_result.violations:
                    hint_parts = []
                    for v in validation_result.violations:
                        hint_parts.append(
                            f"[{v.rule_id}]: {v.action_required}"
                        )
                    correction_hint = "\n\n".join(hint_parts)

                # Create audit result with full violation details (let DB autogenerate id)
                audit_result = AuditResult(
                    job_id=job_id,
                    content_id=content_item.content_id,
                    content_type=content_item.content_type,
                    source=content_item.source,
                    input_text=content_item.text[:5000] if len(content_item.text) > 5000 else content_item.text,  # Truncate if too long
                    compliance_score=validation_result.score,
                    status=validation_result.status,
                    violation_type=violation_type,
                    failed_rules=[v.rule_id for v in validation_result.violations],
                    llm_reasoning=llm_reasoning,
                    correction_hint=correction_hint
                )
                self.session.add(audit_result)

                # Log for debugging
                if validation_result.violations:
                    logger.info(f"Stored {len(validation_result.violations)} violations for {content_item.content_id}")

            # Update job with final counts
            job.status = "COMPLETED"
            job.pass_count = pass_count
            job.fail_count = fail_count
            job.error_count = error_count

            await self.session.commit()

            logger.info(
                f"Completed compliance job {job_id}: "
                f"{pass_count} passed, {fail_count} failed, {error_count} errors"
            )

            return ComplianceJobResponse(
                job_id=job_id,
                status="COMPLETED",
                message=f"Validation completed: {pass_count} passed, {fail_count} failed, {error_count} errors"
            )

        except Exception as e:
            logger.error(f"Error running compliance job: {e}")

            # Update job status to FAILED if it was created
            if 'job' in locals():
                job.status = "FAILED"
                await self.session.commit()

            return ComplianceJobResponse(
                job_id=job_id if 'job_id' in locals() else 0,
                status="FAILED",
                message=f"Job failed: {str(e)}"
            )

    async def get_job_details(self, job_id: int) -> Optional[dict]:
        """
        Get details of a compliance job.

        Args:
            job_id: The job ID

        Returns:
            Job details dictionary or None
        """
        result = await self.session.execute(
            select(ComplianceJob).where(ComplianceJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            return None

        return {
            "job_id": job.id,
            "project_id": job.project_id,
            "status": job.status,
            "run_date": job.run_date.isoformat(),
            "total_scanned": job.total_scanned,
            "pass_count": job.pass_count,
            "fail_count": job.fail_count,
            "error_count": job.error_count,
            "ignored_count": getattr(job, "ignored_count", 0),
        }

    async def get_job_failures(self, job_id: int) -> list[dict]:
        """
        Get all failed items for a job (compliance_score < 0.7).

        Args:
            job_id: The job ID

        Returns:
            List of failure dictionaries
        """
        result = await self.session.execute(
            select(AuditResult)
            .where(AuditResult.job_id == job_id)
            .where(AuditResult.compliance_score < 0.7)
            .where(AuditResult.status != "IGNORED")
            .order_by(AuditResult.created_at)
        )
        failures = result.scalars().all()

        return [
            {
                "id": failure.id,
                "content_id": failure.content_id,
                "content_type": failure.content_type,
                "source": failure.source,
                "content_preview": _make_preview(failure.input_text),
                "input_text": failure.input_text,
                "compliance_score": failure.compliance_score,
                "status": failure.status,
                "violation_type": failure.violation_type,
                "failed_rules": failure.failed_rules,
                "llm_reasoning": failure.llm_reasoning,
                "correction_hint": failure.correction_hint
            }
            for failure in failures
        ]

    async def get_projects_with_jobs(self, limit: int = 10) -> list[dict]:
        """
        Get projects with their recent jobs.

        Args:
            limit: Maximum number of jobs per project

        Returns:
            List of project dictionaries with jobs
        """
        # Get all projects
        projects_result = await self.session.execute(
            select(Project).order_by(Project.created_at.desc())
        )
        projects = projects_result.scalars().all()

        result = []
        for project in projects:
            # Get recent jobs for this project
            jobs_result = await self.session.execute(
                select(ComplianceJob)
                .where(ComplianceJob.project_id == project.id)
                .order_by(ComplianceJob.run_date.desc())
                .limit(limit)
            )
            jobs = jobs_result.scalars().all()

            urls_result = await self.session.execute(
                select(ProjectUrl).where(ProjectUrl.project_id == project.id)
            )
            urls = urls_result.scalars().all()
            data_sources = [
                {"url": url.url, "json_keys": url.json_keys or []}
                for url in urls
            ]

            result.append({
                "id": project.id,
                "project_name": project.project_name,
                "project_description": project.project_description,
                "project_prompt": getattr(project, "project_prompt", None),
                "rules_mode": getattr(project, "rules_mode", "global"),
                "rules_uri": getattr(project, "rules_uri", None),
                "created_at": project.created_at.isoformat(),
                "urls": [url.url for url in urls],
                "data_sources": data_sources,
                "jobs": [
                    {
                        "job_id": job.id,
                        "status": job.status,
                        "run_date": job.run_date.isoformat(),
                        "total_scanned": job.total_scanned,
                        "pass_count": job.pass_count,
                        "fail_count": job.fail_count,
                        "error_count": job.error_count,
                        "ignored_count": getattr(job, "ignored_count", 0),
                    }
                    for job in jobs
                ]
            })
        
        return result
