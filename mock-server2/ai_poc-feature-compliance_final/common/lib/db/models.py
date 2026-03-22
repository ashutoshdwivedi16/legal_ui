"""Database models for KPI monitoring."""
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from common.lib.db.base import Base, BaseModel


class AnomalyAudit(BaseModel):
    """Audit record for anomaly investigations."""
    
    __tablename__ = "anomaly_audits"
    
    # Anomaly details
    anomaly_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(128), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(255), nullable=False)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    change_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # Investigation results
    assigned_agent: Mapped[str] = mapped_column(String(128), nullable=False)
    investigation_status: Mapped[str] = mapped_column(String(64), nullable=False, default="pending")
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Additional metadata
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    tool_results: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class ComplianceRule(BaseModel):
    """Legal compliance rules for AI-generated content validation."""

    __tablename__ = "compliance_rules"

    # Override id to use string with legal_ prefix
    id: Mapped[str] = mapped_column(String(128), primary_key=True, index=True)
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt_instruction: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(64), nullable=False, default="MEDIUM")  # CRITICAL, HIGH, MEDIUM
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Project(BaseModel):
    """Projects for compliance validation tracking."""

    __tablename__ = "projects"
    # Use integer id as primary key (serial)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    rules_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="global")
    rules_uri: Mapped[str | None] = mapped_column(String(2048), nullable=True)


class ProjectUrl(BaseModel):
    """Project-specific URLs."""

    __tablename__ = "project_urls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    json_keys: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)


class ComplianceJob(BaseModel):
    """Compliance validation job execution records."""

    __tablename__ = "compliance_jobs"

    # Use integer id for job, integer project_id as FK
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="RUNNING")  # RUNNING, COMPLETED, FAILED
    run_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    total_scanned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pass_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fail_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ignored_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    applied_rule_ids: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)  # Snapshot of rules used


class AuditResult(BaseModel):
    """Individual audit results for content validation."""

    __tablename__ = "audit_results"

    # Use integer id for audit result, integer job_id as FK
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("compliance_jobs.id"), nullable=False, index=True)
    content_id: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    compliance_score: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False)  # PASS, FAIL, ERROR
    violation_type: Mapped[str | None] = mapped_column(String(64), nullable=True)  # CRITICAL, HIGH, MEDIUM
    failed_rules: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)  # Array of rule IDs
    llm_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    correction_hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    ignore_reasoning: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ignored_fields: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)


class PromptInjectionCase(BaseModel):
    """Cases for testing prompt injection vulnerabilities."""

    __tablename__ = "prompt_injection_cases"

    id: Mapped[str] = mapped_column(String(128), primary_key=True, index=True)
    project_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    target: Mapped[str | None] = mapped_column(String(128), nullable=True)
    type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    severity: Mapped[str] = mapped_column(String(64), nullable=False, default="MEDIUM")
    attack_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    messages: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    expected: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    application_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class PromptInjectionRun(Base):
    """Execution records for prompt injection tests."""

    __tablename__ = "prompt_injection_runs"

    run_id: Mapped[str] = mapped_column(String(128), primary_key=True, index=True)
    project_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="RUNNING")
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_api_base: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rules_version: Mapped[str | None] = mapped_column(String(128), nullable=True)
    config: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class PromptInjectionResult(Base):
    """Individual results for prompt injection test cases within a run."""

    __tablename__ = "prompt_injection_results"

    result_id: Mapped[str] = mapped_column(String(128), primary_key=True, index=True)
    run_id: Mapped[str] = mapped_column(String(128), ForeignKey("prompt_injection_runs.run_id"), nullable=False, index=True)
    case_id: Mapped[str] = mapped_column(String(128), ForeignKey("prompt_injection_cases.id"), nullable=False, index=True)
    expected: Mapped[str | None] = mapped_column(Text, nullable=True)
    actual: Mapped[str | None] = mapped_column(Text, nullable=True)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    severity: Mapped[str | None] = mapped_column(String(64), nullable=True)
    type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    target: Mapped[str | None] = mapped_column(String(128), nullable=True)
    result_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
