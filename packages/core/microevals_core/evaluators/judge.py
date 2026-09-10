"""LLM-as-a-Judge evaluator supporting rubrics and structured scoring."""

import json
import re
from typing import Any, Dict, Optional
from microevals_core.evaluators.base import BaseEvaluator, EvalResult
from microevals_core.runner.base import BaseModelRunner


JUDGE_SYSTEM_PROMPT = """You are an impartial, expert evaluation judge. Your task is to evaluate the quality of an AI model's response based on the original user prompt and specific grading criteria.

You MUST respond strictly with a valid JSON object in the following format:
{
  "score": <number from 1 to 5>,
  "passed": <boolean, true if score >= 3>,
  "criteria_breakdown": {
    "instruction_following": <1-5>,
    "accuracy": <1-5>,
    "clarity": <1-5>
  },
  "rationale": "<concise explanation of strengths and weaknesses>"
}
"""


class JudgeEvaluator(BaseEvaluator):
    """Evaluates output using an independent LLM judge model."""

    def __init__(self, judge_runner: Optional[BaseModelRunner] = None):
        self.judge_runner = judge_runner

    async def evaluate(
        self,
        output_text: str,
        prompt: str = "",
        ground_truth: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> EvalResult:
        context = context or {}
        runner = context.get("judge_runner") or self.judge_runner
        if not runner:
            return EvalResult(
                evaluator_name="llm_judge",
                passed=False,
                score=0.0,
                reason="No judge model runner configured",
            )

        rubric = context.get(
            "rubric",
            "Evaluate whether the response accurately and fully satisfies the prompt.",
        )

        user_content = f"""[USER PROMPT]
{prompt}

[GROUND TRUTH REFERENCE (Optional)]
{ground_truth or "None provided"}

[EVALUATION RUBRIC / CRITERIA]
{rubric}

[AI MODEL CANDIDATE RESPONSE TO EVALUATE]
{output_text}

Please provide your judgment in JSON format.
"""

        messages = [
            {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

        try:
            gen_result = await runner.generate(messages)
            raw_response = gen_result.text.strip()

            # Parse JSON from response
            cleaned = raw_response
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                cleaned = match.group(0)

            data = json.loads(cleaned)
            score_5 = float(data.get("score", 3.0))
            # Normalize 1-5 to 0.0-1.0
            normalized_score = max(0.0, min(1.0, (score_5 - 1.0) / 4.0))
            passed = bool(data.get("passed", score_5 >= 3.0))
            rationale = data.get("rationale", "")
            breakdown = data.get("criteria_breakdown", {})

            return EvalResult(
                evaluator_name="llm_judge",
                passed=passed,
                score=round(normalized_score, 2),
                reason=rationale or f"Judge awarded {score_5}/5 score",
                details={
                    "raw_score_1_to_5": score_5,
                    "criteria_breakdown": breakdown,
                    "judge_model": runner.model_name,
                },
            )
        except Exception as e:
            return EvalResult(
                evaluator_name="llm_judge",
                passed=False,
                score=0.0,
                reason=f"Judge model evaluation failed: {str(e)}",
            )
