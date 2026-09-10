"""Preset loader and data models for built-in benchmarks."""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TestCaseItem(BaseModel):
    """A single evaluation prompt / test case within a suite."""
    __test__ = False
    id: str
    prompt: str
    prompt_zh: Optional[str] = None
    system_prompt: Optional[str] = None
    system_prompt_zh: Optional[str] = None
    ground_truth: Optional[str] = None
    ground_truth_zh: Optional[str] = None
    expected_tools: Optional[List[str]] = None
    rule_type: Optional[str] = None
    rule_config: Optional[Dict[str, Any]] = None


class PresetSuite(BaseModel):
    """A collection of prompts or benchmarks."""
    id: str
    title: str
    title_zh: Optional[str] = None
    slug: str
    description: str = ""
    description_zh: Optional[str] = None
    category: str = "General"  # Coding, Reasoning, SVG/Art, Simulation, Agent, Medical, etc.
    category_zh: Optional[str] = None
    vote_count: int = 0
    tags: List[str] = Field(default_factory=list)
    tags_zh: Optional[List[str]] = Field(default_factory=list)
    cases: List[TestCaseItem] = Field(default_factory=list)


def load_builtin_presets() -> List[PresetSuite]:
    """Load all Artificial Analysis presets + Agent suites from bundled JSON."""
    json_path = Path(__file__).parent / "presets.json"
    if not json_path.exists():
        return []

    with open(json_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    suites = []
    for item in raw_data:
        suites.append(PresetSuite(**item))
    return suites


def find_preset(query: str, suites: Optional[List[PresetSuite]] = None) -> Optional[PresetSuite]:
    """Find preset by slug, id, title (en/zh), or prefix match."""
    suites = suites if suites is not None else load_builtin_presets()
    query_clean = query.lower().strip()

    # 1. Exact match on slug or id
    for s in suites:
        if s.slug.lower() == query_clean or s.id.lower() == query_clean:
            return s

    # 2. Slug prefix match
    for s in suites:
        if s.slug.lower().startswith(query_clean) or query_clean in s.slug.lower():
            return s

    # 3. Title match (English or Chinese)
    for s in suites:
        if query_clean in s.title.lower():
            return s
        if s.title_zh and query_clean in s.title_zh.lower():
            return s

    return None

