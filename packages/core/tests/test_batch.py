import pytest
from microevals_core.batch.engine import BatchEngine
from microevals_core.builtin_presets.loader import TestCaseItem
from microevals_core.runner.base import BaseModelRunner, GenerationResult
from microevals_core.runner.metrics import MetricResult
from microevals_core.evaluators.base import BaseEvaluator, EvalResult

class DummyRunner(BaseModelRunner):
    def __init__(self, name: str, fixed_answer: str):
        super().__init__(name, "http://dummy", "key")
        self.fixed_answer = fixed_answer

    async def stream(self, messages, params=None):
        raise NotImplementedError

    async def generate(self, messages, params=None):
        return GenerationResult(
            text=self.fixed_answer,
            metrics=MetricResult(
                model_name=self.model_name,
                ttft_ms=100.0,
                total_latency_s=0.5,
                tokens_per_second=50.0,
                input_tokens=10,
                output_tokens=25,
            )
        )

@pytest.mark.asyncio
async def test_batch_engine_execution():
    cases = [
        TestCaseItem(
            id="c1",
            prompt="How many rs in strawberry?",
            rule_type="contains",
            rule_config={"substring": "3"}
        ),
        TestCaseItem(
            id="c2",
            prompt="What is 2+2?",
            rule_type="contains",
            rule_config={"substring": "4"}
        )
    ]

    # Model A answers "3 and 4" -> passes both
    model_a = DummyRunner("Model-A", "The answer is 3 and 4.")
    # Model B answers "Unknown" -> fails both
    model_b = DummyRunner("Model-B", "I don't know.")

    engine = BatchEngine(concurrency=2)
    progress_updates = []

    async def on_progress(completed, total, case_res):
        progress_updates.append((completed, total, case_res.case_id, case_res.model_name))

    summary = await engine.run_batch(
        cases=cases,
        runners=[model_a, model_b],
        on_progress=on_progress,
        run_id="test_run_1"
    )

    assert summary.total_cases == 2
    assert len(summary.case_results) == 4  # 2 cases * 2 models
    assert len(progress_updates) == 4

    summary_a = summary.model_summaries["Model-A"]
    assert summary_a.passed_cases == 2
    assert summary_a.pass_rate == 100.0

    summary_b = summary.model_summaries["Model-B"]
    assert summary_b.passed_cases == 0
    assert summary_b.pass_rate == 0.0


class AlwaysFailDiagnostic(BaseEvaluator):
    async def evaluate(self, output_text, prompt="", ground_truth=None, context=None):
        return EvalResult(
            evaluator_name="diagnostic",
            passed=False,
            score=0.0,
            reason="diagnostic failure",
        )


@pytest.mark.asyncio
async def test_success_without_primary_evaluator_is_unevaluated():
    summary = await BatchEngine().run_batch(
        cases=[TestCaseItem(id="c1", prompt="Say hi")],
        runners=[DummyRunner("Model-A", "hi")],
    )

    result = summary.case_results[0]
    model = summary.model_summaries["Model-A"]
    assert result.verdict == "unevaluated"
    assert result.passed is None
    assert model.evaluated_cases == 0
    assert model.unevaluated_cases == 1
    assert model.pass_rate is None
    assert model.avg_score is None


@pytest.mark.asyncio
async def test_diagnostic_evaluator_cannot_override_primary_verdict():
    summary = await BatchEngine().run_batch(
        cases=[
            TestCaseItem(
                id="c1",
                prompt="Answer",
                rule_type="contains",
                rule_config={"substring": "yes"},
            )
        ],
        runners=[DummyRunner("Model-A", "yes")],
        evaluators=[AlwaysFailDiagnostic()],
    )

    result = summary.case_results[0]
    assert result.verdict == "passed"
    assert result.passed is True
    assert result.primary_evaluator == "rule_contains"
    assert len(result.diagnostic_results) == 1


@pytest.mark.asyncio
async def test_batch_can_select_pairs_and_cancel_remaining_work():
    cases = [TestCaseItem(id="c1", prompt="one"), TestCaseItem(id="c2", prompt="two")]
    runners = [DummyRunner("Model-A", "ok"), DummyRunner("Model-B", "ok")]
    selected = await BatchEngine().run_batch(
        cases=cases,
        runners=runners,
        include_pairs={("c2", "Model-B")},
    )
    assert [(item.case_id, item.model_name) for item in selected.case_results] == [("c2", "Model-B")]

    cancelled = await BatchEngine().run_batch(
        cases=cases,
        runners=runners,
        should_cancel=lambda: True,
    )
    assert cancelled.case_results == []
