import os
import json
from pathlib import Path
from typing import AsyncGenerator

# Fix: Use relative imports
from .record import Record
from .record_extractor import extract_records_for_file

from .utils import get_project_by_id, resolve_project_path

async def file_loader_for_project(
    project_id: int,
) -> AsyncGenerator[Record, None]:
    """
    Load files for a project and yield extracted records.
    """
    print("file_loader_for_project called with project_id:", project_id)
    project_cfg = get_project_by_id(project_id)
    print("project_cfg for", project_id, ":", project_cfg)
    if not project_cfg:
        return

    folder_path = project_cfg.get("folder_path", "")
    if "${COMPLIANCE_PROJECTS_DIR}" in folder_path:
        from .utils import _default_projects_dir
        folder_path = folder_path.replace("${COMPLIANCE_PROJECTS_DIR}", str(_default_projects_dir()))
    base_path = resolve_project_path(folder_path)
    print("base_path:", base_path)

    if not base_path.exists() or not base_path.is_dir():
        return

    json_attrs = project_cfg.get("validate_json_attributes", [])
    csv_cols = project_cfg.get("validate_csv_columns", [])

    json_enabled = bool(json_attrs)
    csv_enabled = bool(csv_cols)

    for file_path in base_path.iterdir():
        if not file_path.is_file():
            continue

        suffix = file_path.suffix.lower()

        if suffix == ".json" and json_enabled:
            records = await extract_records_for_file(
                project_id=project_id,
                file_path=file_path,
                json_attrs=json_attrs,
                csv_cols=[]
            )
            for record in records:
                yield record

        elif suffix == ".csv" and csv_enabled:
            records = await extract_records_for_file(
                project_id=project_id,
                file_path=file_path,
                json_attrs=[],
                csv_cols=csv_cols
            )
            for record in records:
                yield record
