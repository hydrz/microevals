import json
import pytest
import httpx
from microevals_core.runner.openai_runner import OpenAICompatibleRunner
from microevals_core.runner.base import ModelParams

@pytest.mark.asyncio
async def test_openai_runner_streaming_mock():
    # Mock SSE stream
    sse_events = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":2}}\n\n',
        'data: [DONE]\n\n',
    ]

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/chat/completions"
        payload = json.loads(request.content.decode("utf-8"))
        assert payload["model"] == "deepseek-chat"
        assert payload["stream"] is True

        return httpx.Response(
            status_code=200,
            headers={"content-type": "text/event-stream"},
            content="".join(sse_events).encode("utf-8"),
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        runner = OpenAICompatibleRunner(
            model_name="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            api_key="test-key",
            client=client,
        )

        chunks = []
        async for chunk in runner.stream(
            messages=[{"role": "user", "content": "Hi"}],
            params=ModelParams(temperature=0.5),
        ):
            chunks.append(chunk)

        # Check collected chunks
        content_deltas = [c.delta for c in chunks if c.delta]
        assert content_deltas == ["Hello", " World"]

        # Final chunk should contain metrics
        last_chunk = chunks[-1]
        assert last_chunk.is_done is True
        assert last_chunk.metrics is not None
        assert last_chunk.metrics.output_tokens == 2
        assert last_chunk.metrics.input_tokens == 10
        assert last_chunk.metrics.ttft_ms >= 0.0

@pytest.mark.asyncio
async def test_openai_runner_generate_convenience():
    sse_events = [
        'data: {"choices":[{"delta":{"content":"Test Answer"}}]}\n\n',
        'data: [DONE]\n\n',
    ]

    async def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=200,
            headers={"content-type": "text/event-stream"},
            content="".join(sse_events).encode("utf-8"),
        )

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        runner = OpenAICompatibleRunner(
            model_name="gpt-4o",
            base_url="https://api.openai.com/v1",
            api_key="test-key",
            client=client,
        )

        result = await runner.generate([{"role": "user", "content": "Test"}])
        assert result.text == "Test Answer"
        assert result.metrics is not None
        assert result.metrics.model_name == "gpt-4o"
