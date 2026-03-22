"""Mock tools for inventory agent."""
from typing import Any
from common.lib.utils.logging import get_logger

logger = get_logger(__name__)


async def check_inventory_levels(category: str, timestamp: str) -> dict[str, Any]:
    """Mock tool to check inventory levels."""
    logger.info(f"Checking inventory levels for category: {category} at {timestamp}")

    # Mock response
    return {
        "category": category,
        "timestamp": timestamp,
        "stock_level": "normal",
        "out_of_stock_items": 0,
        "low_stock_items": 2,
        "total_items": 150,
        "stock_turnover_rate": 0.85,
        "details": f"Inventory levels for {category} appear normal. 2 items slightly low on stock out of 150 total items."
    }


async def check_stockout_history(category: str, days: int = 7) -> dict[str, Any]:
    """Mock tool to check stockout history."""
    logger.info(f"Checking stockout history for category: {category} for last {days} days")

    return {
        "category": category,
        "period_days": days,
        "stockout_events": 3,
        "affected_products": ["Product A", "Product B", "Product C"],
        "average_stockout_duration_hours": 12,
        "details": f"Found 3 stockout events in the last {days} days, average duration 12 hours."
    }


async def check_warehouse_capacity(category: str) -> dict[str, Any]:
    """Mock tool to check warehouse capacity."""
    logger.info(f"Checking warehouse capacity for category: {category}")

    return {
        "category": category,
        "current_utilization": 0.72,
        "available_capacity": 0.28,
        "reserved_space": 0.15,
        "status": "normal",
        "details": f"Warehouse capacity at 72% utilization for {category}. Space available for restocking."
    }
