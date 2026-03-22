"""Prompt injection run orchestration service."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.agents.compliance_validator.prompts import templates
from common.agents.compliance_validator.rules.rules_loader import load_rules
from common.agents.compliance_validator.tools.llm_validator import LLMValidator
from common.constants.logging import (
    API_REQUEST_COMPLETED,
    API_REQUEST_FAILED,
    API_REQUEST_RECEIVED,
    ERROR,
    INFO,
    SERVICE_API,
)
from common.lib.db.models import PromptInjectionCase, PromptInjectionResult, PromptInjectionRun
from common.llm.client import get_adk_litellm_model
from common.lib.utils.logging import log_event

COMMIT_EVERY = 10


async def run_prompt_injection(session: AsyncSession, project_id: int) -> PromptInjectionRun:
    log_event(
        level=INFO,
        message="Starting prompt injection test run",
        event=API_REQUEST_RECEIVED,
        service=SERVICE_API,
    )

    try:
        running_result = await session.execute(
            select(PromptInjectionRun).where(PromptInjectionRun.status == "RUNNING")
        )
        running_run = running_result.scalar_one_or_none()
        if running_run:
            raise HTTPException(
                status_code=409,
                detail=f"Prompt injection run {running_run.run_id} is already in progress",
            )

        cases_result = await session.execute(
            select(PromptInjectionCase)
            .where(PromptInjectionCase.is_active == True)
            .where(PromptInjectionCase.project_id == project_id)
        )
        cases = cases_result.scalars().all()

        if not cases:
            raise HTTPException(status_code=400, detail="No active test cases found")

        run_id = f"pi-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        db_run = PromptInjectionRun(
            run_id=run_id,
            project_id=project_id,
            started_at=datetime.now(timezone.utc),
            status="RUNNING",
            config={
                "total_cases": len(cases),
                "environment": "api",
            },
        )
        session.add(db_run)
        await session.commit()

        rules = load_rules()
        system_prompt = templates.get_system_prompt(rules)

        llm = get_adk_litellm_model()
        validator = LLMValidator(llm)
        db_run.model_name = getattr(llm, "model", None)
        db_run.model_api_base = getattr(llm, "api_base", None)
        await session.commit()

        pending = 0
        for case in cases:
            try:
                if case.messages:
                    lines = []
                    for msg in case.messages:
                        role = msg.get("role", "user").upper()
                        content = msg.get("content", "").strip()
                        lines.append(f"{role}: {content}")
                    attack_text = "\n".join(lines)
                else:
                    attack_text = case.attack_text or ""

                if case.target == "system_prompt":
                    prompt_system = templates.get_prompt_validation_system_prompt(rules)
                    prompt_user = templates.get_prompt_validation_user_prompt(
                        attack_text, case.application_name
                    )

                    response_text = await validator._call_model_obj(
                        prompt_system, prompt_user
                    )
                    raw = validator._parse_json_response(response_text)
                    is_compliant = bool(raw.get("is_compliant", False))
                    actual = "ALLOW" if is_compliant else "BLOCK"
                    result_json = raw
                else:
                    user_prompt = templates.get_validation_prompt(attack_text)
                    val_result = await validator.validate(
                        system_prompt=system_prompt, user_prompt=user_prompt
                    )

                    status = val_result.get("status", "ERROR")
                    if status == "PASS":
                        actual = "ALLOW"
                    elif status == "FAIL":
                        actual = "BLOCK"
                    else:
                        actual = "ERROR"
                    result_json = val_result

                expected = (case.expected or "BLOCK").strip().upper()
                passed = expected == actual

                db_result = PromptInjectionResult(
                    result_id=str(uuid4()),
                    run_id=run_id,
                    case_id=case.id,
                    expected=expected,
                    actual=actual,
                    passed=passed,
                    severity=case.severity,
                    type=case.type,
                    target=case.target,
                    result_json=result_json,
                )
                session.add(db_result)
                pending += 1

            except Exception as e:
                log_event(
                    level=ERROR,
                    message=f"Error executing case {case.id}: {str(e)}",
                    event=API_REQUEST_FAILED,
                    service=SERVICE_API,
                )
                db_result = PromptInjectionResult(
                    result_id=str(uuid4()),
                    run_id=run_id,
                    case_id=case.id,
                    expected=case.expected,
                    actual="ERROR",
                    passed=False,
                    severity=case.severity,
                    type=case.type,
                    target=case.target,
                    result_json={"error": str(e)},
                )
                session.add(db_result)
                pending += 1

            if pending >= COMMIT_EVERY:
                await session.commit()
                pending = 0

        if pending > 0:
            await session.commit()

        db_run.status = "COMPLETED"
        db_run.completed_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(db_run)

        log_event(
            level=INFO,
            message=f"Prompt injection test run complete: {run_id}",
            event=API_REQUEST_COMPLETED,
            service=SERVICE_API,
        )

        return db_run

    except HTTPException:
        raise
    except Exception as e:
        log_event(
            level=ERROR,
            message=f"Prompt injection test run failed: {str(e)}",
            event=API_REQUEST_FAILED,
            service=SERVICE_API,
        )
        if "db_run" in locals():
            db_run.status = "FAILED"
            db_run.completed_at = datetime.now(timezone.utc)
            await session.commit()
        raise HTTPException(status_code=500, detail=str(e))


async def get_latest_prompt_injection_run_detail(session: AsyncSession, project_id: int) -> dict:
    run_result = await session.execute(
        select(PromptInjectionRun)
        .where(PromptInjectionRun.project_id == project_id)
        .order_by(PromptInjectionRun.started_at.desc())
        .limit(1)
    )
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="No prompt injection runs found")

    results_query = await session.execute(
        select(PromptInjectionResult).where(PromptInjectionResult.run_id == run.run_id)
    )
    results = results_query.scalars().all()

    config_total = 0
    if run.config and isinstance(run.config, dict):
        config_total = int(run.config.get("total_cases") or 0)
    total_cases = max(len(results), config_total)
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed

    return {
        "run": run,
        "results": results,
        "summary": {
            "total_cases": total_cases,
            "passed": passed,
            "failed": failed,
        },
    }
