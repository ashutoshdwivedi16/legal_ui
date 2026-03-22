from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class Record:
    """A record extracted from a file for compliance validation."""
    record_id: str
    file_path: str
    field_name: str
    text_to_validate: str
    metadata: Dict[str, Any]