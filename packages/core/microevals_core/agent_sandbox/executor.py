"""Multi-turn Agent trajectory execution loop with sandbox mock tools."""

import json
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from microevals_core.agent_sandbox.tools import (
    BUILTIN_TOOLS_DEFINITIONS,
    execute_mock_tool,
)
from microevals_core.runner.base import BaseModelRunner, ModelParams, ToolCall
from microevals_core.runner.metrics import MetricResult


class AgentStep(BaseModel):
    """Single step in an agent trajectory."""
    step_number: int
    thought_or_text: str = ""
    tool_calls: List[ToolCall] = Field(default_factory=list)
    tool_results: List[Dict[str, Any]] = Field(default_factory=list)


class AgentTrajectory(BaseModel):
    """Complete multi-turn trajectory executed by the model."""
    model_name: str
    steps: List[AgentStep] = Field(default_factory=list)
    final_answer: str = ""
    total_steps: int = 0
    tools_called: List[str] = Field(default_factory=list)
    success: bool = True
    error: Optional[str] = None
    accumulated_metrics: Optional[MetricResult] = None


class AgentLoopExecutor:
    """Orchestrates multi-turn model-tool interactions."""

    def __init__(self, max_steps: int = 5):
        self.max_steps = max_steps

    async def run(
        self,
        runner: BaseModelRunner,
        prompt: str,
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        custom_tool_executor: Optional[Any] = None,
    ) -> AgentTrajectory:
        """Run agent loop until model finishes or hits max_steps."""
        active_tools = tools or BUILTIN_TOOLS_DEFINITIONS
        messages: List[Dict[str, Any]] = [{"role": "user", "content": prompt}]

        steps: List[AgentStep] = []
        tools_called_list: List[str] = []
        final_answer = ""
        total_input_tokens = 0
        total_output_tokens = 0
        total_latency = 0.0
        first_ttft = None

        tool_exec_func = custom_tool_executor or execute_mock_tool

        for step_idx in range(1, self.max_steps + 1):
            params = ModelParams(
                system_prompt=system_prompt,
                tools=active_tools,
                temperature=0.2,
            )

            gen_result = await runner.generate(messages, params=params)

            if gen_result.error:
                return AgentTrajectory(
                    model_name=runner.model_name,
                    steps=steps,
                    final_answer=final_answer,
                    total_steps=len(steps),
                    tools_called=tools_called_list,
                    success=False,
                    error=gen_result.error,
                )

            # Accumulate metrics
            m = gen_result.metrics
            if first_ttft is None:
                first_ttft = m.ttft_ms
            total_input_tokens += m.input_tokens
            total_output_tokens += m.output_tokens
            total_latency += m.total_latency_s

            step = AgentStep(
                step_number=step_idx,
                thought_or_text=gen_result.text,
                tool_calls=gen_result.tool_calls,
            )

            # If no tool calls, model provided final answer
            if not gen_result.tool_calls:
                final_answer = gen_result.text
                steps.append(step)
                break

            # Process tool calls
            assistant_msg: Dict[str, Any] = {
                "role": "assistant",
                "content": gen_result.text or None,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.name, "arguments": tc.arguments},
                    }
                    for tc in gen_result.tool_calls
                ],
            }
            messages.append(assistant_msg)

            tool_results_for_step = []
            for tc in gen_result.tool_calls:
                tools_called_list.append(tc.name)
                try:
                    args_dict = json.loads(tc.arguments) if tc.arguments else {}
                except Exception:
                    args_dict = {"raw": tc.arguments}

                result_data = tool_exec_func(tc.name, args_dict)
                tool_results_for_step.append(result_data)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result_data, ensure_ascii=False),
                })

            step.tool_results = tool_results_for_step
            steps.append(step)

        # Assemble summary metrics
        tps = (
            total_output_tokens / max(0.001, total_latency - ((first_ttft or 0.0) / 1000.0))
            if total_output_tokens > 0
            else 0.0
        )
        from microevals_core.runner.pricing import calculate_cost
        cost = calculate_cost(
            runner.model_name,
            total_input_tokens,
            total_output_tokens,
            base_url=runner.base_url,
        )

        summary_metrics = MetricResult(
            model_name=runner.model_name,
            ttft_ms=round(first_ttft or 0.0, 2),
            total_latency_s=round(total_latency, 4),
            tokens_per_second=round(tps, 2),
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens,
            estimated_cost_usd=cost,
        )

        return AgentTrajectory(
            model_name=runner.model_name,
            steps=steps,
            final_answer=final_answer or (steps[-1].thought_or_text if steps else ""),
            total_steps=len(steps),
            tools_called=tools_called_list,
            success=True,
            accumulated_metrics=summary_metrics,
        )
