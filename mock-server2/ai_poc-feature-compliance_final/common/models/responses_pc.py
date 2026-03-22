from __future__ import annotations

from pydantic import BaseModel, Field


class DifferentiatorProduct(BaseModel):
    productId: str
    summary: str


class Differentiator(BaseModel):
    key: str = Field(..., description="Lowercase snake_case identifier for the differentiator")
    label: str = Field(..., description="Human-readable title, 2-3 words max")
    products: list[DifferentiatorProduct] = Field(..., min_length=1)


class ComparisonSummary(BaseModel):
    quickPick: list[str]
    differentiators: list[Differentiator]
    similarities: list[str]


class ComparisonResponse(BaseModel):
    summary: ComparisonSummary | None
    status: str | None = None
