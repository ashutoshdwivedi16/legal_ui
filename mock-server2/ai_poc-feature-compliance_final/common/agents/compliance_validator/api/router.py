from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Any, Union, List
import json
from sqlalchemy.ext.asyncio import AsyncSession

from common.lib.db.session import get_session
from ..models.schemas import (
    ContentItem,
    ValidatePromptRequest,
    ValidatePromptResponse,
    RuleViolation,
    ValidationResult
)
from ..agent import ComplianceValidatorAgent

router = APIRouter(prefix="/compliance", tags=["compliance"])

@router.post(
    "/validate-prompt",
    response_model=ValidatePromptResponse,
    summary="Validate system prompt or JSON response",
    description="Validates a system prompt or AI-generated JSON content against compliance rules."
)
async def validate_system_prompt(
    request: ValidatePromptRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Validate a system prompt or JSON content against compliance rules.
    """
    agent = ComplianceValidatorAgent(session)
    return await agent.validate_system_prompt(request)