"""Async batch evaluation engine with rate limiting and progress callbacks."""

import asyncio
import time
from typing import Any, Callable, Coroutine, Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field

from microevals_core.agent_sandbox.executor import AgentLoopExecutor
from microevals_core.builtin_presets.loader import TestCaseItem
from microevals_core.evaluators.agent import AgentEvaluator
from microevals_core.evaluators.base import BaseEvaluator, EvalResult
from microevals_core.evaluators.rule import RuleEvaluator
from microevals_core.runner.base import BaseModelRunner, ModelParams
from microevals_core.runner.metrics import MetricResult


class BatchCaseResult(BaseModel):
    """Result of running a single test case against a single model."""
    case_id: str
    model_name: str
    prompt: str
    output_text: str = ""
    metrics: MetricResult
    eval_results: List[EvalResult] = Field(default_factory=list)
    primary_evaluator: Optional[str] = None
    diagnostic_results: List[EvalResult] = Field(default_factory=list)
    verdict: str = "unevaluated"
    passed: Optional[bool] = None
    score: Optional[float] = None
    error: Optional[str] = None


class ModelBatchSummary(BaseModel):
    """Aggregated metrics and score for a model across a batch run."""
    model_name: str
    total_cases: int = 0
    passed_cases: int = 0
    failed_cases: int = 0
    evaluated_cases: int = 0
    unevaluated_cases: int = 0
    execution_error_cases: int = 0
    pass_rate: Optional[float] = None
    avg_score: Optional[float] = None
    avg_ttft_ms: float = 0.0
    avg_total_latency_s: float = 0.0
    avg_tokens_per_second: float = 0.0
    total_cost_usd: Optional[float] = None
    total_tokens: int = 0


class BatchRunSummary(BaseModel):
    """Overall summary of a multi-model batch benchmark run."""
    run_id: str
    total_cases: int
    models: List[str]
    model_summaries: Dict[str, ModelBatchSummary] = Field(default_factory=dict)
    case_results: List[BatchCaseResult] = Field(default_factory=list)


class BatchEngine:
    """Dispatches test cases across models concurrently with rate-limiting."""

    def __init__(self, concurrency: int = 3):
        self.concurrency = max(1, concurrency)
        self.rule_evaluator = RuleEvaluator()
        self.agent_evaluator = AgentEvaluator()
        self.agent_executor = AgentLoopExecutor(max_steps=5)

    async def run_batch(
        self,
        cases: List[TestCaseItem],
        runners: List[BaseModelRunner],
        evaluators: Optional[List[BaseEvaluator]] = None,
        default_params: Optional[ModelParams] = None,
        on_progress: Optional[Callable[[int, int, BatchCaseResult], Coroutine[Any, Any, None]]] = None,
        run_id: Optional[str] = None,
        should_cancel: Optional[Callable[[], bool]] = None,
        include_pairs: Optional[Set[Tuple[str, str]]] = None,
    ) -> BatchRunSummary:
        """Run all cases against all models, computing metrics and aggregate leaderboard."""
        run_id = run_id or f"run_{int(time.time())}"
        scheduled_pairs = [
            (case, runner)
            for case in cases
            for runner in runners
            if include_pairs is None or (case.id, runner.model_name) in include_pairs
        ]
        total_evaluations = len(scheduled_pairs)
        semaphore = asyncio.Semaphore(self.concurrency)
        completed_count = 0
        progress_lock = asyncio.Lock()

        case_results: List[BatchCaseResult] = []

        async def _execute_single(case: TestCaseItem, runner: BaseModelRunner):
            nonlocal completed_count
            async with semaphore:
                if should_cancel and should_cancel():
                    return None
                effective_system_prompt = (
                    default_params.system_prompt
                    if default_params and default_params.system_prompt
                    else case.system_prompt
                )

                # 1. Run generation or Agent loop
                primary_result: Optional[EvalResult] = None
                diagnostic_results: List[EvalResult] = []
                if case.expected_tools is not None:
                    # Agent evaluation flow
                    trajectory = await self.agent_executor.run(
                        runner=runner,
                        prompt=case.prompt,
                        system_prompt=effective_system_prompt,
                    )
                    output_text = trajectory.final_answer
                    metrics = trajectory.accumulated_metrics or MetricResult(
                        model_name=runner.model_name,
                        ttft_ms=0.0,
                        total_latency_s=0.0,
                        tokens_per_second=0.0,
                    )
                    error_msg = trajectory.error

                    # 2. Agent tool selection eval
                    agent_res = self.agent_evaluator.evaluate_tool_selection(
                        called_tools=[{"name": t} for t in trajectory.tools_called],
                        expected_tools=case.expected_tools,
                    )
                    primary_result = agent_res
                    eval_results = [agent_res]
                else:
                    # Standard prompt generation flow
                    execution_params = default_params.model_copy() if default_params else ModelParams()
                    if effective_system_prompt:
                        execution_params.system_prompt = effective_system_prompt

                    gen_res = await runner.generate(
                        messages=[{"role": "user", "content": case.prompt}],
                        params=execution_params,
                    )
                    output_text = gen_res.text
                    metrics = gen_res.metrics
                    error_msg = gen_res.error
                    eval_results = []

                # 3. Rule assertions
                if case.rule_type:
                    rule_context = case.rule_config.copy() if case.rule_config else {}
                    rule_context["rule_type"] = case.rule_type
                    rule_res = await self.rule_evaluator.evaluate(
                        output_text=output_text,
                        prompt=case.prompt,
                        ground_truth=case.ground_truth,
                        context=rule_context,
                    )
                    if primary_result is None:
                        primary_result = rule_res
                    else:
                        diagnostic_results.append(rule_res)
                    eval_results.append(rule_res)

                # 4. Additional custom evaluators
                if evaluators:
                    for ev in evaluators:
                        res = await ev.evaluate(
                            output_text=output_text,
                            prompt=case.prompt,
                            ground_truth=case.ground_truth,
                        )
                        diagnostic_results.append(res)
                        eval_results.append(res)

                if error_msg:
                    verdict = "failed"
                    passed: Optional[bool] = False
                    score: Optional[float] = None
                elif primary_result is None:
                    verdict = "unevaluated"
                    passed = None
                    score = None
                else:
                    passed = primary_result.passed
                    verdict = "passed" if passed else "failed"
                    score = primary_result.score

                case_result = BatchCaseResult(
                    case_id=case.id,
                    model_name=runner.model_name,
                    prompt=case.prompt,
                    output_text=output_text,
                    metrics=metrics,
                    eval_results=eval_results,
                    primary_evaluator=primary_result.evaluator_name if primary_result else None,
                    diagnostic_results=diagnostic_results,
                    verdict=verdict,
                    passed=passed,
                    score=score,
                    error=error_msg,
                )

                async with progress_lock:
                    completed_count += 1
                    case_results.append(case_result)
                    if on_progress:
                        await on_progress(completed_count, total_evaluations, case_result)

                return case_result

        # Schedule all tasks
        tasks = []
        for case, runner in scheduled_pairs:
            tasks.append(_execute_single(case, runner))

        await asyncio.gather(*tasks)

        # 5. Compute aggregate summaries per model
        model_summaries: Dict[str, ModelBatchSummary] = {}
        for runner in runners:
            m_name = runner.model_name
            m_cases = [r for r in case_results if r.model_name == m_name]
            total_m = len(m_cases)
            passed_m = sum(1 for r in m_cases if r.verdict == "passed")
            failed_m = sum(1 for r in m_cases if r.verdict == "failed")
            unevaluated_m = sum(1 for r in m_cases if r.verdict == "unevaluated")
            evaluated_m = passed_m + failed_m
            error_m = sum(1 for r in m_cases if r.error)
            pass_rate = (passed_m / evaluated_m) if evaluated_m > 0 else None
            scores = [r.score for r in m_cases if r.score is not None]
            avg_score = (sum(scores) / len(scores)) if scores else None
            avg_ttft = sum(r.metrics.ttft_ms for r in m_cases) / total_m if total_m > 0 else 0.0
            avg_lat = sum(r.metrics.total_latency_s for r in m_cases) / total_m if total_m > 0 else 0.0
            avg_tps = sum(r.metrics.tokens_per_second for r in m_cases) / total_m if total_m > 0 else 0.0
            known_costs = [r.metrics.estimated_cost_usd for r in m_cases if r.metrics.estimated_cost_usd is not None]
            total_cost = sum(known_costs) if len(known_costs) == len(m_cases) else None
            total_tokens = sum(r.metrics.input_tokens + r.metrics.output_tokens for r in m_cases)

            model_summaries[m_name] = ModelBatchSummary(
                model_name=m_name,
                total_cases=total_m,
                passed_cases=passed_m,
                failed_cases=failed_m,
                evaluated_cases=evaluated_m,
                unevaluated_cases=unevaluated_m,
                execution_error_cases=error_m,
                pass_rate=round(pass_rate * 100.0, 1) if pass_rate is not None else None,
                avg_score=round(avg_score * 100.0, 1) if avg_score is not None else None,
                avg_ttft_ms=round(avg_ttft, 1),
                avg_total_latency_s=round(avg_lat, 2),
                avg_tokens_per_second=round(avg_tps, 1),
                total_cost_usd=round(total_cost, 6) if total_cost is not None else None,
                total_tokens=total_tokens,
            )

        return BatchRunSummary(
            run_id=run_id,
            total_cases=len(cases),
            models=[r.model_name for r in runners],
            model_summaries=model_summaries,
            case_results=case_results,
        )
