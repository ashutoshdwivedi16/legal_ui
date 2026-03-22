import pytest
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.exc import OperationalError

from services.product_comparison.repositories.product import fetch_products_by_md_ids
from common.models.exceptions import ServiceError


def _make_engine_mock(mock_conn):
    """Create a mock async engine whose connect() yields mock_conn."""
    mock_engine_obj = MagicMock()

    @asynccontextmanager
    async def fake_connect():
        yield mock_conn

    mock_engine_obj.connect = fake_connect
    return mock_engine_obj


@pytest.mark.asyncio
@patch("services.product_comparison.repositories.product.get_engine")
async def test_fetch_retries_on_transient_error_then_succeeds(mock_get_engine):
    """PDS connection fails once, then succeeds on retry — should return products."""
    mock_conn = AsyncMock()
    engine_obj = _make_engine_mock(mock_conn)
    mock_get_engine.return_value = engine_obj

    # Build a fake result set
    fake_row = {"modelSku": "SKU1", "name": "Product A", "category": "TV", "specs": "{}"}
    mock_result = MagicMock()
    mock_result.mappings.return_value.all.return_value = [fake_row]

    # First call raises OperationalError (retryable), second call succeeds
    mock_conn.execute = AsyncMock(
        side_effect=[OperationalError("connection reset", None, None), mock_result]
    )

    products = await fetch_products_by_md_ids(["MD001"])

    assert len(products) == 1
    assert products[0]["modelSku"] == "SKU1"
    assert mock_conn.execute.call_count == 2


@pytest.mark.asyncio
@patch("services.product_comparison.repositories.product.get_engine")
async def test_fetch_raises_after_all_retries_exhausted(mock_get_engine):
    """PDS connection fails on all 3 attempts — should raise ServiceError."""
    mock_conn = AsyncMock()
    engine_obj = _make_engine_mock(mock_conn)
    mock_get_engine.return_value = engine_obj

    # All calls raise OperationalError
    mock_conn.execute = AsyncMock(
        side_effect=OperationalError("connection reset", None, None)
    )

    with pytest.raises(ServiceError) as exc_info:
        await fetch_products_by_md_ids(["MD001"])

    assert exc_info.value.code.value == "SERVICE_PDS_UNAVAILABLE"
    assert mock_conn.execute.call_count == 3


@pytest.mark.asyncio
@patch("services.product_comparison.repositories.product.get_engine")
async def test_fetch_no_retry_on_non_retryable_error(mock_get_engine):
    """Non-retryable errors (e.g. ValueError) should fail immediately without retry."""
    mock_conn = AsyncMock()
    engine_obj = _make_engine_mock(mock_conn)
    mock_get_engine.return_value = engine_obj

    mock_conn.execute = AsyncMock(side_effect=ValueError("bad input"))

    with pytest.raises(ServiceError):
        await fetch_products_by_md_ids(["MD001"])

    # Should only be called once — no retries for non-retryable errors
    assert mock_conn.execute.call_count == 1
