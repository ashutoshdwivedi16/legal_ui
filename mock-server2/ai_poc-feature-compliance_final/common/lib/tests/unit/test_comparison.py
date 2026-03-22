import pytest
from unittest.mock import AsyncMock
from services.product_comparison.services import comparison
from services.product_comparison.services.prompt_manager import resolve_category
from common.models.requests_pc import ComparisonRequest
from common.models.responses_pc import ComparisonResponse


@pytest.fixture
def mock_deps():
    return {
        "cache_get": AsyncMock(return_value=None),
        "cache_set": AsyncMock(),
        "product_fetch": AsyncMock(),
        "prompts_loader": AsyncMock(),
        "llm_generate": AsyncMock(),
    }


@pytest.mark.asyncio
async def test_generate_comparison_cache_hit(mock_deps):
    cached_summary = {
        "quickPick": ["Pick A if you want general use."],
        "differentiators": [
            {"key": "size", "label": "Size", "products": [{"productId": "A", "summary": "Big"}]}
        ],
        "similarities": ["Both have screens"],
    }
    mock_deps["cache_get"].return_value = cached_summary

    req = ComparisonRequest(products=["A", "B"])

    res = await comparison.generate_comparison(req, **mock_deps)

    assert res.status == "SUCCESS"
    assert len(res.summary.quickPick) == 1
    mock_deps["product_fetch"].assert_not_called()


@pytest.mark.asyncio
async def test_generate_comparison_pds_failure(mock_deps):
    mock_deps["product_fetch"].side_effect = Exception("DB Down")

    req = ComparisonRequest(products=["A", "B"])

    res = await comparison.generate_comparison(req, **mock_deps)

    assert res.summary is None
    assert res.status == "ERROR"


@pytest.mark.asyncio
async def test_generate_comparison_product_mismatch(mock_deps):
    mock_deps["product_fetch"].return_value = [{"id": "A"}]  # Only 1 found

    req = ComparisonRequest(products=["A", "B"])

    res = await comparison.generate_comparison(req, **mock_deps)

    assert res.summary is None
    assert res.status == "UNAVAILABLE"


@pytest.mark.asyncio
async def test_generate_comparison_success(mock_deps):
    # Setup happy path
    mock_deps["product_fetch"].return_value = [
        {"id": "A", "category": "TV", "modelName": "Product A"},
        {"id": "B", "category": "TV", "modelName": "Product B"},
    ]
    mock_deps["prompts_loader"].return_value = ("System", "User", None)

    valid_llm_response = {
        "quickPick": [
            "Pick A if you want movies and streaming.",
            "Pick B if you want gaming and fast refresh.",
        ],
        "differentiators": [
            {
                "key": "refresh_rate",
                "label": "Refresh Rate",
                "products": [{"productId": "B", "summary": "120Hz"}],
            }
        ],
        "similarities": ["4K Resolution"],
    }

    mock_deps["llm_generate"].return_value = {"parsed_json": valid_llm_response, "raw_text": "..."}

    req = ComparisonRequest(products=["A", "B"])

    res = await comparison.generate_comparison(req, **mock_deps)

    assert res.status == "SUCCESS"
    assert res.summary is not None
    assert len(res.summary.quickPick) == 2
    mock_deps["cache_set"].assert_called_once()


# ---------------------------------------------------------------------------
# resolve_category unit tests
# ---------------------------------------------------------------------------


class TestResolveCategory:
    """Tests for resolve_category — maps PDS JSON arrays to prompt file stems."""

    def test_list_with_tvs(self):
        assert resolve_category(["b2c", "tv_and_home_theater", "tvs"]) == "tv"

    def test_list_with_oled_tvs(self):
        assert resolve_category(["b2c", "oled_tvs", "tv_and_home_theater", "tvs"]) == "tv"

    def test_list_with_monitors(self):
        assert resolve_category(["b2c", "computing", "monitor_tv", "monitors"]) == "monitor"

    def test_plain_string_tv(self):
        """Test mocks use plain strings like 'TV'."""
        assert resolve_category("TV") == "tv"

    def test_plain_string_monitor(self):
        assert resolve_category("monitor") == "monitor"

    def test_json_encoded_array(self):
        assert resolve_category('["b2c", "computing", "monitors"]') == "monitor"

    def test_none_returns_unknown(self):
        assert resolve_category(None) == "unknown"

    def test_empty_list_returns_unknown(self):
        assert resolve_category([]) == "unknown"

    def test_unmapped_falls_back_to_last_element(self):
        result = resolve_category(["b2c", "some_new_thing"])
        assert result == "some_new_thing"


# ---------------------------------------------------------------------------
# Integration: list-based categories flow through generate_comparison
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_comparison_with_list_categories(mock_deps):
    """Products with PDS-style list categories resolve and reach prompts_loader."""
    mock_deps["product_fetch"].return_value = [
        {"id": "A", "category": ["b2c", "computing", "monitor_tv", "monitors"], "modelName": "Monitor A"},
        {"id": "B", "category": ["b2c", "computing", "monitors"], "modelName": "Monitor B"},
    ]
    mock_deps["prompts_loader"].return_value = ("System", "User", None)
    mock_deps["llm_generate"].return_value = {
        "parsed_json": {
            "quickPick": ["Pick A for size.", "Pick B for refresh rate."],
            "differentiators": [
                {
                    "key": "size",
                    "label": "Screen Size",
                    "products": [{"productId": "A", "summary": "32 inch"}],
                }
            ],
            "similarities": ["Both are IPS panels"],
        },
        "raw_text": "...",
    }

    req = ComparisonRequest(products=["A", "B"])
    res = await comparison.generate_comparison(req, **mock_deps)

    assert res.status == "SUCCESS"
    mock_deps["prompts_loader"].assert_called_once_with("monitor")


