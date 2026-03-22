import pytest
import os
import fakeredis.aioredis
from unittest.mock import MagicMock

os.environ["APP_ENV"] = "testing"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"


@pytest.fixture
def mock_settings(mocker):
    settings_mock = mocker.patch("common.config.settings.get_settings")
    settings_obj = MagicMock()
    settings_obj.app_env = "testing"
    settings_obj.redis_host = "localhost"
    settings_obj.redis_port = 6379
    settings_obj.redis_db = 0
    settings_obj.redis_url = "redis://localhost:6379/0"
    settings_obj.cache_ttl_seconds = 3600
    settings_obj.llm_model = "test-model"
    settings_mock.return_value = settings_obj
    return settings_obj


@pytest.fixture
def mock_redis(mocker):
    fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=False)
    mocker.patch("services.product_comparison.services.cache._get_client", return_value=fake_redis)
    return fake_redis


@pytest.fixture
def mock_llm_client(mocker):
    return mocker.patch("services.product_comparison.services.llm_client.generate")


@pytest.fixture
def mock_product_repo(mocker):
    return mocker.patch("services.product_comparison.repositories.product.fetch_products_by_md_ids")
