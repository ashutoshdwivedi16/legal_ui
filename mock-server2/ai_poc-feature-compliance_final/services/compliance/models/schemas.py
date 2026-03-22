"""Pydantic models for compliance API."""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator


class CreateProjectRequest(BaseModel):
    """Request to create a new project."""
    project_name: str = Field(..., description="Project name")
    project_description: str | None = Field(None, description="Project description")
    project_prompt: str | None = Field(None, description="Project-specific prompt")
    data_sources: list[dict[str, Any]] = Field(..., description="Per-URL data sources")
    rules_mode: Literal["global", "project", "global+project"] = Field(
        "global",
        description="Rules mode: global, project, or global+project",
    )
    rules_uri: str | None = Field(
        None,
        description="Rules file URI/path (file://... or path). Required for project/global+project.",
    )

    @model_validator(mode="after")
    def _validate_rules_uri(self):
        if self.rules_mode in {"project", "global+project"} and not self.rules_uri:
            raise ValueError("rules_uri is required when rules_mode is project or global+project")
        return self


class UpdateProjectRequest(BaseModel):
    """Request to update an existing project."""
    project_name: str | None = Field(None, description="Project name")
    project_description: str | None = Field(None, description="Project description")
    project_prompt: str | None = Field(None, description="Project-specific prompt")
    data_sources: list[dict[str, Any]] | None = Field(None, description="Per-URL data sources")
    rules_mode: Literal["global", "project", "global+project"] | None = Field(
        None,
        description="Rules mode: global, project, or global+project",
    )
    rules_uri: str | None = Field(
        None,
        description="Rules file URI/path (file://... or path). Required for project/global+project.",
    )


class ContentSourceConfig(BaseModel):
    """Configuration for a content source."""
    type: str = Field(..., description="Source type: 'database' or 'api'")
    # Database source fields
    table: str | None = Field(None, description="Database table name (for database type)")
    column: str | None = Field(None, description="Column containing AI content (for database type)")
    id_column: str = Field("id", description="ID column name (for database type)")
    where: str | None = Field(None, description="Optional WHERE clause filter (for database type)")
    # API source fields
    url: str | None = Field(None, description="API URL (for api type)")
    api_key: str | None = Field(None, description="API key (for api type)")
    headers: dict | None = Field(None, description="Additional headers (for api type)")
    # Common
    content_type: str = Field("summary", description="Type of content being validated")


class ProjectSourceConfig(BaseModel):
    """Project with its content sources."""
    project_id: int = Field(..., description="Project ID")
    sources: list[ContentSourceConfig] = Field(..., description="List of content sources")


class BatchComplianceRequest(BaseModel):
    """Request to run batch compliance validation."""
    projects: list[ProjectSourceConfig] = Field(..., description="Projects with their content sources")


class BatchComplianceResult(BaseModel):
    """Result for a single project in batch run."""
    project_id: int
    job_id: int
    status: str
    message: str


class BatchComplianceResponse(BaseModel):
    """Response from batch compliance validation."""
    total_projects: int
    completed: int
    failed: int
    results: list[BatchComplianceResult]


class ValidatePromptRequest(BaseModel):
    """Request model for validating a system prompt or AI-generated JSON response."""
    system_prompt: str | None = Field(default=None, description="The system prompt to validate (string)")
    json_content: dict[str, Any] | None = Field(default=None, description="AI-generated JSON response to validate")
    application_name: str | None = Field(default="Unknown Application", description="Name of the application")
    content_type: str | None = Field(default=None, description="Type of content: 'prompt' or 'json_response'")


class RuleViolation(BaseModel):
    """Represents a single rule violation detected during validation."""
    rule_id: str
    rule_name: str
    severity: str
    message: str
    field: str | None = None
    expected_value: str | None = None
    actual_value: str | None = None


class ValidatePromptResponse(BaseModel):
    """Response model for system prompt validation."""
    is_compliant: bool
    compliance_score: float
    total_rules_checked: int
    violations_count: int
    violations: list[RuleViolation] = Field(default_factory=list)
    summary: str
    content_type: str = "prompt"


class IgnoreReasoningRequest(BaseModel):
    """Request to ignore reasoning for an audit result."""
    ignore_reasoning: bool = Field(..., description="Whether to ignore reasoning")
    ignored_fields: list[str] | None = Field(default=None, description="Fields to ignore")


class ComplianceRuleResponse(BaseModel):
    id: str
    rule_name: str
    prompt_instruction: str
    severity: str
    is_active: bool


class ProxyAuthConfig(BaseModel):
    type: str = Field("none", description="Auth type: none, bearer, basic, api-key")
    token: str | None = None
    username: str | None = None
    password: str | None = None
    apiKeyName: str | None = None
    apiKeyValue: str | None = None
    apiKeyLocation: str | None = Field("header", description="header or query")


class ProxyRequest(BaseModel):
    method: str = Field(..., description="HTTP method")
    url: str = Field(..., description="Target URL")
    headers: dict[str, str] | None = None
    params: dict[str, str] | None = None
    auth: ProxyAuthConfig | None = None
    body: str | None = None
