"""Inventory agent output models."""
from typing import Any
from pydantic import BaseModel, Field


class StockLevelInfo(BaseModel):
    """Stock level information."""
    category: str
    stock_level: str
    out_of_stock_items: int
    low_stock_items: int
    total_items: int


class InventoryInvestigationOutput(BaseModel):
    """Output model for inventory agent investigation."""
    root_cause: str = Field(..., description="Analysis of inventory-related root cause")
    recommendations: str = Field(..., description="Actionable inventory recommendations")
    stock_data: dict[str, Any] | None = Field(None, description="Current stock level data")
    stockout_history: dict[str, Any] | None = Field(None, description="Historical stockout data")
    warehouse_status: dict[str, Any] | None = Field(None, description="Warehouse capacity status")
    urgency_level: str | None = Field(None, description="Urgency level: low, medium, high, critical")
