"""Built-in sandbox mock tools and function schemas for Agent evaluation."""

import ast
import operator
import re
from typing import Any, Dict, List, Optional


def safe_eval_math(expr: str) -> float:
    """Safely evaluate simple arithmetic expressions without eval/exec."""
    # Allow numbers, +, -, *, /, %, **, (, )
    allowed_operators = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.Mod: operator.mod,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
    }

    def eval_node(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        elif isinstance(node, ast.BinOp):
            left = eval_node(node.left)
            right = eval_node(node.right)
            op_type = type(node.op)
            if op_type in allowed_operators:
                return allowed_operators[op_type](left, right)
            raise ValueError(f"Unsupported operator: {op_type}")
        elif isinstance(node, ast.UnaryOp):
            operand = eval_node(node.operand)
            op_type = type(node.op)
            if op_type in allowed_operators:
                return allowed_operators[op_type](operand)
            raise ValueError(f"Unsupported unary operator: {op_type}")
        else:
            raise ValueError(f"Unsupported syntax in expression: {ast.dump(node)}")

    parsed = ast.parse(expr.strip(), mode="eval")
    return float(eval_node(parsed.body))


BUILTIN_TOOLS_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "calculator",
            "description": "Calculate mathematical expressions accurately (e.g. '15 * 24 + 100 / 2')",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "The arithmetic expression to evaluate",
                    }
                },
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather condition and temperature for a given city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name (e.g. 'Tokyo', 'San Francisco')"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"], "default": "celsius"},
                },
                "required": ["city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for up-to-date information, news, and facts",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query keywords"}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "sql_query",
            "description": "Execute a SQL query on the local database (tables: users, orders, products)",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The SQL query to execute"}
                },
                "required": ["query"],
            },
        },
    },
]


def execute_mock_tool(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a simulated mock tool and return structured output."""
    if name == "calculator":
        expression = arguments.get("expression", "0")
        try:
            result = safe_eval_math(expression)
            return {"status": "success", "result": result, "expression": expression}
        except Exception as e:
            return {"status": "error", "error": f"Calculation error: {str(e)}"}

    elif name == "get_weather":
        city = arguments.get("city", "Unknown")
        unit = arguments.get("unit", "celsius")
        # Simulated responses
        temp = 22 if unit == "celsius" else 72
        return {
            "city": city,
            "condition": "Sunny",
            "temperature": temp,
            "unit": unit,
            "humidity": "45%",
        }

    elif name == "web_search":
        query = arguments.get("query", "")
        return {
            "query": query,
            "results": [
                {
                    "title": f"Official documentation for {query}",
                    "snippet": f"Verified factual data and release notes regarding {query}.",
                    "url": f"https://example.com/search?q={query}",
                }
            ],
        }

    elif name == "sql_query":
        query = arguments.get("query", "").lower()
        if "users" in query:
            return {
                "columns": ["id", "name", "role", "active"],
                "rows": [
                    [1, "Alice", "admin", True],
                    [2, "Bob", "member", True],
                    [3, "Charlie", "guest", False],
                ],
            }
        elif "products" in query:
            return {
                "columns": ["id", "product_name", "price", "stock"],
                "rows": [
                    [101, "Wireless Mouse", 29.99, 150],
                    [102, "Mechanical Keyboard", 89.99, 45],
                    [103, "USB-C Hub", 19.99, 320],
                ],
            }
        else:
            return {
                "columns": ["id", "order_id", "total_amount"],
                "rows": [[1, "ORD-9821", 119.98]],
            }

    return {"status": "error", "error": f"Tool '{name}' is not recognized"}
