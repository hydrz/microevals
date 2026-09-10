"""Universal OpenAI-compatible model runner for streaming and tool calls."""

import json
import time
from typing import AsyncIterator, Dict, List, Optional, Any, Tuple
import httpx

from microevals_core.runner.base import (
    BaseModelRunner,
    ModelParams,
    StreamChunk,
    ToolCall,
)
from microevals_core.runner.metrics import MetricsTracker


class OpenAICompatibleRunner(BaseModelRunner):
    """Executes requests against any standard OpenAI-compatible API."""

    def __init__(
        self,
        model_name: str,
        base_url: str = "https://api.openai.com/v1",
        api_key: str = "",
        timeout: float = 60.0,
        extra_headers: Optional[Dict[str, str]] = None,
        client: Optional[httpx.AsyncClient] = None,
        price_override: Optional[Tuple[float, float]] = None,
    ):
        super().__init__(model_name=model_name, base_url=base_url, api_key=api_key)
        self.timeout = timeout
        self.extra_headers = extra_headers or {}
        self._external_client = client
        self.price_override = price_override

    async def stream(
        self,
        messages: List[Dict[str, Any]],
        params: Optional[ModelParams] = None,
    ) -> AsyncIterator[StreamChunk]:
        """Stream chunks from OpenAI-compatible endpoint with real-time metrics."""
        params = params or ModelParams()
        tracker = MetricsTracker(
            model_name=self.model_name,
            base_url=self.base_url,
            price_override=self.price_override,
        )
        tracker.record_start()

        # Support built-in mock runner for immediate no-key sandbox testing
        if self.base_url.startswith("mock://"):
            import asyncio
            user_text = messages[-1].get("content", "") if messages else ""
            mock_tokens = [
                f"[{self.model_name}] ",
                "Based ", "on ", "careful ", "reasoning, ",
                "here ", "is ", "the ", "response:\n\n",
            ]
            if "strawberry" in user_text.lower():
                mock_tokens.extend(["There ", "are ", "3 ", "'r's ", "in ", "the ", "word ", "'strawberry' ", "(r, ", "r, ", "r)."])
            elif params.tools:
                yield StreamChunk(
                    tool_calls=[
                        ToolCall(
                            id="call_mock_1",
                            function={"name": "calculator", "arguments": '{"expression": "42 * 2"}'},
                        )
                    ]
                )
                mock_tokens.extend(["Result ", "computed ", "via ", "sandbox ", "calculator: ", "84."])
            else:
                mock_tokens.extend([
                    "The ", "evaluation ", "task ", "has ", "been ", "processed ",
                    "successfully ", "in ", "the ", "MicroEvals ", "sandbox."
                ])

            output_tokens = 0
            for token in mock_tokens:
                await asyncio.sleep(0.03)
                tracker.record_first_token()
                output_tokens += 1
                tracker.record_tokens(input_tokens=15, output_tokens=output_tokens)
                elapsed_ms = (time.perf_counter() - tracker.start_time) * 1000.0
                yield StreamChunk(
                    delta=token,
                    ttft_ms=tracker.ttft_ms,
                    elapsed_ms=elapsed_ms,
                )

            metrics = tracker.finalize()
            yield StreamChunk(is_done=True, metrics=metrics)
            return

        # Build messages payload (prepend system prompt if present)
        formatted_messages = []
        if params.system_prompt:
            formatted_messages.append({"role": "system", "content": params.system_prompt})
        formatted_messages.extend(messages)

        payload: Dict[str, Any] = {
            "model": self.model_name,
            "messages": formatted_messages,
            "stream": True,
            "stream_options": {"include_usage": True},
            "temperature": params.temperature,
            "top_p": params.top_p,
        }
        if params.max_tokens is not None:
            payload["max_tokens"] = params.max_tokens
        if params.frequency_penalty != 0.0:
            payload["frequency_penalty"] = params.frequency_penalty
        if params.presence_penalty != 0.0:
            payload["presence_penalty"] = params.presence_penalty
        if params.stop:
            payload["stop"] = params.stop
        if params.seed is not None:
            payload["seed"] = params.seed
        if params.tools:
            payload["tools"] = params.tools
        if params.tool_choice:
            payload["tool_choice"] = params.tool_choice

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}" if self.api_key else "",
        }
        if self.extra_headers:
            headers.update(self.extra_headers)

        endpoint = f"{self.base_url.rstrip('/')}/chat/completions"
        req_timeout = params.timeout if params.timeout is not None else self.timeout
        client = self._external_client or httpx.AsyncClient(timeout=req_timeout)
        should_close = self._external_client is None

        tool_calls_accumulator: Dict[int, Dict[str, Any]] = {}
        output_text_length = 0
        first_chunk_emitted = False

        try:
            async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield StreamChunk(
                        error=f"API returned status {response.status_code}: {error_text.decode('utf-8', errors='replace')}",
                        is_done=True,
                    )
                    return

                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break

                        try:
                            chunk_data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        # Check for usage block
                        usage = chunk_data.get("usage")
                        if usage:
                            tracker.record_tokens(
                                input_tokens=usage.get("prompt_tokens", 0),
                                output_tokens=usage.get("completion_tokens", 0),
                            )

                        choices = chunk_data.get("choices", [])
                        if not choices:
                            continue

                        choice = choices[0]
                        delta = choice.get("delta", {})
                        content = delta.get("content") or ""
                        tool_calls_delta = delta.get("tool_calls") or []

                        chunk_tool_calls: List[ToolCall] = []
                        if tool_calls_delta:
                            for tc_delta in tool_calls_delta:
                                idx = tc_delta.get("index", 0)
                                if idx not in tool_calls_accumulator:
                                    tool_calls_accumulator[idx] = {
                                        "id": tc_delta.get("id", f"call_{idx}"),
                                        "name": tc_delta.get("function", {}).get("name", ""),
                                        "arguments": "",
                                    }
                                func_delta = tc_delta.get("function", {})
                                if "name" in func_delta and not tool_calls_accumulator[idx]["name"]:
                                    tool_calls_accumulator[idx]["name"] = func_delta["name"]
                                if "arguments" in func_delta:
                                    tool_calls_accumulator[idx]["arguments"] += func_delta["arguments"]

                                tc_info = tool_calls_accumulator[idx]
                                chunk_tool_calls.append(
                                    ToolCall(
                                        id=tc_info["id"],
                                        name=tc_info["name"],
                                        arguments=tc_info["arguments"],
                                    )
                                )

                        if content or chunk_tool_calls:
                            output_text_length += len(content)
                            is_first = not first_chunk_emitted
                            if is_first:
                                tracker.record_first_token()
                                first_chunk_emitted = True

                            elapsed_ms = (time.perf_counter() - tracker.start_time) * 1000.0
                            yield StreamChunk(
                                delta=content,
                                is_first=is_first,
                                ttft_ms=tracker.ttft_ms,
                                elapsed_ms=round(elapsed_ms, 2),
                                tool_calls=chunk_tool_calls,
                                is_done=False,
                            )

        except Exception as exc:
            yield StreamChunk(error=f"Stream connection failed: {str(exc)}", is_done=True)
            return
        finally:
            if should_close:
                await client.aclose()

        # If usage wasn't reported by provider, approximate tokens
        if tracker.output_tokens == 0:
            prompt_str = " ".join([m.get("content", "") for m in formatted_messages])
            approx_input = max(1, len(prompt_str) // 4)
            approx_output = max(1, output_text_length // 4)
            tracker.record_tokens(approx_input, approx_output)

        final_metrics = tracker.finalize()
        yield StreamChunk(
            delta="",
            is_first=False,
            ttft_ms=final_metrics.ttft_ms,
            elapsed_ms=round(final_metrics.total_latency_s * 1000.0, 2),
            metrics=final_metrics,
            is_done=True,
        )
