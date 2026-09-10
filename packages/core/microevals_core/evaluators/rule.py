"""Deterministic rule-based evaluators (Regex, Contains, ExactMatch, JSONSchema, Range)."""

import json
import re
from typing import Any, Dict, Optional
from microevals_core.evaluators.base import BaseEvaluator, EvalResult


class RuleEvaluator(BaseEvaluator):
    """Executes deterministic assertion checks on LLM responses."""

    def __init__(self, default_rule: str = "contains"):
        self.default_rule = default_rule

    async def evaluate(
        self,
        output_text: str,
        prompt: str = "",
        ground_truth: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> EvalResult:
        context = context or {}
        rule_type = context.get("rule_type", self.default_rule)

        if rule_type == "contains":
            target = context.get("substring", ground_truth or "")
            case_sensitive = context.get("case_sensitive", False)
            return self.evaluate_contains(output_text, target, case_sensitive)
        elif rule_type == "regex":
            pattern = context.get("pattern", ground_truth or "")
            return self.evaluate_regex(output_text, pattern)
        elif rule_type == "json_schema":
            schema = context.get("schema", {})
            return self.evaluate_json_schema(output_text, schema)
        elif rule_type == "exact_match":
            target = ground_truth or context.get("expected", "")
            return self.evaluate_exact_match(output_text, target)
        elif rule_type == "numeric_range":
            return self.evaluate_numeric_range(
                output_text,
                min_val=context.get("min_val"),
                max_val=context.get("max_val"),
            )
        else:
            return EvalResult(
                evaluator_name="rule",
                passed=False,
                score=0.0,
                reason=f"Unknown rule type: {rule_type}",
            )

    def evaluate_contains(
        self,
        output_text: str,
        substring: str,
        case_sensitive: bool = False,
    ) -> EvalResult:
        """Check if output contains required substring."""
        if not substring:
            return EvalResult(
                evaluator_name="rule_contains",
                passed=True,
                score=1.0,
                reason="Empty substring pattern matches everything",
            )

        text_to_search = output_text if case_sensitive else output_text.lower()
        sub_to_find = substring if case_sensitive else substring.lower()

        passed = sub_to_find in text_to_search
        return EvalResult(
            evaluator_name="rule_contains",
            passed=passed,
            score=1.0 if passed else 0.0,
            reason=f"Substring '{substring}' {'found' if passed else 'not found'} in output",
        )

    def evaluate_regex(self, output_text: str, pattern: str) -> EvalResult:
        """Check if output matches regular expression."""
        try:
            match = re.search(pattern, output_text, re.MULTILINE | re.DOTALL)
            passed = match is not None
            matched_str = match.group(0) if match else None
            return EvalResult(
                evaluator_name="rule_regex",
                passed=passed,
                score=1.0 if passed else 0.0,
                reason=f"Regex pattern '{pattern}' {'matched' if passed else 'failed to match'}",
                details={"matched": matched_str},
            )
        except re.error as e:
            return EvalResult(
                evaluator_name="rule_regex",
                passed=False,
                score=0.0,
                reason=f"Invalid regex pattern: {str(e)}",
            )

    def evaluate_exact_match(
        self,
        output_text: str,
        expected: str,
        strip_whitespace: bool = True,
    ) -> EvalResult:
        """Strict equality test."""
        actual = output_text.strip() if strip_whitespace else output_text
        target = expected.strip() if strip_whitespace else expected
        passed = actual == target
        return EvalResult(
            evaluator_name="rule_exact_match",
            passed=passed,
            score=1.0 if passed else 0.0,
            reason="Output exactly matches target" if passed else "Output differs from target",
        )

    def evaluate_json_schema(self, output_text: str, schema: Dict[str, Any]) -> EvalResult:
        """Extract JSON from output (including markdown code blocks) and validate against schema."""
        # Clean markdown code blocks if wrapped
        cleaned = output_text.strip()
        json_match = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", cleaned, re.DOTALL)
        if json_match:
            cleaned = json_match.group(1)
        elif "{" in cleaned:
            # Try to slice from first { to last }
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                cleaned = cleaned[start : end + 1]

        try:
            parsed_data = json.loads(cleaned)
        except Exception as e:
            return EvalResult(
                evaluator_name="rule_json_schema",
                passed=False,
                score=0.0,
                reason=f"Failed to parse JSON: {str(e)}",
            )

        # Basic JSON Schema type and required fields validation
        is_valid, error_reason = self._check_schema(parsed_data, schema)
        return EvalResult(
            evaluator_name="rule_json_schema",
            passed=is_valid,
            score=1.0 if is_valid else 0.0,
            reason="JSON schema validation passed" if is_valid else error_reason,
            details={"parsed_json": parsed_data},
        )

    def evaluate_numeric_range(
        self,
        output_text: str,
        min_val: Optional[float] = None,
        max_val: Optional[float] = None,
    ) -> EvalResult:
        """Extract numbers from text and check if any fall within range."""
        numbers = [float(n) for n in re.findall(r"[-+]?\d*\.\d+|\d+", output_text)]
        if not numbers:
            return EvalResult(
                evaluator_name="rule_numeric_range",
                passed=False,
                score=0.0,
                reason="No numeric values detected in output",
            )

        valid_nums = []
        for n in numbers:
            if min_val is not None and n < min_val:
                continue
            if max_val is not None and n > max_val:
                continue
            valid_nums.append(n)

        passed = len(valid_nums) > 0
        return EvalResult(
            evaluator_name="rule_numeric_range",
            passed=passed,
            score=1.0 if passed else 0.0,
            reason=f"Found {len(valid_nums)} numbers in [{min_val}, {max_val}] range: {valid_nums}"
            if passed
            else f"Extracted numbers {numbers} outside bounds [{min_val}, {max_val}]",
            details={"all_numbers": numbers, "in_range": valid_nums},
        )

    def _check_schema(self, data: Any, schema: Dict[str, Any]) -> tuple[bool, str]:
        """Lightweight JSON Schema validator for common types and required properties."""
        expected_type = schema.get("type")
        if expected_type:
            type_map = {
                "object": dict,
                "array": list,
                "string": str,
                "number": (int, float),
                "integer": int,
                "boolean": bool,
            }
            py_type = type_map.get(expected_type)
            if py_type and not isinstance(data, py_type):
                return False, f"Expected type '{expected_type}', got '{type(data).__name__}'"

        if isinstance(data, dict):
            required = schema.get("required", [])
            for req in required:
                if req not in data:
                    return False, f"Missing required property '{req}'"

            properties = schema.get("properties", {})
            for key, prop_schema in properties.items():
                if key in data:
                    valid, err = self._check_schema(data[key], prop_schema)
                    if not valid:
                        return False, f"Property '{key}': {err}"

        return True, ""
