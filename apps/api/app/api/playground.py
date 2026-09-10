"""Playground multi-model concurrent streaming SSE router."""

import asyncio
import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.provider import ProviderDB
from microevals_core.agent_sandbox.tools import BUILTIN_TOOLS_DEFINITIONS
from microevals_core.runner.base import ModelParams
from microevals_core.runner.openai_runner import OpenAICompatibleRunner

router = APIRouter(prefix="/api/playground", tags=["playground"])


class ModelConfig(BaseModel):
    provider_id: str
    model_name: str
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    top_p: float = 1.0
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    stop: Optional[List[str]] = None
    seed: Optional[int] = None
    custom_system_prompt: Optional[str] = None


class StreamRequest(BaseModel):
    models: List[ModelConfig]
    messages: List[Dict[str, Any]]
    system_prompt: Optional[str] = None
    enable_tools: bool = False
    tools: Optional[List[Dict[str, Any]]] = None


@router.post("/stream")
async def stream_playground(req: StreamRequest, db: Session = Depends(get_db)):
    """Multiplexes parallel streaming responses across 2-4 models using Server-Sent Events."""

    # 1. Resolve providers from DB
    runners = []
    for m in req.models:
        prov = db.query(ProviderDB).filter(ProviderDB.id == m.provider_id).first()
        base_url = prov.base_url if prov else "https://api.openai.com/v1"
        api_key = prov.api_key if prov else ""
        extra_headers = json.loads(getattr(prov, "custom_headers_json", "{}") or "{}") if prov else {}
        timeout_val = float(getattr(prov, "timeout_seconds", 60.0) or 60.0) if prov else 60.0
        runners.append(
            OpenAICompatibleRunner(
                model_name=m.model_name,
                base_url=base_url,
                api_key=api_key,
                timeout=timeout_val,
                extra_headers=extra_headers,
            )
        )

    queue = asyncio.Queue()
    tools_to_pass = (req.tools or BUILTIN_TOOLS_DEFINITIONS) if req.enable_tools else None

    async def _stream_single_model(idx: int, runner: OpenAICompatibleRunner, cfg: ModelConfig):
        effective_sys = cfg.custom_system_prompt if cfg.custom_system_prompt is not None else req.system_prompt
        params = ModelParams(
            temperature=cfg.temperature,
            max_tokens=cfg.max_tokens,
            top_p=cfg.top_p,
            frequency_penalty=cfg.frequency_penalty,
            presence_penalty=cfg.presence_penalty,
            stop=cfg.stop,
            seed=cfg.seed,
            system_prompt=effective_sys,
            tools=tools_to_pass,
        )
        try:
            async for chunk in runner.stream(req.messages, params=params):
                if chunk.error:
                    await queue.put({"event": "error", "data": {"model_index": idx, "error": chunk.error}})
                elif chunk.tool_calls:
                    await queue.put({
                        "event": "tool_call",
                        "data": {
                            "model_index": idx,
                            "tool_calls": [tc.model_dump() for tc in chunk.tool_calls],
                        },
                    })
                elif chunk.delta:
                    await queue.put({
                        "event": "chunk",
                        "data": {
                            "model_index": idx,
                            "delta": chunk.delta,
                            "ttft_ms": chunk.ttft_ms,
                            "elapsed_ms": chunk.elapsed_ms,
                        },
                    })

                if chunk.metrics:
                    await queue.put({
                        "event": "metrics",
                        "data": {
                            "model_index": idx,
                            "metrics": chunk.metrics.model_dump(),
                        },
                    })
        except Exception as e:
            await queue.put({"event": "error", "data": {"model_index": idx, "error": str(e)}})
        finally:
            await queue.put({"event": "done", "data": {"model_index": idx}})

    # Start tasks
    tasks = [
        asyncio.create_task(_stream_single_model(i, runner, cfg))
        for i, (runner, cfg) in enumerate(zip(runners, req.models))
    ]

    async def event_generator():
        completed_models = 0
        total_models = len(tasks)

        while completed_models < total_models:
            item = await queue.get()
            event_name = item["event"]
            data_json = json.dumps(item["data"], ensure_ascii=False)
            yield f"event: {event_name}\ndata: {data_json}\n\n"

            if event_name == "done":
                completed_models += 1

        yield "event: all_done\ndata: {}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
