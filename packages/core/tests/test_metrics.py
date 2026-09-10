import pytest
from microevals_core.runner.metrics import MetricsTracker
from microevals_core.runner.pricing import calculate_cost

def test_metrics_tracker_calculation():
    tracker = MetricsTracker(model_name="deepseek-chat")
    tracker.start_time = 100.0
    
    # First token arrived at 100.25 (250ms TTFT)
    tracker.record_first_token(timestamp=100.25)
    assert tracker.ttft_ms == pytest.approx(250.0, rel=1e-2)
    
    # Output 100 tokens
    tracker.record_tokens(input_tokens=50, output_tokens=100)
    
    # Finished at 101.25 (total 1.25s, generation duration = 1.0s)
    result = tracker.finalize(end_time=101.25)
    
    assert result.ttft_ms == pytest.approx(250.0, rel=1e-2)
    assert result.total_latency_s == pytest.approx(1.25, rel=1e-2)
    # TPS = 100 tokens / 1.0s = 100.0 t/s
    assert result.tokens_per_second == pytest.approx(100.0, rel=1e-2)
    assert result.input_tokens == 50
    assert result.output_tokens == 100
    assert result.estimated_cost_usd > 0

def test_pricing_calculator():
    # DeepSeek V3: input ~$0.14 / M, output ~$0.28 / M
    cost = calculate_cost("deepseek-chat", input_tokens=1_000_000, output_tokens=1_000_000)
    assert cost > 0.3
    assert cost < 0.6
    
    # Unknown remote models must not receive a fabricated fallback price.
    fallback_cost = calculate_cost("unknown-model", input_tokens=1000, output_tokens=1000)
    assert fallback_cost is None

    local_cost = calculate_cost(
        "unknown-model",
        input_tokens=1000,
        output_tokens=1000,
        base_url="http://localhost:11434/v1",
    )
    assert local_cost == 0.0
