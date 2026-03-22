"""Pydantic models for the Compliance Validator Agent."""

from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any
import json


class ContentItem(BaseModel):
    """A content item to be validated."""
    content_id: str = Field(..., description="Unique identifier for the content")
    text: str = Field(..., description="The text content to validate")
    content_type: str = Field(default="text", description="Type of content")
    source: Optional[str] = Field(default=None, description="Source of the content")
    metadata: Optional[dict] = Field(default=None, description="Additional metadata")


class ValidationRequest(BaseModel):
    """Request model for batch validation."""
    project_id: int = Field(..., description="Project ID for the validation job")
    content_items: List[ContentItem] = Field(..., description="List of content items to validate")


class Violation(BaseModel):
    """A single rule violation."""
    rule_id: str = Field(..., description="ID of the violated rule")
    severity: str = Field(..., description="Severity level: CRITICAL, HIGH, MEDIUM, LOW")
    reasoning: str = Field(..., description="Explanation of why this is a violation")
    action_required: str = Field(..., description="Suggested action to fix the violation")


class ValidationResult(BaseModel):
    """Result of validating a single content item."""
    score: float = Field(..., description="Compliance score from 0.0 to 1.0")
    status: str = Field(..., description="PASS, FAIL, or ERROR")
    violations: List[Violation] = Field(default_factory=list, description="List of violations found")


class ComplianceJobResponse(BaseModel):
    """Response for a compliance job."""
    job_id: int = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Job status: RUNNING, COMPLETED, FAILED")
    message: str = Field(..., description="Status message")


class ValidatePromptRequest(BaseModel):
    """Request model for validating a system prompt or AI-generated JSON response."""
    system_prompt: Optional[str] = Field(default=None, description="The system prompt to validate (string)")
    json_content: Optional[dict[str, Any]] = Field(default=None, description="AI-generated JSON response to validate")
    application_name: Optional[str] = Field(default="Unknown Application", description="Name of the application")
    content_type: Optional[str] = Field(default=None, description="Type of content: 'prompt' or 'json_response' (auto-detected if not provided)")

    @model_validator(mode='after')
    def validate_content_provided(self):
        """Ensure at least one content type is provided."""
        if self.system_prompt is None and self.json_content is None:
            raise ValueError("Either 'system_prompt' or 'json_content' must be provided")
        
        # Auto-detect content type if not provided
        if self.content_type is None:
            if self.json_content is not None:
                object.__setattr__(self, 'content_type', 'json_response')
            else:
                object.__setattr__(self, 'content_type', 'prompt')
        
        return self

    def get_content_for_validation(self) -> str:
        """Returns the content to validate as a string."""
        if self.json_content is not None:
            return json.dumps(self.json_content, indent=2)
        return self.system_prompt or ""
    
    def is_json_content(self) -> bool:
        """Check if the content being validated is JSON."""
        return self.json_content is not None


class PromptViolation(BaseModel):
    """A violation found in a system prompt."""
    rule_id: str = Field(..., description="ID of the violated rule")
    rule_name: str = Field(..., description="Name of the rule")
    severity: str = Field(..., description="Severity level: CRITICAL, HIGH, MEDIUM, LOW")
    issue: str = Field(..., description="Description of the issue")
    explanation: str = Field(..., description="Detailed explanation")
    suggestion: str = Field(..., description="How to fix the issue")


class RuleViolation(BaseModel):
    """Represents a single rule violation detected during validation."""
    rule_id: str
    rule_name: str
    severity: str  # e.g., "error", "warning", "info"
    message: str
    field: str | None = None
    expected_value: str | None = None
    actual_value: str | None = None


class ValidatePromptResponse(BaseModel):
    """Response model for system prompt validation."""
    is_compliant: bool = Field(..., description="Whether the content is compliant")
    compliance_score: float = Field(..., description="Compliance score from 0.0 to 1.0")
    total_rules_checked: int = Field(..., description="Number of rules checked")
    violations_count: int = Field(..., description="Number of violations found")
    violations: List[RuleViolation] = Field(default_factory=list, description="List of violations")
    summary: str = Field(..., description="Human-readable summary")
    content_type: str = Field(default="prompt", description="Type of content validated: 'prompt' or 'json_response'")
