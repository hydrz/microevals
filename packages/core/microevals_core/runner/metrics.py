"""High-precision metrics collection and calculation for LLM responses."""

import time
from typing import Optional, Tuple
from pydantic import BaseModel, Field
from microevals_core.runner.pricing import calculate_cost, resolve_price


class MetricResult(BaseModel):
    """Summarized metrics for a single model generation run."""
    model_name: str
    ttft_ms: float = Field(description="Time to First Token in milliseconds")
    total_latency_s: float = Field(description="Total latency in seconds from dispatch to completion")
    tokens_per_second: float = Field(description="Generation speed in tokens per second")
    input_tokens: int = Field(default=0, description="Prompt token count")
    output_tokens: int = Field(default=0, description="Completion token count")
    estimated_cost_usd: Optional[float] = Field(default=None, description="Estimated cost in USD")
    input_price_per_million: Optional[float] = None
    output_price_per_million: Optional[float] = None
    pricing_source: str = "unknown"
    pricing_version: Optional[str] = None


class MetricsTracker:
    """Tracks latency, TTFT, tokens, and calculates throughput metrics."""

    def __init__(
        self,
        model_name: str,
        base_url: Optional[str] = None,
        price_override: Optional[Tuple[float, float]] = None,
    ):
        self.model_name = model_name
        self.base_url = base_url
        self.price_override = price_override
        self.start_time: float = time.perf_counter()
        self.first_token_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.input_tokens: int = 0
        self.output_tokens: int = 0
        self.ttft_ms: Optional[float] = None

    def record_start(self, timestamp: Optional[float] = None) -> None:
        """Mark start of request dispatch."""
        self.start_time = timestamp if timestamp is not None else time.perf_counter()

    def record_first_token(self, timestamp: Optional[float] = None) -> float:
        """Record timestamp of first token arrival and compute TTFT."""
        if self.first_token_time is None:
            self.first_token_time = timestamp if timestamp is not None else time.perf_counter()
            self.ttft_ms = max(0.0, (self.first_token_time - self.start_time) * 1000.0)
        return self.ttft_ms or 0.0

    def record_tokens(self, input_tokens: int, output_tokens: int) -> None:
        """Update token counts."""
        if input_tokens > 0:
            self.input_tokens = input_tokens
        if output_tokens > 0:
            self.output_tokens = output_tokens

    def finalize(self, end_time: Optional[float] = None) -> MetricResult:
        """Finalize timer and compute comprehensive throughput metrics."""
        self.end_time = end_time if end_time is not None else time.perf_counter()
        total_latency_s = max(0.001, self.end_time - self.start_time)

        # If first_token_time was never explicitly set (e.g. non-streaming)
        if self.first_token_time is None:
            self.record_first_token(self.end_time)

        ttft_ms = self.ttft_ms if self.ttft_ms is not None else (total_latency_s * 1000.0)
        ttft_s = ttft_ms / 1000.0

        # Generation duration excludes TTFT
        gen_duration = max(0.001, total_latency_s - ttft_s)
        tps = self.output_tokens / gen_duration if self.output_tokens > 0 else 0.0

        quote = resolve_price(
            self.model_name,
            base_url=self.base_url,
            override=self.price_override,
        )
        cost = calculate_cost(
            self.model_name,
            self.input_tokens,
            self.output_tokens,
            base_url=self.base_url,
            override=self.price_override,
        )

        return MetricResult(
            model_name=self.model_name,
            ttft_ms=round(ttft_ms, 2),
            total_latency_s=round(total_latency_s, 4),
            tokens_per_second=round(tps, 2),
            input_tokens=self.input_tokens,
            output_tokens=self.output_tokens,
            estimated_cost_usd=cost,
            input_price_per_million=quote.input_per_million if quote else None,
            output_price_per_million=quote.output_per_million if quote else None,
            pricing_source=quote.source if quote else "unknown",
            pricing_version=quote.version if quote else None,
        )
