"""Tests for health check endpoints including the deep /compare/health/ready probe."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from services.product_comparison.apis.routes import router
from common.config.settings import Settings


@pytest.fixture
def _mock_settings():
    """Provide a mock Settings object for route dependencies."""
    mock = MagicMock(spec=Settings)
    mock.app_name = "Product Comparison API"
    mock.app_version = "0.1.0"
    mock.app_env = "testing"
    return mock


@pytest.fixture
def app(_mock_settings):
    """Create a minimal FastAPI app wired to the routes under test."""
    _app = FastAPI()
    _app.include_router(router, prefix="/us/common/ai/v1/compare")
    _app.dependency_overrides[Settings] = lambda: _mock_settings
    return _app


@pytest.fixture
def client(app):
    return TestClient(app)


# -------------------------------------------------------------------------
# GET /compare/health (shallow liveness)
# -------------------------------------------------------------------------


class TestHealthLiveness:
    def test_returns_ok(self, client):
        resp = client.get("/us/common/ai/v1/compare/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "version" in body


# -------------------------------------------------------------------------
# GET /compare/health/ready (deep readiness)
# -------------------------------------------------------------------------


class TestHealthReady:
    @patch("services.product_comparison.apis.routes.ping_llm", new_callable=AsyncMock, return_value=True)
    @patch("services.product_comparison.apis.routes.ping_db", new_callable=AsyncMock, return_value=True)
    @patch("services.product_comparison.apis.routes.ping_redis", new_callable=AsyncMock, return_value=True)
    def test_all_healthy(self, mock_redis, mock_pds, mock_llm, client):
        resp = client.get("/us/common/ai/v1/compare/health/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["dependencies"]["redis"] == "ok"
        assert body["dependencies"]["pds"] == "ok"
        assert body["dependencies"]["llm"] == "ok"
        assert "duration_ms" in body

    @patch("services.product_comparison.apis.routes.ping_llm", new_callable=AsyncMock, return_value=True)
    @patch("services.product_comparison.apis.routes.ping_db", new_callable=AsyncMock, return_value=True)
    @patch("services.product_comparison.apis.routes.ping_redis", new_callable=AsyncMock, return_value=False)
    def test_redis_down(self, mock_redis, mock_pds, mock_llm, client):
        resp = client.get("/us/common/ai/v1/compare/health/ready")
        assert resp.status_code == 503
        body = resp.json()
        assert body["status"] == "degraded"
        assert body["dependencies"]["redis"] == "unavailable"
        assert body["dependencies"]["pds"] == "ok"
        assert body["dependencies"]["llm"] == "ok"

    @patch("services.product_comparison.apis.routes.ping_llm", new_callable=AsyncMock, return_value=True)
    @patch("services.product_comparison.apis.routes.ping_db", new_callable=AsyncMock, return_value=False)
    @patch("services.product_comparison.apis.routes.ping_redis", new_callable=AsyncMock, return_value=True)
    def test_pds_down(self, mock_redis, mock_pds, mock_llm, client):
        resp = client.get("/us/common/ai/v1/compare/health/ready")
        assert resp.status_code == 503
        body = resp.json()
        assert body["status"] == "degraded"
        assert body["dependencies"]["pds"] == "unavailable"

    @patch("services.product_comparison.apis.routes.ping_llm", new_callable=AsyncMock, return_value=False)
    @patch("services.product_comparison.apis.routes.ping_db", new_callable=AsyncMock, return_value=True)
    @patch("services.product_comparison.apis.routes.ping_redis", new_callable=AsyncMock, return_value=True)
    def test_llm_down(self, mock_redis, mock_pds, mock_llm, client):
        resp = client.get("/us/common/ai/v1/compare/health/ready")
        assert resp.status_code == 503
        body = resp.json()
        assert body["status"] == "degraded"
        assert body["dependencies"]["llm"] == "unavailable"

    @patch("services.product_comparison.apis.routes.ping_llm", new_callable=AsyncMock, return_value=False)
    @patch("services.product_comparison.apis.routes.ping_db", new_callable=AsyncMock, return_value=False)
    @patch("services.product_comparison.apis.routes.ping_redis", new_callable=AsyncMock, return_value=False)
    def test_all_down(self, mock_redis, mock_pds, mock_llm, client):
        resp = client.get("/us/common/ai/v1/compare/health/ready")
        assert resp.status_code == 503
        body = resp.json()
        assert body["status"] == "degraded"
        assert body["dependencies"]["redis"] == "unavailable"
        assert body["dependencies"]["pds"] == "unavailable"
        assert body["dependencies"]["llm"] == "unavailable"

    @patch(
        "services.product_comparison.apis.routes.ping_llm",
        new_callable=AsyncMock,
        side_effect=RuntimeError("unexpected"),
    )
    @patch("services.product_comparison.apis.routes.ping_db", new_callable=AsyncMock, return_value=True)
    @patch("services.product_comparison.apis.routes.ping_redis", new_callable=AsyncMock, return_value=True)
    def test_exception_treated_as_failure(self, mock_redis, mock_pds, mock_llm, client):
        """If a ping function raises instead of returning False, treat it as unavailable."""
        resp = client.get("/us/common/ai/v1/compare/health/ready")
        assert resp.status_code == 503
        body = resp.json()
        assert body["dependencies"]["llm"] == "unavailable"
        # The other two should still be ok
        assert body["dependencies"]["redis"] == "ok"
        assert body["dependencies"]["pds"] == "ok"

    # ----- Retry-specific tests -----

    @patch("services.product_comparison.apis.routes.ping_llm", new_callable=AsyncMock, return_value=True)
    @patch("services.product_comparison.apis.routes.ping_db", new_callable=AsyncMock, return_value=True)
    @patch(
        "services.product_comparison.apis.routes.ping_redis",
        new_callable=AsyncMock,
        side_effect=[False, True],
    )
    def test_transient_redis_failure_recovers(self, mock_redis, mock_pds, mock_llm, client):
        """A single transient failure should be retried and recover to 200."""
        resp = client.get("/us/common/ai/v1/compare/health/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["dependencies"]["redis"] == "ok"
        assert mock_redis.call_count == 2

    @patch("services.product_comparison.apis.routes.ping_llm", new_callable=AsyncMock, return_value=True)
    @patch("services.product_comparison.apis.routes.ping_db", new_callable=AsyncMock, return_value=True)
    @patch(
        "services.product_comparison.apis.routes.ping_redis",
        new_callable=AsyncMock,
        return_value=False,
    )
    def test_persistent_redis_failure_returns_503(self, mock_redis, mock_pds, mock_llm, client):
        """All retry attempts fail -> 503 degraded."""
        resp = client.get("/us/common/ai/v1/compare/health/ready")
        assert resp.status_code == 503
        body = resp.json()
        assert body["status"] == "degraded"
        assert body["dependencies"]["redis"] == "unavailable"
        assert mock_redis.call_count == 3

    @patch("services.product_comparison.apis.routes.ping_llm", new_callable=AsyncMock, return_value=True)
    @patch(
        "services.product_comparison.apis.routes.ping_db",
        new_callable=AsyncMock,
        side_effect=[False, False, True],
    )
    @patch("services.product_comparison.apis.routes.ping_redis", new_callable=AsyncMock, return_value=True)
    def test_transient_pds_failure_recovers_on_third_attempt(
        self, mock_redis, mock_pds, mock_llm, client
    ):
        """Two failures then success should return 200."""
        resp = client.get("/us/common/ai/v1/compare/health/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["dependencies"]["pds"] == "ok"
        assert mock_pds.call_count == 3

    @patch(
        "services.product_comparison.apis.routes.ping_llm",
        new_callable=AsyncMock,
        side_effect=[False, True],
    )
    @patch(
        "services.product_comparison.apis.routes.ping_db",
        new_callable=AsyncMock,
        side_effect=[False, True],
    )
    @patch("services.product_comparison.apis.routes.ping_redis", new_callable=AsyncMock, return_value=True)
    def test_multiple_transient_failures_recover(self, mock_redis, mock_pds, mock_llm, client):
        """Multiple dependencies can fail transiently and recover independently."""
        resp = client.get("/us/common/ai/v1/compare/health/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"


# -------------------------------------------------------------------------
# Verify debug routes are removed
# -------------------------------------------------------------------------


class TestDebugRoutesRemoved:
    def test_debug_pds_returns_404(self, client):
        resp = client.get("/us/common/ai/v1/compare/debug/pds")
        assert resp.status_code in (404, 405)

    def test_debug_llm_returns_404(self, client):
        resp = client.post("/us/common/ai/v1/compare/debug/llm", json={})
        assert resp.status_code in (404, 405)

    def test_debug_llm_by_ids_returns_404(self, client):
        resp = client.post("/us/common/ai/v1/compare/debug/llm/by-ids", json={"ids": ["A"]})
        assert resp.status_code in (404, 405)

    def test_debug_llm_stream_returns_404(self, client):
        resp = client.post("/us/common/ai/v1/compare/debug/llm/stream", json={})
        assert resp.status_code in (404, 405)

    def test_old_health_db_returns_404(self, client):
        resp = client.get("/us/common/ai/v1/compare/health/db")
        assert resp.status_code in (404, 405)
