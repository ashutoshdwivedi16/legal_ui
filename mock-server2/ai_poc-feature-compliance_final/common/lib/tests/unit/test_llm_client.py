import pytest
from unittest.mock import MagicMock
from services.product_comparison.services import llm_client
from common.models.exceptions import ServiceError, ErrorCode
import litellm


@pytest.fixture
def mock_litellm(mocker):
    return mocker.patch("litellm.acompletion")


@pytest.mark.asyncio
async def test_generate_success(mock_litellm):
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content='{"key": "value"}'))]
    mock_response.usage.prompt_tokens = 10
    mock_response.usage.completion_tokens = 20
    mock_litellm.return_value = mock_response

    result = await llm_client.generate("sys", "user")

    assert result["raw_text"] == '{"key": "value"}'
    assert result["parsed_json"] == {"key": "value"}
    assert result["prompt_tokens"] == 10
    assert result["completion_tokens"] == 20


@pytest.mark.asyncio
async def test_generate_rate_limit(mock_litellm):
    mock_litellm.side_effect = litellm.RateLimitError(
        "Rate limit exceeded", llm_provider="openai", model="gpt-4"
    )

    with pytest.raises(ServiceError) as exc:
        await llm_client.generate("sys", "user")

    assert exc.value.code == ErrorCode.SERVICE_LLM_RATE_LIMITED


@pytest.mark.asyncio
async def test_generate_timeout(mock_litellm):
    mock_litellm.side_effect = litellm.Timeout(
        "Request timed out", llm_provider="openai", model="gpt-4"
    )

    with pytest.raises(ServiceError) as exc:
        await llm_client.generate("sys", "user")

    assert exc.value.code == ErrorCode.SERVICE_LLM_TIMEOUT


@pytest.mark.asyncio
async def test_json_parsing_resilience():
    # Test valid JSON
    assert llm_client._parse_json_safe('{"a": 1}') == {"a": 1}

    # Test markdown fenced JSON
    assert llm_client._parse_json_safe('```json\n{"a": 1}\n```') == {"a": 1}

    # Test text with JSON embedded
    text = """
    Here is the JSON:
    ```
    {"a": 1}
    ```
    """
    assert llm_client._parse_json_safe(text) == {"a": 1}

    # Test invalid JSON
    assert llm_client._parse_json_safe("Not JSON") is None
