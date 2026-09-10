"""Evaluation Run database and pydantic models."""

import json
from typing import Any, Dict, List, Literal, Optional
from sqlalchemy import Column, String, Text, Integer, Float
from pydantic import BaseModel, Field
from app.core.database import Base


class EvalRunDB(Base):
    __tablename__ = "eval_runs"

    id = Column(String, primary_key=True, index=True)
    dataset_id = Column(String, nullable=False)
    status = Column(String, default="running")  # running, completed, failed
    created_at = Column(Integer, default=0)
    total_cases = Column(Integer, default=0)
    completed_cases = Column(Integer, default=0)
    models_json = Column(Text, default="[]")
    summary_json = Column(Text, default="{}")
    results_json = Column(Text, default="[]")
    source_type = Column(String, nullable=True)
    source_id = Column(String, nullable=True)
    source_title = Column(String, default="")
    source_snapshot_json = Column(Text, default="[]")
    config_json = Column(Text, default="{}")
    started_at = Column(Integer, default=0)
    finished_at = Column(Integer, nullable=True)
    termination_reason = Column(Text, nullable=True)
    retry_of_run_id = Column(String, nullable=True)


class EvalSource(BaseModel):
    type: Literal["dataset", "preset"]
    id: str


class EvalRunCreateRequest(BaseModel):
    source: EvalSource
    models: List[Dict[str, Any]]  # [{provider_id, model_name, params}]
    concurrency: int = Field(default=3, ge=1, le=20)
    temperature: Optional[float] = Field(default=None, ge=0, le=2)
    max_tokens: Optional[int] = Field(default=None, ge=1)
    top_p: Optional[float] = Field(default=None, ge=0, le=1)
    timeout: Optional[float] = Field(default=None, gt=0, le=600)
    system_prompt: Optional[str] = None
    retry_pairs: Optional[List[Dict[str, str]]] = None
