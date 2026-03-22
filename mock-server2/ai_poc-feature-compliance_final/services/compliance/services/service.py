"""Compliance orchestration service."""
from __future__ import annotations

from typing import Any
import json
import httpx

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from common.agents.compliance_validator import ComplianceValidatorAgent
from common.agents.compliance_validator.batch_runner import BatchComplianceRunner
from common.agents.compliance_validator.models.schemas import ContentItem
from common.lib.db.models import Project, ProjectUrl, ComplianceJob, AuditResult, ComplianceRule
from services.compliance.repositories import (
    get_project,
    list_project_urls,
    replace_project_urls as repo_replace_project_urls,
    list_job_ids_for_project,
    delete_audits_for_jobs,
    delete_jobs_for_project,
)
from common.agents.compliance_validator.rules.rules_loader import load_rules, merge_rules
from common.constants.logging import (
    API_REQUEST_COMPLETED,
    API_REQUEST_FAILED,
    API_REQUEST_RECEIVED,
    ERROR,
    INFO,
    SERVICE_API,
)
from common.lib.utils.logging import log_event


async def get_projects_with_jobs(session: AsyncSession, limit: int = 3) -> list[dict]:
    agent = ComplianceValidatorAgent(session)
    return await agent.get_projects_with_jobs(limit=limit)


async def run_compliance_for_project(
    session: AsyncSession,
    project_id: int,
) -> Any:
    log_event(
        level=INFO,
        message=f"Starting compliance job for project {project_id}",
        event=API_REQUEST_RECEIVED,
        service=SERVICE_API,
    )

    try:
        agent = ComplianceValidatorAgent(session)
        project_result = await session.execute(
            select(Project).where(Project.id == project_id)
        )
        project = project_result.scalar_one_or_none()
        project_prompt = project.project_prompt if project else None
        rules_mode = project.rules_mode if project else "global"
        rules_uri = project.rules_uri if project else None

        rules = _resolve_project_rules(rules_mode, rules_uri)

        content_items = await _fetch_url_content_items(session, project_id)

        if not content_items:
            raise HTTPException(
                status_code=400,
                detail="No data sources configured for this project. Add a JSON URL with keys to validate.",
            )

        result = await agent.run_compliance_job(
            project_id=project_id,
            content_items=content_items,
            project_prompt=project_prompt,
            rules=rules,
            rules_mode=rules_mode,
            rules_uri=rules_uri,
        )

        log_event(
            level=INFO,
            message=(
                f"Compliance job completed for project {project_id} "
                f"(job_id={result.job_id}, status={result.status})"
            ),
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        log_event(
            level=ERROR,
            message=f"Compliance job failed for project {project_id}: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        raise HTTPException(status_code=500, detail=str(e))


def _normalize_url(url: str) -> str:
    url = url.strip()
    if not url:
        return url
    if url.lower().startswith(("http://", "https://")):
        return url
    return f"https://{url}"


def _extract_json_path(payload: Any, path: str) -> Any:
    """Navigate dot-notation path. Supports array indexing (e.g. items.0.title)."""
    current = payload
    for part in path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and part.isdigit():
            idx = int(part)
            current = current[idx] if idx < len(current) else None
        else:
            return None
    return current


def _coerce_value_to_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        parts = []
        for v in value:
            if isinstance(v, str):
                parts.append(v)
            elif v is not None:
                parts.append(json.dumps(v, ensure_ascii=False))
        return "\n".join(parts) if parts else None
    return json.dumps(value, ensure_ascii=False)


def _iter_records(data: Any, json_keys: list[str]) -> list[tuple[str, str, str]]:
    """
    Given the fetched JSON and a list of keys, yield (content_id_suffix, content_type, text) tuples.

    Handles three shapes:
      1. Root array of objects:  [{...}, {...}]  — key is a field name inside each object
      2. Nested array:           {"products": [{...}]}  — first key is the array path, rest are field names
      3. Single object:          {"title": "...", "desc": "..."}  — each key is a top-level field
    """
    records = []

    # Case 1: root is a list of objects
    if isinstance(data, list) and all(isinstance(i, dict) for i in data):
        for idx, obj in enumerate(data):
            for key in json_keys:
                val = _extract_json_path(obj, key)
                text = _coerce_value_to_text(val)
                if text:
                    records.append((f"[{idx}]::{key}", key, text))
        return records

    # Case 2 & 3: root is a dict
    if isinstance(data, dict):
        for key in json_keys:
            extracted = _extract_json_path(data, key)

            # If this key resolves to a list of objects → iterate each object
            if isinstance(extracted, list) and all(isinstance(i, dict) for i in extracted):
                # remaining keys after the array key become the field names to pull from each object
                remaining_keys = [k for k in json_keys if k != key]
                if not remaining_keys:
                    # No sub-keys specified — stringify each object as one item
                    for idx, obj in enumerate(extracted):
                        text = json.dumps(obj, ensure_ascii=False)
                        records.append((f"{key}[{idx}]", key, text))
                else:
                    for idx, obj in enumerate(extracted):
                        for sub_key in remaining_keys:
                            val = _extract_json_path(obj, sub_key)
                            text = _coerce_value_to_text(val)
                            if text:
                                records.append((f"{key}[{idx}]::{sub_key}", sub_key, text))
                return records  # handled as array — don't process remaining keys again

            # If this key resolves to a list of strings → each string is one item
            elif isinstance(extracted, list):
                for idx, val in enumerate(extracted):
                    text = _coerce_value_to_text(val)
                    if text:
                        records.append((f"{key}[{idx}]", key, text))

            # Scalar or nested object → single item
            else:
                text = _coerce_value_to_text(extracted)
                if text:
                    records.append((key, key, text))

    return records


async def _fetch_url_content_items(
    session: AsyncSession,
    project_id: int,
) -> list[ContentItem]:
    urls = await list_project_urls(session, project_id)
    if not urls:
        return []

    items: list[ContentItem] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for url_row in urls:
            json_keys = url_row.json_keys or []
            if isinstance(json_keys, str):
                json_keys = [json_keys]
            if not isinstance(json_keys, list) or not json_keys:
                continue
            url = _normalize_url(url_row.url)
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
            except Exception:
                continue

            for suffix, content_type, text in _iter_records(data, json_keys):
                items.append(
                    ContentItem(
                        content_id=f"{url}::{suffix}",
                        content_type=content_type,
                        source=url,
                        text=text,
                    )
                )
    return items


def _source_to_dict(source: Any) -> dict:
    source_dict = {
        "type": source.type,
        "content_type": source.content_type,
    }
    if source.type == "database":
        source_dict.update(
            {
                "table": source.table,
                "column": source.column,
                "id_column": source.id_column,
                "where": source.where,
            }
        )
    elif source.type == "api":
        source_dict.update(
            {
                "url": source.url,
                "api_key": source.api_key,
                "headers": source.headers,
            }
        )
    return source_dict


async def run_batch_compliance(session: AsyncSession, request: Any) -> dict:
    log_event(
        level=INFO,
        message=f"Starting batch compliance run for {len(request.projects)} projects",
        event=API_REQUEST_RECEIVED,
        service=SERVICE_API,
    )

    try:
        runner = BatchComplianceRunner(session)

        for project_config in request.projects:
            sources = [_source_to_dict(source) for source in project_config.sources]
            runner.configure_project_sources(project_config.project_id, sources)

        results = await runner.run_all()

        result_list = [
            {
                "project_id": project_id,
                "job_id": result.job_id,
                "status": result.status,
                "message": result.message,
            }
            for project_id, result in results.items()
        ]

        completed = sum(1 for r in result_list if r["status"] == "COMPLETED")
        failed = sum(1 for r in result_list if r["status"] == "FAILED")

        log_event(
            level=INFO,
            message=f"Batch compliance run complete: {completed} succeeded, {failed} failed",
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )

        return {
            "total_projects": len(result_list),
            "completed": completed,
            "failed": failed,
            "results": result_list,
        }

    except Exception as e:
        log_event(
            level=ERROR,
            message=f"Batch compliance run failed: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        raise HTTPException(status_code=500, detail=str(e))


async def run_project_compliance_with_sources(
    session: AsyncSession,
    project_id: int,
    sources: list[Any],
) -> Any:
    log_event(
        level=INFO,
        message=f"Running compliance for project {project_id} with {len(sources)} sources",
        event=API_REQUEST_RECEIVED,
        service=SERVICE_API,
    )

    try:
        runner = BatchComplianceRunner(session)
        source_configs = [_source_to_dict(source) for source in sources]
        runner.configure_project_sources(project_id, source_configs)
        result = await runner.run_for_project(project_id)

        log_event(
            level=INFO,
            message=f"Project compliance run complete: {result.status}",
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )

        return result

    except Exception as e:
        log_event(
            level=ERROR,
            message=f"Project compliance run failed: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        raise HTTPException(status_code=500, detail=str(e))


def _normalize_data_sources(
    data_sources: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    if not data_sources:
        return []
    normalized = []
    for source in data_sources:
        url = (source.get("url") or "").strip()
        if not url:
            continue
        keys = source.get("json_keys") or []
        normalized.append({"url": url, "json_keys": keys})
    return normalized


def _resolve_project_rules(rules_mode: str, rules_uri: str | None) -> list[dict]:
    if rules_mode == "global":
        return load_rules()
    if rules_mode in {"project", "global+project"} and not rules_uri:
        raise HTTPException(
            status_code=400,
            detail="rules_uri is required when rules_mode is project or global+project",
        )
    if rules_mode == "project":
        return load_rules(rules_uri)
    if rules_mode == "global+project":
        return merge_rules(load_rules(), load_rules(rules_uri))
    raise HTTPException(status_code=400, detail=f"Invalid rules_mode: {rules_mode}")


async def create_project_with_urls(
    session: AsyncSession,
    project_name: str,
    project_description: str | None,
    project_prompt: str | None,
    data_sources: list[dict[str, Any]],
    rules_mode: str = "global",
    rules_uri: str | None = None,
) -> dict:
    if rules_mode in {"project", "global+project"} and not rules_uri:
        raise HTTPException(
            status_code=400,
            detail="rules_uri is required when rules_mode is project or global+project",
        )
    project = Project(
        project_name=project_name,
        project_description=project_description,
        project_prompt=project_prompt,
        rules_mode=rules_mode,
        rules_uri=rules_uri,
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)

    normalized_sources = _normalize_data_sources(data_sources)
    for source in normalized_sources:
        session.add(
            ProjectUrl(
                project_id=project.id,
                url=source["url"],
                json_keys=source.get("json_keys") or [],
            )
        )
    if normalized_sources:
        await session.commit()

    return {
        "id": project.id,
        "project_name": project.project_name,
        "project_description": project.project_description,
        "created_at": project.created_at.isoformat(),
        "urls": [s["url"] for s in normalized_sources],
        "data_sources": normalized_sources,
        "rules_mode": project.rules_mode,
        "rules_uri": project.rules_uri,
    }


async def replace_project_urls(
    session: AsyncSession,
    project_id: int,
    project_name: str | None,
    project_description: str | None,
    project_prompt: str | None,
    data_sources: list[dict[str, Any]] | None,
    rules_mode: str | None,
    rules_uri: str | None,
) -> dict:
    project = await get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    if project_name is not None:
        project.project_name = project_name
    if project_description is not None:
        project.project_description = project_description
    if project_prompt is not None:
        project.project_prompt = project_prompt
    if rules_mode is not None:
        project.rules_mode = rules_mode
    if rules_uri is not None:
        project.rules_uri = rules_uri
    if project.rules_mode in {"project", "global+project"} and not project.rules_uri:
        raise HTTPException(
            status_code=400,
            detail="rules_uri is required when rules_mode is project or global+project",
        )

    normalized_sources = _normalize_data_sources(data_sources)

    await repo_replace_project_urls(session, project_id, normalized_sources)
    await session.commit()

    return {
        "id": project.id,
        "project_name": project.project_name,
        "project_description": project.project_description,
        "project_prompt": project.project_prompt,
        "urls": [s["url"] for s in normalized_sources],
        "data_sources": normalized_sources,
        "rules_mode": project.rules_mode,
        "rules_uri": project.rules_uri,
    }


async def delete_project_and_related(session: AsyncSession, project_id: int) -> None:
    # Check if project exists
    project = await get_project(session, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    # 1. Get all jobs for this project
    job_ids = await list_job_ids_for_project(session, project_id)

    # 2. Delete audit results for those jobs
    await delete_audits_for_jobs(session, job_ids)

    # 3. Delete the jobs
    await delete_jobs_for_project(session, project_id)

    # 4. Delete associated urls
    await session.execute(delete(ProjectUrl).where(ProjectUrl.project_id == project_id))

    # 5. Delete the project
    await session.delete(project)
    await session.commit()


async def get_job_details(session: AsyncSession, job_id: int) -> dict | None:
    agent = ComplianceValidatorAgent(session)
    return await agent.get_job_details(job_id)


async def get_job_failures(session: AsyncSession, job_id: int) -> list[dict]:
    agent = ComplianceValidatorAgent(session)
    return await agent.get_job_failures(job_id)


async def get_compliance_rules(session: AsyncSession) -> list[dict]:
    result = await session.execute(select(ComplianceRule))
    rules = result.scalars().all()
    return [
        {
            "id": rule.id,
            "rule_name": rule.rule_name,
            "prompt_instruction": rule.prompt_instruction,
            "severity": rule.severity,
            "is_active": rule.is_active,
        }
        for rule in rules
    ]


async def update_audit_ignore(
    session: AsyncSession,
    audit_id: int,
    ignore_reasoning: bool,
    ignored_fields: list[str] | None,
) -> dict:
    result = await session.execute(
        select(AuditResult).where(AuditResult.id == audit_id)
    )
    audit = result.scalar_one_or_none()
    if not audit:
        raise HTTPException(status_code=404, detail=f"Audit {audit_id} not found")

    audit.ignore_reasoning = ignore_reasoning
    audit.ignored_fields = ignored_fields or []
    if ignore_reasoning:
        audit.status = "IGNORED"

    await session.commit()

    # Recompute job counts for accuracy
    job_id = audit.job_id
    counts_result = await session.execute(
        select(AuditResult.status).where(AuditResult.job_id == job_id)
    )
    statuses = [row[0] for row in counts_result.all()]
    pass_count = sum(1 for s in statuses if s == "PASS")
    fail_count = sum(1 for s in statuses if s == "FAIL")
    error_count = sum(1 for s in statuses if s == "ERROR")
    ignored_count = sum(1 for s in statuses if s == "IGNORED")

    job_result = await session.execute(
        select(ComplianceJob).where(ComplianceJob.id == job_id)
    )
    job = job_result.scalar_one_or_none()
    if job:
        job.pass_count = pass_count
        job.fail_count = fail_count
        job.error_count = error_count
        job.ignored_count = ignored_count
        await session.commit()

    return {
        "id": audit.id,
        "job_id": audit.job_id,
        "status": audit.status,
        "ignore_reasoning": audit.ignore_reasoning,
        "ignored_fields": audit.ignored_fields,
    }


async def validate_prompt_content(request: Any) -> Any:
    agent = ComplianceValidatorAgent(session=None)
    from common.agents.compliance_validator.models.schemas import ValidatePromptRequest

    payload = ValidatePromptRequest(
        system_prompt=request.system_prompt,
        json_content=request.json_content,
        application_name=request.application_name,
        content_type=request.content_type,
    )
    return await agent.validate_system_prompt(payload)
