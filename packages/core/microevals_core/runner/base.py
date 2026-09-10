"""Base classes and data models for model runners."""

from abc import ABC, abstractmethod
from typing import AsyncIterator, Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field
from microevals_core.runner.metrics import MetricResult


class ToolCall(BaseModel):
    """Tool/function call requested by the model."""
    id: str
    name: str
    arguments: str = ""


class ModelParams(BaseModel):
    """Execution parameters for model generation."""
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    top_p: float = 1.0
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    stop: Optional[Union[str, List[str]]] = None
    seed: Optional[int] = None
    timeout: Optional[float] = None
    system_prompt: Optional[str] = None
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[Union[str, Dict[str, Any]]] = None


class StreamChunk(BaseModel):
    """Incremental chunk produced by a streaming runner."""
    delta: str = ""
    is_first: bool = False
    ttft_ms: Optional[float] = None
    elapsed_ms: float = 0.0
    tool_calls: List[ToolCall] = Field(default_factory=list)
    metrics: Optional[MetricResult] = None
    is_done: bool = False
    error: Optional[str] = None


class GenerationResult(BaseModel):
    """Complete output of a non-streaming or completed generation."""
    text: str = ""
    tool_calls: List[ToolCall] = Field(default_factory=list)
    metrics: MetricResult
    error: Optional[str] = None


class BaseModelRunner(ABC):
    """Abstract interface for all LLM providers."""

    def __init__(self, model_name: str, base_url: str, api_key: str):
        self.model_name = model_name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    @abstractmethod
    async def stream(
        self,
        messages: List[Dict[str, Any]],
        params: Optional[ModelParams] = None,
    ) -> AsyncIterator[StreamChunk]:
        """Stream chunks with incremental text, tool calls, and final metrics."""
        yield StreamChunk(is_done=True)

    async def generate(
        self,
        messages: List[Dict[str, Any]],
        params: Optional[ModelParams] = None,
    ) -> GenerationResult:
        """Run complete generation accumulating streamed chunks."""
        full_text = []
        collected_tool_calls: Dict[int, ToolCall] = {}
        last_metrics = None
        error_msg = None

        async for chunk in self.stream(messages, params):
            if chunk.error:
                error_msg = chunk.error
            if chunk.delta:
                full_text.append(chunk.delta)
            for tc in chunk.tool_calls:
                # Merge or record tool call
                collected_tool_calls[tc.id] = tc
            if chunk.metrics:
                last_metrics = chunk.metrics

        from microevals_core.runner.metrics import MetricResult
        if last_metrics is None:
            last_metrics = MetricResult(
                model_name=self.model_name,
                ttft_ms=0.0,
                total_latency_s=0.0,
                tokens_per_second=0.0,
                input_tokens=0,
                output_tokens=len("".join(full_text)) // 4,
                estimated_cost_usd=0.0,
            )

        return GenerationResult(
            text="".join(full_text),
            tool_calls=list(collected_tool_calls.values()),
            metrics=last_metrics,
            error=error_msg,
        )
