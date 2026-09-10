import pytest
from microevals_core.evaluators.rule import RuleEvaluator
from microevals_core.evaluators.agent import AgentEvaluator

def test_rule_evaluator_contains():
    evaluator = RuleEvaluator()
    
    # Test contains
    res1 = evaluator.evaluate_contains("The answer is 42.", substring="42")
    assert res1.passed is True
    assert res1.score == 1.0

    res2 = evaluator.evaluate_contains("The answer is 42.", substring="100")
    assert res2.passed is False
    assert res2.score == 0.0

def test_rule_evaluator_regex():
    evaluator = RuleEvaluator()
    # Match email
    res = evaluator.evaluate_regex("Contact us at test@example.com for help", pattern=r"[\w\.-]+@[\w\.-]+\.\w+")
    assert res.passed is True
    assert res.score == 1.0

def test_rule_evaluator_json_schema():
    evaluator = RuleEvaluator()
    schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "number"}
        },
        "required": ["name", "age"]
    }

    valid_json = '{"name": "Alice", "age": 30}'
    res_valid = evaluator.evaluate_json_schema(valid_json, schema=schema)
    assert res_valid.passed is True

    invalid_json = '{"name": "Alice"}'
    res_invalid = evaluator.evaluate_json_schema(invalid_json, schema=schema)
    assert res_invalid.passed is False

def test_agent_evaluator_tool_selection():
    evaluator = AgentEvaluator()
    
    # Expected tool called
    called_tools = [{"id": "call_1", "name": "calculator", "arguments": '{"expression": "2+2"}'}]
    res = evaluator.evaluate_tool_selection(called_tools, expected_tools=["calculator"])
    assert res.passed is True
    assert res.score == 1.0

    # Unexpected/missing tool
    res_missing = evaluator.evaluate_tool_selection(called_tools, expected_tools=["web_search"])
    assert res_missing.passed is False
    assert res_missing.score == 0.0

def test_agent_evaluator_argument_schema():
    evaluator = AgentEvaluator()
    calc_schema = {
        "type": "object",
        "properties": {
            "expression": {"type": "string"}
        },
        "required": ["expression"]
    }
    
    res = evaluator.evaluate_argument_schema(
        tool_name="calculator",
        arguments_json='{"expression": "12 * 8"}',
        schema=calc_schema
    )
    assert res.passed is True

    res_bad = evaluator.evaluate_argument_schema(
        tool_name="calculator",
        arguments_json='{"wrong_key": 12}',
        schema=calc_schema
    )
    assert res_bad.passed is False
