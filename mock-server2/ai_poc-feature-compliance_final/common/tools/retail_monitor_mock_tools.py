"""Mock tools for retail monitor agent."""
from typing import Any
from common.lib.utils.logging import get_logger

logger = get_logger(__name__)


async def check_competitor_pricing(category: str, product_name: str) -> dict[str, Any]:
    """Mock tool to check competitor pricing for similar products."""
    logger.info(f"Checking competitor pricing for {product_name} in {category}")

    # Mock competitor data
    competitors = {
        "homedepot": {
            "price": 899.99,
            "discount": 15.0,
            "promotion": "15% off TVs this week",
            "stock_status": "in_stock"
        },
        "bestbuy": {
            "price": 849.99,
            "discount": 20.0,
            "promotion": "Holiday sale - 20% off electronics",
            "stock_status": "in_stock"
        },
        "walmart": {
            "price": 879.99,
            "discount": 12.0,
            "promotion": "Price match guarantee",
            "stock_status": "limited_stock"
        }
    }

    return {
        "category": category,
        "product": product_name,
        "our_price": 999.99,
        "competitors": competitors,
        "price_position": "highest",
        "average_competitor_discount": 15.7,
        "details": f"Our price is highest among competitors. Average competitor discount: 15.7%"
    }


async def check_pricing_changes(category: str, timestamp: str) -> dict[str, Any]:
    """Mock tool to check recent internal pricing changes."""
    logger.info(f"Checking our pricing changes for category: {category} at {timestamp}")

    # Mock response
    return {
        "category": category,
        "timestamp": timestamp,
        "recent_changes": True,
        "affected_products": 15,
        "average_price_change": -12.5,
        "details": f"Found 15 products in {category} with price reductions averaging -12.5% in the last 24 hours."
    }
