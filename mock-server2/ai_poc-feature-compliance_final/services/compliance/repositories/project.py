"""Compliance project repository helpers."""
from __future__ import annotations

from typing import Any
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from common.lib.db.models import Project, ProjectUrl


async def get_project(session: AsyncSession, project_id: int) -> Project | None:
    result = await session.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def list_project_urls(session: AsyncSession, project_id: int) -> list[ProjectUrl]:
    result = await session.execute(select(ProjectUrl).where(ProjectUrl.project_id == project_id))
    return list(result.scalars().all())


async def replace_project_urls(
    session: AsyncSession,
    project_id: int,
    urls: list[dict[str, Any]],
) -> None:
    await session.execute(delete(ProjectUrl).where(ProjectUrl.project_id == project_id))
    for source in urls:
        session.add(
            ProjectUrl(
                project_id=project_id,
                url=source["url"],
                json_keys=source.get("json_keys") or [],
            )
        )
