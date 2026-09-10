"""Base definitions and result types for evaluators."""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class EvalResult(BaseModel):
    """Normalized evaluation output."""
    evaluator_name: str
    passed: bool
    score: float = Field(ge=0.0, le=1.0, description="Normalized score between 0.0 and 1.0")
    reason: str = ""
    details: Dict[str, Any] = Field(default_factory=dict)


class BaseEvaluator(ABC):
    """Abstract base class for all evaluators."""

    @abstractmethod
    async def evaluate(
        self,
        output_text: str,
        prompt: str = "",
        ground_truth: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> EvalResult:
        """Run evaluation and return structured EvalResult."""
        pass
