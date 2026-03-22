"""Compliance API routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import base64
import time
from urllib.parse import urlparse
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path
import json

from common.lib.db.session import get_session
from common.lib.utils.logging import get_logger, log_event
from common.constants.logging import (
    SERVICE_API,
    INFO,
    ERROR,
    API_REQUEST_RECEIVED,
    API_REQUEST_COMPLETED,
    API_REQUEST_FAILED,
)

from services.compliance.services.service import (
    create_project_with_urls,
    replace_project_urls,
    run_compliance_for_project,
    run_batch_compliance,
    run_project_compliance_with_sources,
    validate_prompt_content,
    get_projects_with_jobs,
    delete_project_and_related,
    get_job_details,
    get_job_failures,
    get_compliance_rules,
    update_audit_ignore,
)
from services.compliance.repositories import get_project
from services.compliance.models import (
    CreateProjectRequest,
    UpdateProjectRequest,
    ContentSourceConfig,
    ProjectSourceConfig,
    BatchComplianceRequest,
    BatchComplianceResult,
    BatchComplianceResponse,
    ValidatePromptRequest,
    ValidatePromptResponse,
    ProxyAuthConfig,
    ProxyRequest,
    IgnoreReasoningRequest,
    ComplianceRuleResponse,
)
from services.compliance.prompt_injection.api import router as prompt_injection_router
from common.agents.compliance_validator.rules.rules_loader import validate_rules_data

router = APIRouter(prefix="/compliance", tags=["compliance"])
logger = get_logger(__name__)

# Mount prompt injection under compliance scope
router.include_router(prompt_injection_router, prefix="/prompt-injection")




@router.get("/projects")
async def get_projects(session: AsyncSession = Depends(get_session)):
    """Get all projects with their recent jobs."""
    try:
        projects = await get_projects_with_jobs(session, limit=3)
        log_event(
            level=INFO,
            message=f"Retrieved {len(projects)} compliance projects",
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )
        return {"projects": projects}
    except Exception as e:
        log_event(
            level=ERROR,
            message=f"Failed to get compliance projects: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects")
async def create_project(
    request: CreateProjectRequest,
    session: AsyncSession = Depends(get_session),
):
    """Create a new compliance project."""
    try:
        payload = await create_project_with_urls(
            session=session,
            project_name=request.project_name,
            project_description=request.project_description,
            project_prompt=request.project_prompt,
            data_sources=request.data_sources,
            rules_mode=request.rules_mode,
            rules_uri=request.rules_uri,
        )
        log_event(
            level=INFO,
            message=f"Created compliance project: {payload['id']}",
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )
        return payload
    except Exception as e:
        await session.rollback()
        log_event(
            level=ERROR,
            message=f"Failed to create compliance project: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/projects/{project_id}")
async def update_project(
    project_id: int,
    request: UpdateProjectRequest,
    session: AsyncSession = Depends(get_session),
):
    """Update an existing compliance project."""
    try:
        result = await replace_project_urls(
            session,
            project_id,
            request.project_name,
            request.project_description,
            request.project_prompt,
            request.data_sources,
            request.rules_mode,
            request.rules_uri,
        )
        log_event(
            level=INFO,
            message=f"Updated compliance project: {project_id}",
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        log_event(
            level=ERROR,
            message=f"Failed to update compliance project: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete a compliance project and related jobs/audits."""
    try:
        await delete_project_and_related(session, project_id)
        log_event(
            level=INFO,
            message=f"Deleted compliance project: {project_id}",
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )
        return {"message": f"Project {project_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        log_event(
            level=ERROR,
            message=f"Failed to delete compliance project: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/run")
async def run_compliance_job(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Trigger a compliance validation job for a project."""
    return await run_compliance_for_project(session, project_id)


@router.post("/projects/{project_id}/rules/upload")
async def upload_project_rules(
    project_id: int,
    rules_file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    """
    Upload and validate a project-specific rules.json file.
    Stores it under common/agents/compliance_validator/projects/<project_id>/rules.json
    and updates the project's rules_mode + rules_uri.
    """
    # Ensure project exists
    project = await get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    raw = await rules_file.read()
    try:
        data = json.loads(raw.decode("utf-8"))
        validate_rules_data(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid rules.json: {str(e)}")

    base_dir = Path("common/agents/compliance_validator/projects") / str(project_id)
    base_dir.mkdir(parents=True, exist_ok=True)
    rules_path = base_dir / "rules.json"
    rules_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # Update project to use project rules
    project.rules_mode = "project"
    project.rules_uri = f"file://{rules_path.resolve()}"
    await session.commit()

    return {
        "project_id": project_id,
        "rules_mode": project.rules_mode,
        "rules_uri": project.rules_uri,
        "stored_path": str(rules_path),
    }


@router.get("/jobs/{job_id}/details")
async def job_details(
    job_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get details of a compliance job."""
    try:
        details = await get_job_details(session, job_id)
        if not details:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        log_event(
            level=INFO,
            message=f"Retrieved details for job {job_id}",
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )
        return details
    except HTTPException:
        raise
    except Exception as e:
        log_event(
            level=ERROR,
            message=f"Failed to get job details: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_id}/failures")
async def job_failures(
    job_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get all failed items for a job."""
    try:
        failures = await get_job_failures(session, job_id)
        log_event(
            level=INFO,
            message=f"Retrieved {len(failures)} failures for job {job_id}",
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )
        return {"failures": failures}
    except Exception as e:
        log_event(
            level=ERROR,
            message=f"Failed to get job failures: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate-prompt", response_model=ValidatePromptResponse)
async def validate_prompt(request: ValidatePromptRequest):
    """Validate a system prompt or AI-generated JSON response for compliance."""
    log_event(
        level=INFO,
        message=f"Validating content for application: {request.application_name}, type: {request.content_type}",
        event=API_REQUEST_RECEIVED,
        service=SERVICE_API,
    )

    try:
        result = await validate_prompt_content(request)
        log_event(
            level=INFO,
            message=(
                "Content validation complete: "
                f"compliant={result.is_compliant}, score={result.compliance_score}"
            ),
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )
        return result
    except Exception as e:
        log_event(
            level=ERROR,
            message=f"Content validation failed: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-run", response_model=BatchComplianceResponse)
async def batch_run(
    request: BatchComplianceRequest,
    session: AsyncSession = Depends(get_session),
):
    """Run compliance validation across multiple projects."""
    payload = await run_batch_compliance(session, request)
    return BatchComplianceResponse(
        total_projects=payload["total_projects"],
        completed=payload["completed"],
        failed=payload["failed"],
        results=[BatchComplianceResult(**item) for item in payload["results"]],
    )


@router.post("/projects/{project_id}/run-with-sources")
async def run_with_sources(
    project_id: int,
    sources: list[ContentSourceConfig],
    session: AsyncSession = Depends(get_session),
):
    """Run compliance validation for a single project with specified sources."""
    return await run_project_compliance_with_sources(session, project_id, sources)


@router.get("/rules", response_model=list[ComplianceRuleResponse])
async def list_compliance_rules(session: AsyncSession = Depends(get_session)):
    """List all compliance rules."""
    return await get_compliance_rules(session)


@router.patch("/audits/{audit_id}/ignore")
async def ignore_audit_reasoning(
    audit_id: int,
    payload: IgnoreReasoningRequest,
    session: AsyncSession = Depends(get_session),
):
    """Mark an audit result's reasoning as ignored."""
    return await update_audit_ignore(
        session=session,
        audit_id=audit_id,
        ignore_reasoning=payload.ignore_reasoning,
        ignored_fields=payload.ignored_fields,
    )


@router.post("/proxy-request")
async def proxy_request(request: ProxyRequest):
    """
    Proxy HTTP request to avoid browser CORS and protect credentials.
    """
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    if not url.lower().startswith(("http://", "https://")):
        url = f"https://{url}"

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Only http/https URLs are allowed")

    headers = dict(request.headers or {})
    params = dict(request.params or {})
    auth = request.auth or ProxyAuthConfig()

    if auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth.type == "basic" and auth.username is not None:
        raw = f"{auth.username}:{auth.password or ''}".encode("utf-8")
        headers["Authorization"] = f"Basic {base64.b64encode(raw).decode('utf-8')}"
    elif auth.type == "api-key" and auth.apiKeyName and auth.apiKeyValue:
        if (auth.apiKeyLocation or "header") == "query":
            params[auth.apiKeyName] = auth.apiKeyValue
        else:
            headers[auth.apiKeyName] = auth.apiKeyValue

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.request(
                method=request.method.upper(),
                url=url,
                headers=headers,
                params=params,
                content=request.body or None,
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Proxy request failed: {exc}") from exc

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    content_type = resp.headers.get("content-type", "")
    body: str | dict
    max_bytes = 1_000_000
    raw_bytes = resp.content
    truncated = False
    if len(raw_bytes) > max_bytes:
        raw_bytes = raw_bytes[:max_bytes]
        truncated = True

    if "application/json" in content_type:
        try:
            body = resp.json()
        except ValueError:
            body = raw_bytes.decode(errors="replace")
    else:
        body = raw_bytes.decode(errors="replace")
    if truncated and isinstance(body, str):
        body = body + "\n...[truncated]"

    return {
        "status": resp.status_code,
        "statusText": resp.reason_phrase,
        "headers": dict(resp.headers),
        "body": body,
        "time": elapsed_ms,
    }


@router.get("/test-json")
async def get_test_json():
    """
    Return all product comparison JSON files as an array.
    Use json_keys: ["comparisons", "summary"] to validate summary fields.
    """
    import glob as _glob
    comparisons_dir = Path(__file__).parent.parent.parent.parent / "common/agents/compliance_validator/projects/product_comparison_json/ai_product_comparison_sample_outputs"
    files = sorted(_glob.glob(str(comparisons_dir / "comparison_*.json")))
    comparisons = []
    for f in files:
        try:
            with open(f) as fh:
                comparisons.append(json.load(fh))
        except Exception:
            continue
    return {"comparisons": comparisons}


@router.get("/test-json/{filename}")
async def get_test_json_file(filename: str):
    """Serve a single product comparison JSON file by name."""
    comparisons_dir = Path(__file__).parent.parent.parent.parent / "common/agents/compliance_validator/projects/product_comparison_json/ai_product_comparison_sample_outputs"
    file_path = comparisons_dir / filename
    if not file_path.exists() or not filename.endswith(".json"):
        raise HTTPException(status_code=404, detail=f"File {filename} not found")
    with open(file_path) as fh:
        return json.load(fh)
