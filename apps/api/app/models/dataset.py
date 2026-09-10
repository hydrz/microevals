"""Dataset and TestCase database and pydantic models."""

import json
from typing import Any, Dict, List, Optional
from sqlalchemy import Column, String, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from app.core.database import Base


class DatasetDB(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    created_at = Column(Integer, default=0)
    updated_at = Column(Integer, default=0)
    source_preset_id = Column(String, nullable=True)

    cases = relationship("TestCaseDB", back_populates="dataset", cascade="all, delete-orphan")


class TestCaseDB(Base):
    __tablename__ = "test_cases"

    id = Column(String, primary_key=True, index=True)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    prompt = Column(Text, nullable=False)
    system_prompt = Column(Text, nullable=True)
    ground_truth = Column(Text, nullable=True)
    expected_tools_json = Column(Text, default="[]")
    rule_type = Column(String, nullable=True)
    rule_config_json = Column(Text, default="{}")

    dataset = relationship("DatasetDB", back_populates="cases")


class TestCaseSchema(BaseModel):
    __test__ = False
    id: str
    prompt: str
    system_prompt: Optional[str] = None
    ground_truth: Optional[str] = None
    expected_tools: Optional[List[str]] = None
    rule_type: Optional[str] = None
    rule_config: Optional[Dict[str, Any]] = None


class DatasetSchema(BaseModel):
    id: str
    name: str
    description: str = ""
    created_at: int = 0
    updated_at: int = 0
    source_preset_id: Optional[str] = None
    case_count: int = 0
    cases: List[TestCaseSchema] = Field(default_factory=list)


class DatasetCreate(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    cases: List[TestCaseSchema] = Field(default_factory=list)


class DatasetUpdate(BaseModel):
    name: str
    description: str = ""
    cases: List[TestCaseSchema] = Field(default_factory=list)
