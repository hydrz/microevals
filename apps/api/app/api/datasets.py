"""Dataset and TestCase management router."""

import csv
import io
import json
import time
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.dataset import DatasetCreate, DatasetDB, DatasetSchema, DatasetUpdate, TestCaseDB, TestCaseSchema

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _case_schema(case: TestCaseDB) -> TestCaseSchema:
    return TestCaseSchema(
        id=case.id,
        prompt=case.prompt,
        system_prompt=case.system_prompt,
        ground_truth=case.ground_truth,
        expected_tools=json.loads(case.expected_tools_json or "[]"),
        rule_type=case.rule_type,
        rule_config=json.loads(case.rule_config_json or "{}"),
    )


def _dataset_schema(dataset: DatasetDB, include_cases: bool = True) -> DatasetSchema:
    cases = [_case_schema(case) for case in dataset.cases] if include_cases else []
    return DatasetSchema(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description or "",
        created_at=dataset.created_at or 0,
        updated_at=dataset.updated_at or dataset.created_at or 0,
        source_preset_id=dataset.source_preset_id,
        case_count=len(dataset.cases),
        cases=cases,
    )


def _replace_cases(db: Session, dataset: DatasetDB, cases: List[TestCaseSchema]) -> None:
    dataset.cases.clear()
    db.flush()
    for case in cases:
        raw_id = case.id if case.id and not case.id.startswith("new") else uuid.uuid4().hex[:8]
        case_id = raw_id if raw_id.startswith(f"{dataset.id}_") else f"{dataset.id}_{raw_id}"
        dataset.cases.append(TestCaseDB(
            id=case_id,
            prompt=case.prompt,
            system_prompt=case.system_prompt,
            ground_truth=case.ground_truth,
            expected_tools_json=json.dumps(case.expected_tools or []),
            rule_type=case.rule_type,
            rule_config_json=json.dumps(case.rule_config or {}),
        ))


@router.get("", response_model=List[DatasetSchema])
def list_datasets(db: Session = Depends(get_db)):
    datasets = db.query(DatasetDB).order_by(DatasetDB.created_at.desc()).all()
    results = []
    for d in datasets:
        results.append(_dataset_schema(d, include_cases=False))
    return results


@router.post("", response_model=DatasetSchema)
def create_dataset(data: DatasetCreate, db: Session = Depends(get_db)):
    ds_id = data.id or f"ds_{uuid.uuid4().hex[:8]}"
    now = int(time.time())
    ds = DatasetDB(
        id=ds_id,
        name=data.name,
        description=data.description,
        created_at=now,
        updated_at=now,
    )
    db.add(ds)

    added_cases: List[TestCaseSchema] = []
    for c in data.cases:
        raw_id = c.id if (c.id and not c.id.startswith("new")) else uuid.uuid4().hex[:8]
        tc_id = raw_id if raw_id.startswith(f"{ds_id}_") else f"{ds_id}_{raw_id}"
        tc = TestCaseDB(
            id=tc_id,
            dataset_id=ds_id,
            prompt=c.prompt,
            system_prompt=c.system_prompt,
            ground_truth=c.ground_truth,
            expected_tools_json=json.dumps(c.expected_tools or []),
            rule_type=c.rule_type,
            rule_config_json=json.dumps(c.rule_config or {}),
        )
        db.add(tc)
        added_cases.append(
            TestCaseSchema(
                id=tc_id,
                prompt=c.prompt,
                system_prompt=c.system_prompt,
                ground_truth=c.ground_truth,
                expected_tools=c.expected_tools,
                rule_type=c.rule_type,
                rule_config=c.rule_config,
            )
        )

    db.commit()
    db.refresh(ds)

    return _dataset_schema(ds)


@router.get("/{dataset_id}", response_model=DatasetSchema)
def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    ds = db.query(DatasetDB).filter(DatasetDB.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return _dataset_schema(ds)


@router.put("/{dataset_id}", response_model=DatasetSchema)
def update_dataset(dataset_id: str, data: DatasetUpdate, db: Session = Depends(get_db)):
    dataset = db.query(DatasetDB).filter(DatasetDB.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    dataset.name = data.name
    dataset.description = data.description
    dataset.updated_at = int(time.time())
    _replace_cases(db, dataset, data.cases)
    db.commit()
    db.refresh(dataset)
    return _dataset_schema(dataset)


@router.get("/{dataset_id}/export")
def export_dataset(dataset_id: str, format: str = "jsonl", db: Session = Depends(get_db)):
    dataset = db.query(DatasetDB).filter(DatasetDB.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    rows = [case.model_dump() for case in _dataset_schema(dataset).cases]
    if format == "jsonl":
        body = "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n"
        media_type = "application/x-ndjson"
    elif format == "csv":
        output = io.StringIO()
        fields = ["id", "prompt", "system_prompt", "ground_truth", "expected_tools", "rule_type", "rule_config"]
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            row["expected_tools"] = json.dumps(row.get("expected_tools") or [], ensure_ascii=False)
            row["rule_config"] = json.dumps(row.get("rule_config") or {}, ensure_ascii=False)
            writer.writerow(row)
        body = output.getvalue()
        media_type = "text/csv"
    else:
        raise HTTPException(status_code=400, detail="format must be csv or jsonl")
    headers = {"Content-Disposition": f'attachment; filename="{dataset.id}.{format}"'}
    return Response(content=body, media_type=media_type, headers=headers)


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    ds = db.query(DatasetDB).filter(DatasetDB.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    db.delete(ds)
    db.commit()
    return {"status": "success", "id": dataset_id}


@router.post("/import_file")
async def import_dataset_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload CSV or JSONL to create a new dataset."""
    filename = file.filename or "uploaded_dataset"
    content_bytes = await file.read()
    content_str = content_bytes.decode("utf-8", errors="replace")

    cases_to_add = []
    if filename.endswith(".jsonl"):
        for line in content_str.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            item = json.loads(line)
            cases_to_add.append({
                "prompt": item.get("prompt") or item.get("input") or str(item),
                "system_prompt": item.get("system_prompt"),
                "ground_truth": item.get("ground_truth") or item.get("reference") or item.get("target"),
                "expected_tools": item.get("expected_tools") or [],
                "rule_type": item.get("rule_type"),
                "rule_config": item.get("rule_config") or {},
            })
    else:
        # Default CSV
        reader = csv.DictReader(io.StringIO(content_str))
        for row in reader:
            prompt = row.get("prompt") or row.get("input") or row.get("question") or list(row.values())[0]
            cases_to_add.append({
                "prompt": prompt,
                "system_prompt": row.get("system_prompt"),
                "ground_truth": row.get("ground_truth") or row.get("target") or row.get("answer"),
                "expected_tools": json.loads(row.get("expected_tools") or "[]"),
                "rule_type": row.get("rule_type") or None,
                "rule_config": json.loads(row.get("rule_config") or "{}"),
            })

    ds_name = filename.rsplit(".", 1)[0]
    data = DatasetCreate(
        name=f"Imported - {ds_name}",
        description=f"Imported from {filename} with {len(cases_to_add)} test cases",
        cases=[
            TestCaseSchema(
                id=f"tc_{i+1}",
                prompt=c["prompt"],
                system_prompt=c.get("system_prompt"),
                ground_truth=c.get("ground_truth"),
                expected_tools=c.get("expected_tools"),
                rule_type=c.get("rule_type"),
                rule_config=c.get("rule_config"),
            )
            for i, c in enumerate(cases_to_add)
        ],
    )
    return create_dataset(data, db)
