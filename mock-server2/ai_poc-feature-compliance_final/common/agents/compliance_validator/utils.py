import os
import json
from pathlib import Path
from typing import Dict, Any, List

def load_projects_config() -> Dict[str, Any]:
    """
    Load compliance validator project configuration from config.json.
    """
    config_path = Path(__file__).parent / "config.json"
    
    if not config_path.exists():
        return {"projects": []}

    with open(config_path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"projects": []}

def _repo_root() -> Path:
    # .../common/agents/compliance_validator/utils.py -> repo root
    return Path(__file__).resolve().parents[3]


def resolve_project_path(path_value: str) -> Path:
    """
    Resolve project path relative to repo root if not absolute.
    """
    expanded = os.path.expandvars(path_value)
    path = Path(expanded)
    if path.is_absolute():
        return path
    return _repo_root() / path


def _default_projects_dir() -> Path:
    env_value = os.getenv("COMPLIANCE_PROJECTS_DIR")
    if env_value:
        return resolve_project_path(env_value)
    return _repo_root() / "common" / "agents" / "compliance_validator" / "projects"

def get_project_by_id(project_id: Any) -> Dict[str, Any]:
    """
    Find a project configuration by its project_id.
    """
    config = load_projects_config()
    projects = config.get("projects", [])
    
    # Handle string or integer project_id
    search_id = str(project_id)
    
    for project in projects:
        if str(project.get("id")) == search_id:
            return project
            
    return {}
