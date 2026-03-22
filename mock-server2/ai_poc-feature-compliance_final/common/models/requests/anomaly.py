"""Anomaly detection request schemas."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AnomalyDetectionRequest(BaseModel):
    """Request schema for anomaly detection."""
    
    anomaly_type: str = Field(..., description="Type of anomaly detected")
    category: str = Field(..., description="Category of the KPI (e.g., 'tvs')")
    metric_name: str = Field(..., description="Name of the metric (e.g., 'conversion_rate')")
    metric_value: float = Field(..., description="Current value of the metric")
    change_percentage: float = Field(..., description="Percentage change (e.g., -30.0)")
    detected_at: datetime = Field(..., description="Timestamp of detection")
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")
