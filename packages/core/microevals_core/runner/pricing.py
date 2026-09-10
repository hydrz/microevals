"""Sourced model pricing and cost calculation in USD per one million tokens."""

from dataclasses import dataclass
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse


PRICING_REGISTRY_VERSION = "2026-09-10"

# Format: model_prefix_or_name -> (input_cost_per_1m, output_cost_per_1m)
MODEL_PRICING: Dict[str, Tuple[float, float]] = {
    # DeepSeek
    "deepseek-chat": (0.14, 0.28),
    "deepseek-reasoner": (0.55, 2.19),
    "deepseek-v3": (0.14, 0.28),
    "deepseek-r1": (0.55, 2.19),
    # OpenAI
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "o1": (15.00, 60.00),
    "o1-mini": (1.10, 4.40),
    "o3-mini": (1.10, 4.40),
    # Anthropic
    "claude-3-5-sonnet": (3.00, 15.00),
    "claude-3-7-sonnet": (3.00, 15.00),
    "claude-3-5-haiku": (0.80, 4.00),
    "claude-3-opus": (15.00, 75.00),
    # Google
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-1.5-flash": (0.075, 0.30),
    "gemini-1.5-pro": (1.25, 5.00),
    # Qwen
    "qwen-turbo": (0.05, 0.10),
    "qwen-plus": (0.11, 0.28),
    "qwen-max": (0.42, 1.25),
    # Ollama / Local models
    "ollama": (0.0, 0.0),
    "llama": (0.0, 0.0),
}


@dataclass(frozen=True)
class PriceQuote:
    input_per_million: float
    output_per_million: float
    source: str
    version: str


def _is_local_url(base_url: Optional[str]) -> bool:
    if not base_url:
        return False
    if base_url.startswith("mock://"):
        return True
    return (urlparse(base_url).hostname or "").lower() in {"localhost", "127.0.0.1", "::1"}


def resolve_price(
    model_name: str,
    *,
    base_url: Optional[str] = None,
    override: Optional[Tuple[float, float]] = None,
) -> Optional[PriceQuote]:
    if override is not None:
        return PriceQuote(override[0], override[1], "provider-override", "user")
    model_lower = model_name.lower().strip()
    for key, price in MODEL_PRICING.items():
        if key in model_lower:
            return PriceQuote(price[0], price[1], "built-in-registry", PRICING_REGISTRY_VERSION)
    if _is_local_url(base_url):
        return PriceQuote(0.0, 0.0, "local-estimate", PRICING_REGISTRY_VERSION)
    return None


def calculate_cost(
    model_name: str,
    input_tokens: int,
    output_tokens: int,
    *,
    base_url: Optional[str] = None,
    override: Optional[Tuple[float, float]] = None,
) -> Optional[float]:
    """Calculate estimated cost in USD based on input and output tokens."""
    quote = resolve_price(model_name, base_url=base_url, override=override)
    if quote is None:
        return None
    input_cost = (input_tokens / 1_000_000) * quote.input_per_million
    output_cost = (output_tokens / 1_000_000) * quote.output_per_million
    
    return round(input_cost + output_cost, 6)
