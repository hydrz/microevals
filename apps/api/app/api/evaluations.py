"""Batch evaluation execution and reports router."""

import asyncio
import json
import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.models.dataset import DatasetDB, TestCaseDB
from app.models.eval_run import EvalRunCreateRequest, EvalRunDB, EvalSource
from app.models.provider import ProviderDB, resolve_provider_api_key
from microevals_core.batch.engine import BatchEngine
from microevals_core.builtin_presets.loader import TestCaseItem
from microevals_core.builtin_presets.loader import find_preset
from microevals_core.runner.openai_runner import OpenAICompatibleRunner

router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])

# In-memory progress event queues for active runs: run_id -> asyncio.Queue
active_run_queues: Dict[str, asyncio.Queue] = {}
cancel_requested: set[str] = set()


def _resolve_source(db: Session, source: EvalSource) -> tuple[str, List[TestCaseItem]]:
    if source.type == "preset":
        preset = find_preset(source.id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset benchmark not found")
        return preset.title, list(preset.cases)
    dataset = db.query(DatasetDB).filter(DatasetDB.id == source.id).first()
    if not dataset or not dataset.cases:
        raise HTTPException(status_code=404, detail="Evaluation dataset not found or empty")
    cases = [
        TestCaseItem(
            id=case.id,
            prompt=case.prompt,
            system_prompt=case.system_prompt,
            ground_truth=case.ground_truth,
            expected_tools=json.loads(case.expected_tools_json or "[]") or None,
            rule_type=case.rule_type,
            rule_config=json.loads(case.rule_config_json or "{}"),
        )
        for case in dataset.cases
    ]
    return dataset.name, cases


async def _run_batch_job(run_id: str, req: EvalRunCreateRequest):
    db = SessionLocal()
    queue = active_run_queues.get(run_id)

    try:
        run_record = db.query(EvalRunDB).filter(EvalRunDB.id == run_id).first()
        if not run_record:
            if queue:
                await queue.put({"event": "error", "data": {"error": "Evaluation run not found"}})
            return
        cases = [TestCaseItem(**item) for item in json.loads(run_record.source_snapshot_json or "[]")]

        from microevals_core.runner.base import ModelParams

        runners = []
        for m in req.models:
            prov_id = m.get("provider_id")
            model_name = m.get("model_name", "deepseek-chat")
            prov = db.query(ProviderDB).filter(ProviderDB.id == prov_id).first()
            base_url = prov.base_url if prov else "https://api.openai.com/v1"
            api_key = resolve_provider_api_key(prov) if prov else ""
            extra_headers = json.loads(getattr(prov, "custom_headers_json", "{}") or "{}") if prov else {}
            pricing_map = json.loads(getattr(prov, "model_pricing_json", "{}") or "{}") if prov else {}
            model_price = pricing_map.get(model_name)
            price_override = (
                (float(model_price["input"]), float(model_price["output"]))
                if model_price and "input" in model_price and "output" in model_price
                else None
            )
            timeout_val = float(req.timeout) if req.timeout is not None else float(getattr(prov, "timeout_seconds", 60.0) or 60.0)
            runners.append(
                OpenAICompatibleRunner(
                    model_name=model_name,
                    base_url=base_url,
                    api_key=api_key,
                    timeout=timeout_val,
                    extra_headers=extra_headers,
                    price_override=price_override,
                )
            )

        engine = BatchEngine(concurrency=req.concurrency)
        batch_params = ModelParams(
            temperature=req.temperature if req.temperature is not None else 0.7,
            max_tokens=req.max_tokens,
            top_p=req.top_p if req.top_p is not None else 1.0,
            system_prompt=req.system_prompt,
            timeout=req.timeout,
        )

        async def on_progress(completed: int, total: int, case_res):
            current = db.query(EvalRunDB).filter(EvalRunDB.id == run_id).first()
            if current:
                persisted = json.loads(current.results_json or "[]")
                persisted.append(case_res.model_dump())
                current.results_json = json.dumps(persisted, ensure_ascii=False)
                current.completed_cases = completed
                db.commit()
            if queue:
                await queue.put({
                    "event": "progress",
                    "data": {
                        "completed": completed,
                        "total": total,
                        "case_id": case_res.case_id,
                        "model_name": case_res.model_name,
                        "passed": case_res.passed,
                    },
                })

        summary = await engine.run_batch(
            cases=cases,
            runners=runners,
            default_params=batch_params,
            on_progress=on_progress,
            run_id=run_id,
            should_cancel=lambda: run_id in cancel_requested,
            include_pairs={
                (pair["case_id"], pair["model_name"])
                for pair in (req.retry_pairs or [])
            } or None,
        )

        # Update DB record
        run_record = db.query(EvalRunDB).filter(EvalRunDB.id == run_id).first()
        if run_record:
            was_cancelled = run_id in cancel_requested
            run_record.status = (
                "partial" if was_cancelled and run_record.completed_cases > 0
                else "cancelled" if was_cancelled
                else "completed"
            )
            if not was_cancelled:
                run_record.completed_cases = run_record.total_cases
            else:
                run_record.termination_reason = "Cancelled by user"
            run_record.finished_at = int(time.time())
            run_record.summary_json = json.dumps(
                {k: v.model_dump() for k, v in summary.model_summaries.items()}, ensure_ascii=False
            )
            db.commit()

        if queue:
            await queue.put({
                "event": "completed",
                "data": {
                    "run_id": run_id,
                    "model_summaries": {k: v.model_dump() for k, v in summary.model_summaries.items()},
                    "status": run_record.status if run_record else "completed",
                },
            })

    except Exception as e:
        run_record = db.query(EvalRunDB).filter(EvalRunDB.id == run_id).first()
        if run_record:
            run_record.status = "failed"
            run_record.finished_at = int(time.time())
            run_record.termination_reason = str(e)
            db.commit()
        if queue:
            await queue.put({"event": "error", "data": {"error": str(e)}})
    finally:
        cancel_requested.discard(run_id)
        db.close()


@router.post("/run")
def start_batch_evaluation(
    req: EvalRunCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    source = req.source
    source_title, cases = _resolve_source(db, source)

    run_id = f"run_{uuid.uuid4().hex[:8]}"
    eval_run = EvalRunDB(
        id=run_id,
        dataset_id=source.id if source.type == "dataset" else "",
        source_type=source.type,
        source_id=source.id,
        source_title=source_title,
        source_snapshot_json=json.dumps([case.model_dump() for case in cases], ensure_ascii=False),
        config_json=req.model_dump_json(),
        status="running",
        created_at=int(time.time()),
        started_at=int(time.time()),
        total_cases=len(cases) * len(req.models),
        completed_cases=0,
        models_json=json.dumps(req.models),
    )
    db.add(eval_run)
    db.commit()

    active_run_queues[run_id] = asyncio.Queue()
    background_tasks.add_task(_run_batch_job, run_id, req)

    return {"status": "started", "run_id": run_id, "total_evaluations": eval_run.total_cases}


@router.post("/{run_id}/cancel")
def cancel_evaluation_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(EvalRunDB).filter(EvalRunDB.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    if run.status != "running":
        raise HTTPException(status_code=409, detail="Only running evaluations can be cancelled")
    cancel_requested.add(run_id)
    return {"status": "cancelling", "run_id": run_id}


@router.post("/{run_id}/retry")
def retry_failed_pairs(
    run_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    original = db.query(EvalRunDB).filter(EvalRunDB.id == run_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    failed_pairs = [
        {"case_id": result["case_id"], "model_name": result["model_name"]}
        for result in json.loads(original.results_json or "[]")
        if result.get("verdict") == "failed" or result.get("error")
    ]
    if not failed_pairs:
        raise HTTPException(status_code=409, detail="Run has no failed pairs to retry")
    config = json.loads(original.config_json or "{}")
    config["retry_pairs"] = failed_pairs
    request = EvalRunCreateRequest(**config)
    retry_id = f"run_{uuid.uuid4().hex[:8]}"
    retry_run = EvalRunDB(
        id=retry_id,
        dataset_id=original.dataset_id,
        source_type=original.source_type,
        source_id=original.source_id,
        source_title=original.source_title,
        source_snapshot_json=original.source_snapshot_json,
        config_json=request.model_dump_json(),
        status="running",
        created_at=int(time.time()),
        started_at=int(time.time()),
        total_cases=len(failed_pairs),
        completed_cases=0,
        models_json=original.models_json,
        retry_of_run_id=original.id,
    )
    db.add(retry_run)
    db.commit()
    active_run_queues[retry_id] = asyncio.Queue()
    background_tasks.add_task(_run_batch_job, retry_id, request)
    return {"status": "started", "run_id": retry_id, "total_evaluations": len(failed_pairs)}


@router.post("/{run_id}/rerun")
def rerun_with_same_configuration(
    run_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    original = db.query(EvalRunDB).filter(EvalRunDB.id == run_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    config = json.loads(original.config_json or "{}")
    config["retry_pairs"] = None
    request = EvalRunCreateRequest(**config)
    cases = json.loads(original.source_snapshot_json or "[]")
    rerun_id = f"run_{uuid.uuid4().hex[:8]}"
    total = len(cases) * len(request.models)
    rerun = EvalRunDB(
        id=rerun_id,
        dataset_id=original.dataset_id,
        source_type=original.source_type,
        source_id=original.source_id,
        source_title=original.source_title,
        source_snapshot_json=original.source_snapshot_json,
        config_json=request.model_dump_json(),
        status="running",
        created_at=int(time.time()),
        started_at=int(time.time()),
        total_cases=total,
        completed_cases=0,
        models_json=original.models_json,
    )
    db.add(rerun)
    db.commit()
    active_run_queues[rerun_id] = asyncio.Queue()
    background_tasks.add_task(_run_batch_job, rerun_id, request)
    return {"status": "started", "run_id": rerun_id, "total_evaluations": total}


@router.get("")
def list_evaluation_runs(
    status: Optional[str] = None,
    source_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all past evaluation runs ordered by created_at desc."""
    query = db.query(EvalRunDB)
    if status:
        query = query.filter(EvalRunDB.status == status)
    if source_type:
        query = query.filter(EvalRunDB.source_type == source_type)
    if search:
        query = query.filter(EvalRunDB.source_title.ilike(f"%{search}%"))
    runs = query.order_by(EvalRunDB.created_at.desc()).all()
    result = []
    for r in runs:
        result.append({
            "id": r.id,
            "dataset_id": r.dataset_id,
            "source_type": r.source_type or "dataset",
            "source_id": r.source_id or r.dataset_id,
            "source_title": r.source_title or r.dataset_id,
            "status": r.status,
            "created_at": r.created_at,
            "total_cases": r.total_cases,
            "completed_cases": r.completed_cases,
            "models": json.loads(r.models_json or "[]"),
            "model_summaries": json.loads(r.summary_json or "{}"),
            "termination_reason": r.termination_reason,
            "retry_of_run_id": r.retry_of_run_id,
        })
    return result


@router.get("/{run_id}")
def get_evaluation_report(run_id: str, db: Session = Depends(get_db)):
    run_record = db.query(EvalRunDB).filter(EvalRunDB.id == run_id).first()
    if not run_record:
        raise HTTPException(status_code=404, detail="Evaluation run not found")

    return {
        "id": run_record.id,
        "dataset_id": run_record.dataset_id,
        "source_type": run_record.source_type or "dataset",
        "source_id": run_record.source_id or run_record.dataset_id,
        "source_title": run_record.source_title or run_record.dataset_id,
        "source_snapshot": json.loads(run_record.source_snapshot_json or "[]"),
        "configuration": json.loads(run_record.config_json or "{}"),
        "status": run_record.status,
        "created_at": run_record.created_at,
        "total_cases": run_record.total_cases,
        "completed_cases": run_record.completed_cases,
        "models": json.loads(run_record.models_json or "[]"),
        "model_summaries": json.loads(run_record.summary_json or "{}"),
        "case_results": json.loads(run_record.results_json or "[]"),
        "termination_reason": run_record.termination_reason,
        "retry_of_run_id": run_record.retry_of_run_id,
    }


@router.get("/{run_id}/progress")
async def stream_run_progress(run_id: str, db: Session = Depends(get_db)):
    """SSE endpoint to stream real-time batch evaluation progress."""
    run_record = db.query(EvalRunDB).filter(EvalRunDB.id == run_id).first()
    if not run_record:
        raise HTTPException(status_code=404, detail="Run not found")

    queue = active_run_queues.get(run_id)

    async def event_generator():
        # If already completed or failed, emit immediately
        if run_record.status in ["completed", "failed", "partial", "cancelled"] or queue is None:
            yield f"event: {run_record.status}\ndata: {json.dumps({'run_id': run_id})}\n\n"
            return

        while True:
            item = await queue.get()
            event_name = item["event"]
            data_json = json.dumps(item["data"], ensure_ascii=False)
            yield f"event: {event_name}\ndata: {data_json}\n\n"

            if event_name in ["completed", "error"]:
                active_run_queues.pop(run_id, None)
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")
