import os

import httpx
import pytest

# Configuration
API_URL = os.getenv("API_URL", "http://localhost:8000/us/common/ai/v1")
MOCK_LLM_URL = os.getenv("MOCK_LLM_URL", "http://localhost:8001")


@pytest.mark.asyncio
async def test_health_check():
    """Verify API is healthy"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_URL}/compare/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["env"] == "testing"


@pytest.mark.asyncio
async def test_generate_comparison_end_to_end():
    """Full integration test hitting API -> DB -> Redis -> Mock LLM"""
    payload = {
        "products": [
            "MD09034027",
            "MD09033837",
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{API_URL}/compare/products/summary", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert "summary" in data
        assert "status" in data

        if data["summary"] is None:
            assert data["status"] in ("ERROR", "UNAVAILABLE")
        else:
            assert data["status"] == "SUCCESS"
            assert "overview" in data["summary"]
            assert "products" in data["summary"]
            assert len(data["summary"]["products"]) == 2

            cached_response = await client.post(f"{API_URL}/compare/products/summary", json=payload)
            assert cached_response.status_code == 200
            cached_data = cached_response.json()
            assert cached_data.get("status") == "SUCCESS"
            assert cached_data["summary"] == data["summary"]


@pytest.mark.asyncio
async def test_metrics_endpoint():
    """Verify Prometheus metrics are exposed"""
    async with httpx.AsyncClient() as client:
        response = await client.get("http://localhost:8000/metrics")
        assert response.status_code == 200
        assert "http_requests_total" in response.text
