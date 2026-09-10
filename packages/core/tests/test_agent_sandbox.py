import json
import pytest
from microevals_core.agent_sandbox.tools import execute_mock_tool, safe_eval_math
from microevals_core.agent_sandbox.executor import AgentLoopExecutor
from microevals_core.runner.base import BaseModelRunner, GenerationResult, ToolCall
from microevals_core.runner.metrics import MetricResult

def test_safe_eval_math():
    assert safe_eval_math("2 + 2") == 4.0
    assert safe_eval_math("15 * 10 - 50 / 2") == 125.0
    assert safe_eval_math("(3 + 5) * 2") == 16.0

def test_mock_tool_execution():
    calc_res = execute_mock_tool("calculator", {"expression": "100 / 4"})
    assert calc_res["status"] == "success"
    assert calc_res["result"] == 25.0

    weather_res = execute_mock_tool("get_weather", {"city": "Tokyo", "unit": "celsius"})
    assert weather_res["city"] == "Tokyo"
    assert weather_res["temperature"] == 22

    sql_res = execute_mock_tool("sql_query", {"query": "SELECT * FROM users"})
    assert "columns" in sql_res
    assert len(sql_res["rows"]) >= 1

class MockAgentRunner(BaseModelRunner):
    """Simulates a model that calls calculator on turn 1, then returns answer on turn 2."""
    def __init__(self):
        super().__init__("mock-agent-model", "http://mock", "key")
        self.call_count = 0

    async def stream(self, messages, params=None):
        raise NotImplementedError

    async def generate(self, messages, params=None):
        self.call_count += 1
        metrics = MetricResult(
            model_name="mock-agent-model",
            ttft_ms=150.0,
            total_latency_s=0.5,
            tokens_per_second=20.0,
            input_tokens=20,
            output_tokens=10,
        )

        if self.call_count == 1:
            # First turn: call calculator
            return GenerationResult(
                text="I need to calculate 25 * 4.",
                tool_calls=[
                    ToolCall(id="call_99", name="calculator", arguments='{"expression": "25 * 4"}')
                ],
                metrics=metrics,
            )
        else:
            # Second turn: provide final answer using tool result
            return GenerationResult(
                text="The calculation result is 100.",
                tool_calls=[],
                metrics=metrics,
            )

@pytest.mark.asyncio
async def test_agent_loop_executor_multiturn():
    runner = MockAgentRunner()
    executor = AgentLoopExecutor(max_steps=3)

    trajectory = await executor.run(runner, prompt="What is 25 * 4?")
    assert trajectory.success is True
    assert trajectory.total_steps == 2
    assert "calculator" in trajectory.tools_called
    assert "100" in trajectory.final_answer
    assert trajectory.steps[0].tool_calls[0].name == "calculator"
    assert trajectory.steps[0].tool_results[0]["result"] == 100.0
    assert trajectory.accumulated_metrics is not None
    assert trajectory.accumulated_metrics.input_tokens == 40
    assert trajectory.accumulated_metrics.output_tokens == 20
