"""Compliance job/audit repository helpers."""
from __future__ import annotations

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from common.lib.db.models import ComplianceJob, AuditResult


async def list_job_ids_for_project(session: AsyncSession, project_id: int) -> list[int]:
    result = await session.execute(select(ComplianceJob.id).where(ComplianceJob.project_id == project_id))
    return list(result.scalars().all())


async def delete_audits_for_jobs(session: AsyncSession, job_ids: list[int]) -> None:
    if not job_ids:
        return
    await session.execute(delete(AuditResult).where(AuditResult.job_id.in_(job_ids)))


async def delete_jobs_for_project(session: AsyncSession, project_id: int) -> None:
    await session.execute(delete(ComplianceJob).where(ComplianceJob.project_id == project_id))
