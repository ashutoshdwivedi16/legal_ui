from __future__ import annotations

from pydantic import BaseModel, Field


class ComparisonRequest(BaseModel):
    products: list[str] = Field(..., min_length=2, max_length=4)
