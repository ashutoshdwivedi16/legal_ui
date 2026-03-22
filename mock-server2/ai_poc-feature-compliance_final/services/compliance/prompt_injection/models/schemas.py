from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any
from datetime import datetime


class PromptInjectionCaseBase(BaseModel):
    id: str | None = None
    project_id: int | None = None
    title: str
    target: Optional[str] = None
    type: Optional[str] = None
    severity: str = "MEDIUM"
    attack_text: Optional[str] = None
    messages: Optional[List[dict[str, Any]]] = None
    expected: Optional[str] = None
    tags: Optional[Any] = None
    application_name: Optional[str] = None
    is_active: bool = True
    source: Optional[str] = None


class PromptInjectionCaseCreate(PromptInjectionCaseBase):
    pass


class PromptInjectionCaseUpdate(BaseModel):
    title: Optional[str] = None
    target: Optional[str] = None
    type: Optional[str] = None
    severity: Optional[str] = None
    attack_text: Optional[str] = None
    messages: Optional[List[dict[str, Any]]] = None
    expected: Optional[str] = None
    tags: Optional[Any] = None
    application_name: Optional[str] = None
    is_active: Optional[bool] = None
    source: Optional[str] = None


class PromptInjectionCase(PromptInjectionCaseBase):
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromptInjectionRunBase(BaseModel):
    run_id: str
    project_id: int | None = None
    status: str = "RUNNING"
    model_name: Optional[str] = None
    model_api_base: Optional[str] = None
    rules_version: Optional[str] = None
    config: Optional[dict[str, Any]] = None


class PromptInjectionRunCreate(PromptInjectionRunBase):
    started_at: Optional[datetime] = None


class PromptInjectionRunRequest(BaseModel):
    project_id: int


class PromptInjectionRun(PromptInjectionRunBase):
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PromptInjectionResultBase(BaseModel):
    result_id: str
    run_id: str
    case_id: str
    expected: Optional[str] = None
    actual: Optional[str] = None
    passed: bool
    severity: Optional[str] = None
    type: Optional[str] = None
    target: Optional[str] = None
    result_json: Optional[dict[str, Any]] = None


class PromptInjectionResultCreate(PromptInjectionResultBase):
    pass


class PromptInjectionResult(PromptInjectionResultBase):
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RunSummary(BaseModel):
    total_cases: int
    passed: int
    failed: int


class PromptInjectionRunDetail(PromptInjectionRun):
    summary: RunSummary
    results: List[PromptInjectionResult]
