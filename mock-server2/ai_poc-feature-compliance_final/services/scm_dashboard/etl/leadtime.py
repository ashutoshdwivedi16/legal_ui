"""Lead time calculations (days between two dates)."""

from datetime import date
from typing import Optional


def calc_lt(end_date: Optional[date], start_date: Optional[date]) -> Optional[int]:
    if end_date and start_date:
        return (end_date - start_date).days
    return None
