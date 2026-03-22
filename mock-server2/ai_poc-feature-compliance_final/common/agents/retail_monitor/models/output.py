"""Retail Monitor agent output models."""
from typing import Any
from pydantic import BaseModel, Field


class CompetitorPricing(BaseModel):
    """Competitor pricing information."""
    competitor_name: str
    price: float
    discount: float
    promotion: str | None = None
    stock_status: str


class RetailInvestigationOutput(BaseModel):
    """Output model for retail monitor investigation."""
    root_cause: str = Field(..., description="Analysis of what caused the anomaly")
    recommendations: str = Field(..., description="Actionable recommendations")
    competitor_data: dict[str, Any] | None = Field(None, description="Competitor pricing data")
    pricing_analysis: dict[str, Any] | None = Field(None, description="Internal pricing analysis")
    confidence_score: float | None = Field(None, ge=0.0, le=1.0, description="Confidence in analysis")
