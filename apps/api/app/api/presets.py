"""Preset catalog inspection and cloning router."""

import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.dataset import DatasetDB, TestCaseDB
from microevals_core.builtin_presets.loader import PresetSuite, find_preset, load_builtin_presets

router = APIRouter(prefix="/api/presets", tags=["presets"])


@router.get("", response_model=List[dict])
def list_presets(category: Optional[str] = None):
    suites = load_builtin_presets()
    if category and category.lower() != "all":
        suites = [
            s for s in suites
            if s.category.lower() == category.lower() or (s.category_zh and s.category_zh.lower() == category.lower())
        ]
    return [
        {
            **s.model_dump(),
            "case_count": len(s.cases),
            "cases": [c.model_dump() for c in s.cases],
        }
        for s in suites
    ]



@router.get("/{slug}", response_model=dict)
def get_preset_details(slug: str):
    suite = find_preset(slug)
    if not suite:
        raise HTTPException(status_code=404, detail="Preset not found")
    return suite.model_dump()


@router.post("/{slug}/clone")
def clone_preset_to_dataset(slug: str, db: Session = Depends(get_db)):
    suite = find_preset(slug)
    if not suite:
        raise HTTPException(status_code=404, detail="Preset not found")

    ds_id = f"ds_{uuid.uuid4().hex[:8]}"
    dataset = DatasetDB(
        id=ds_id,
        name=f"[Clone] {suite.title}",
        description=suite.description,
        created_at=int(time.time()),
        updated_at=int(time.time()),
        source_preset_id=suite.slug,
    )
    db.add(dataset)

    import json
    for c in suite.cases:
        tc = TestCaseDB(
            id=f"{ds_id}_{c.id}",
            dataset_id=ds_id,
            prompt=c.prompt,
            system_prompt=c.system_prompt,
            ground_truth=c.ground_truth,
            expected_tools_json=json.dumps(c.expected_tools or []),
            rule_type=c.rule_type,
            rule_config_json=json.dumps(c.rule_config or {}),
        )
        db.add(tc)

    db.commit()
    return {"status": "success", "dataset_id": ds_id, "title": dataset.name, "case_count": len(suite.cases)}
