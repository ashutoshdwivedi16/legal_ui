import csv
import json
from pathlib import Path
from typing import List

from .record import Record


async def extract_records_for_file(
    project_id: int,
    file_path: Path,
    json_attrs: List[str],
    csv_cols: List[str],
) -> List[Record]:
    """
    Dispatch record extraction based on file type.
    """
    suffix = file_path.suffix.lower()

    if suffix == ".json" and json_attrs:
        return extract_json_records(
            project_id=project_id,
            file_path=file_path,
            json_attrs=json_attrs,
        )

    if suffix == ".csv" and csv_cols:
        return extract_csv_records(
            project_id=project_id,
            file_path=file_path,
            csv_cols=csv_cols,
        )

    return []


def extract_json_records(
    project_id: int,
    file_path: Path,
    json_attrs: List[str],
) -> List[Record]:
    """
    Extract configured JSON attributes as individual records.
    Supports both string values and nested objects (converted to JSON string).
    """
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    items = data if isinstance(data, list) else [data]
    records: List[Record] = []

    for idx, item in enumerate(items):
        record_key = item.get("id") or f"row_{idx}"

        for attr in json_attrs:
            value = item.get(attr)

            # Convert value to string for validation
            text_value = None
            if isinstance(value, str) and value.strip():
                text_value = value
            elif isinstance(value, (dict, list)):
                # Convert nested objects to JSON string for validation
                text_value = json.dumps(value, indent=2)

            if text_value:
                records.append(
                    Record(
                        file_path=str(file_path),
                        record_id=f"{file_path.name}#{record_key}#{attr}",
                        field_name=attr,
                        text_to_validate=text_value,
                        metadata={
                            "source_type": "json",
                            "json_key": attr,
                            "row_id": record_key,
                        },
                    )
                )

    return records


def extract_csv_records(
    project_id: int,
    file_path: Path,
    csv_cols: List[str],
) -> List[Record]:
    """
    Extract configured CSV columns as individual records.
    """
    records: List[Record] = []

    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row_idx, row in enumerate(reader):
            record_key = row.get("id") or f"row_{row_idx}"

            for col in csv_cols:
                value = row.get(col)
                if isinstance(value, str) and value.strip():
                    records.append(
                        Record(
                            file_path=str(file_path),
                            record_id=f"{file_path.name}#{record_key}#{col}",
                            field_name=col,
                            text_to_validate=value,
                            metadata={
                                "source_type": "csv",
                                "column": col,
                                "row_id": record_key,
                            },
                        )
                    )

    return records