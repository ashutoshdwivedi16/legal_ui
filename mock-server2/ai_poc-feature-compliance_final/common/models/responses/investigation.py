"""Investigation response schemas."""
from datetime import datetime

from pydantic import BaseModel


class InvestigationResponse(BaseModel):
    """Response schema for investigation results."""
    
    audit_id: int
    anomaly_type: str
    category: str
    assigned_agent: str
    investigation_status: str
    root_cause: str | None = None
    recommendations: str | None = None
    created_at: datetime
    
    class Config:
        from_attributes = True
