import pytest
import json
from services.product_comparison.services import cache
from common.models.exceptions import ServiceError, ErrorCode


@pytest.mark.asyncio
async def test_build_cache_key():
    key = cache.build_cache_key("OBS", "en-US", "v1", ["B", "A", "C"])
    assert key == "compare:OBS:en-US:v1:A|B|C"


@pytest.mark.asyncio
async def test_get_comparison_hit(mock_redis):
    payload = {"summary": "test"}
    await mock_redis.set("test-key", json.dumps(payload))

    result = await cache.get_comparison("test-key")
    assert result == payload


@pytest.mark.asyncio
async def test_get_comparison_miss(mock_redis):
    result = await cache.get_comparison("missing-key")
    assert result is None


@pytest.mark.asyncio
async def test_get_comparison_corrupt(mock_redis):
    await mock_redis.set("corrupt-key", "{invalid-json")

    result = await cache.get_comparison("corrupt-key")
    assert result is None


@pytest.mark.asyncio
async def test_set_comparison_success(mock_redis):
    payload = {"summary": "saved"}
    await cache.set_comparison("save-key", payload, ttl=60)

    stored = await mock_redis.get("save-key")
    assert json.loads(stored) == payload


@pytest.mark.asyncio
async def test_redis_error_on_get(mocker):
    mock_client = mocker.Mock()
    mock_client.get = mocker.AsyncMock(side_effect=Exception("Connection failed"))
    mocker.patch("services.product_comparison.services.cache._get_client", return_value=mock_client)

    with pytest.raises(ServiceError) as exc:
        await cache.get_comparison("any-key")
    assert exc.value.code == ErrorCode.SERVICE_CACHE_UNAVAILABLE


@pytest.mark.asyncio
async def test_redis_error_on_set(mocker):
    mock_client = mocker.Mock()
    mock_client.set = mocker.AsyncMock(side_effect=Exception("Connection failed"))
    mocker.patch("services.product_comparison.services.cache._get_client", return_value=mock_client)

    with pytest.raises(ServiceError) as exc:
        await cache.set_comparison("any-key", {})
    assert exc.value.code == ErrorCode.SERVICE_CACHE_UNAVAILABLE
