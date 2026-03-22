"""Prompt injection API routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import uuid4

from common.lib.db.session import get_session
from common.lib.db.models import PromptInjectionCase, PromptInjectionRun, PromptInjectionResult

from services.compliance.prompt_injection.models import (
    PromptInjectionCase as PromptInjectionCaseSchema,
    PromptInjectionCaseCreate,
    PromptInjectionCaseUpdate,
    PromptInjectionRun as PromptInjectionRunSchema,
    PromptInjectionRunDetail,
    PromptInjectionResult as PromptInjectionResultSchema,
    RunSummary,
    PromptInjectionRunRequest,
)
from services.compliance.prompt_injection.services.service import (
    run_prompt_injection,
    get_latest_prompt_injection_run_detail,
)

router = APIRouter(prefix="/prompt-injection", tags=["prompt-injection"])


@router.get("/cases", response_model=list[PromptInjectionCaseSchema])
async def get_prompt_injection_cases(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Retrieve all prompt injection test cases."""
    result = await session.execute(
        select(PromptInjectionCase).where(PromptInjectionCase.project_id == project_id)
    )
    return result.scalars().all()


@router.post("/cases", response_model=PromptInjectionCaseSchema)
async def create_prompt_injection_case(
    case_data: PromptInjectionCaseCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new prompt injection test case."""
    payload = case_data.model_dump()
    if payload.get("project_id") is None:
        raise HTTPException(status_code=400, detail="project_id is required")
    if not payload.get("id"):
        payload["id"] = str(uuid4())
    db_case = PromptInjectionCase(**payload)
    session.add(db_case)
    await session.commit()
    await session.refresh(db_case)
    return db_case


@router.put("/cases/{case_id}", response_model=PromptInjectionCaseSchema)
async def update_prompt_injection_case(
    case_id: str,
    case_data: PromptInjectionCaseUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update an existing prompt injection test case."""
    result = await session.execute(
        select(PromptInjectionCase).where(PromptInjectionCase.id == case_id)
    )
    db_case = result.scalar_one_or_none()
    if not db_case:
        raise HTTPException(status_code=404, detail="Case not found")

    updates = case_data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(db_case, key, value)
    await session.commit()
    await session.refresh(db_case)
    return db_case


@router.delete("/cases/{case_id}", response_model=PromptInjectionCaseSchema)
async def delete_prompt_injection_case(
    case_id: str,
    session: AsyncSession = Depends(get_session)
):
    """Soft delete a prompt injection test case (set is_active=false)."""
    result = await session.execute(
        select(PromptInjectionCase).where(PromptInjectionCase.id == case_id)
    )
    db_case = result.scalar_one_or_none()
    if not db_case:
        raise HTTPException(status_code=404, detail="Case not found")
    db_case.is_active = False
    await session.commit()
    await session.refresh(db_case)
    return db_case


@router.post("/run", response_model=PromptInjectionRunSchema)
async def run_prompt_injection_tests(
    payload: PromptInjectionRunRequest,
    session: AsyncSession = Depends(get_session)
):
    """Execute all active prompt injection test cases and save results to the database."""
    return await run_prompt_injection(session, payload.project_id)


@router.get("/runs", response_model=list[PromptInjectionRunSchema])
async def get_prompt_injection_runs(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Retrieve all prompt injection test runs."""
    result = await session.execute(
        select(PromptInjectionRun)
        .where(PromptInjectionRun.project_id == project_id)
        .order_by(PromptInjectionRun.started_at.desc())
    )
    return result.scalars().all()


@router.get("/runs/{run_id}", response_model=PromptInjectionRunDetail)
async def get_prompt_injection_run_details(
    run_id: str,
    project_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Retrieve details and results for a specific prompt injection run."""
    run_result = await session.execute(
        select(PromptInjectionRun).where(PromptInjectionRun.run_id == run_id)
    )
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.project_id != project_id:
        raise HTTPException(status_code=404, detail="Run not found")

    results_query = await session.execute(
        select(PromptInjectionResult).where(PromptInjectionResult.run_id == run_id)
    )
    results = results_query.scalars().all()

    config_total = 0
    if run.config and isinstance(run.config, dict):
        config_total = int(run.config.get("total_cases") or 0)
    total_cases = max(len(results), config_total)
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed

    summary = RunSummary(
        total_cases=total_cases,
        passed=passed,
        failed=failed,
    )

    result_schemas = [PromptInjectionResultSchema.model_validate(r) for r in results]

    return PromptInjectionRunDetail(
        run_id=run.run_id,
        started_at=run.started_at,
        completed_at=run.completed_at,
        status=run.status,
        model_name=run.model_name,
        model_api_base=run.model_api_base,
        rules_version=run.rules_version,
        config=run.config,
        summary=summary,
        results=result_schemas,
    )


@router.get("/runs/latest", response_model=PromptInjectionRunDetail)
async def get_latest_prompt_injection_run(
    project_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Retrieve details and results for the latest prompt injection run."""
    payload = await get_latest_prompt_injection_run_detail(session, project_id)
    run = payload["run"]
    results = payload["results"]
    summary = RunSummary(**payload["summary"])
    result_schemas = [PromptInjectionResultSchema.model_validate(r) for r in results]

    return PromptInjectionRunDetail(
        run_id=run.run_id,
        started_at=run.started_at,
        completed_at=run.completed_at,
        status=run.status,
        model_name=run.model_name,
        model_api_base=run.model_api_base,
        rules_version=run.rules_version,
        config=run.config,
        summary=summary,
        results=result_schemas,
    )
