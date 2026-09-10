"""Provider management router."""

import json
import time
import uuid
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
import httpx
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.provider import (
    ProviderCreateUpdate,
    ProviderDB,
    ProviderSchema,
    mask_api_key,
    normalize_default_provider,
    resolve_provider_api_key,
)

router = APIRouter(prefix="/api/providers", tags=["providers"])


class FetchModelsRequest(BaseModel):
    provider_id: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None


@router.get("", response_model=List[ProviderSchema])
def list_providers(db: Session = Depends(get_db)):
    return [_provider_schema(provider) for provider in db.query(ProviderDB).all()]


def _provider_schema(provider: ProviderDB) -> ProviderSchema:
    return ProviderSchema(
        id=provider.id,
        name=provider.name,
        base_url=provider.base_url,
        has_api_key=bool(provider.api_key),
        api_key_masked=mask_api_key(provider.api_key or ""),
        models=json.loads(provider.models_json or "[]"),
        timeout_seconds=getattr(provider, "timeout_seconds", 60) or 60,
        custom_headers=json.loads(getattr(provider, "custom_headers_json", "{}") or "{}"),
        model_pricing=json.loads(getattr(provider, "model_pricing_json", "{}") or "{}"),
        is_default=provider.is_default,
    )


@router.post("", response_model=ProviderSchema)
def create_or_update_provider(data: ProviderCreateUpdate, db: Session = Depends(get_db)):
    prov_id = data.id or f"prov_{uuid.uuid4().hex[:8]}"
    existing = db.query(ProviderDB).filter(ProviderDB.id == prov_id).first()
    models_str = json.dumps(data.models)
    headers_str = json.dumps(data.custom_headers or {})
    pricing_str = json.dumps(data.model_pricing or {})

    total_count = db.query(ProviderDB).count()
    should_be_default = True if (total_count == 0 or data.is_default is True) else False

    if existing:
        existing.name = data.name
        existing.base_url = data.base_url
        if data.api_key:
            existing.api_key = data.api_key
        existing.models_json = models_str
        existing.timeout_seconds = data.timeout_seconds or 60
        existing.custom_headers_json = headers_str
        existing.model_pricing_json = pricing_str
        if data.is_default is not None:
            existing.is_default = data.is_default
    else:
        existing = ProviderDB(
            id=prov_id,
            name=data.name,
            base_url=data.base_url,
            api_key=data.api_key or "",
            models_json=models_str,
            timeout_seconds=data.timeout_seconds or 60,
            custom_headers_json=headers_str,
            model_pricing_json=pricing_str,
            is_default=should_be_default,
        )
        db.add(existing)

    db.flush()
    normalize_default_provider(db, prov_id if data.is_default is True else None)
    db.commit()
    db.refresh(existing)

    return _provider_schema(existing)


@router.post("/{provider_id}/set_default", response_model=ProviderSchema)
def set_default_provider(provider_id: str, db: Session = Depends(get_db)):
    target = db.query(ProviderDB).filter(ProviderDB.id == provider_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Provider not found")

    normalize_default_provider(db, provider_id)
    db.commit()
    db.refresh(target)

    return _provider_schema(target)


@router.delete("/{provider_id}")
def delete_provider(provider_id: str, db: Session = Depends(get_db)):
    item = db.query(ProviderDB).filter(ProviderDB.id == provider_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Provider not found")
    db.delete(item)
    db.flush()
    normalize_default_provider(db)
    db.commit()

    return {"status": "success", "id": provider_id}


@router.post("/fetch_models")
async def fetch_remote_models(req: FetchModelsRequest, db: Session = Depends(get_db)):
    """Fetch model list dynamically from an OpenAI-compatible /v1/models endpoint."""
    base_url = req.base_url
    api_key = req.api_key
    custom_headers = req.custom_headers or {}

    if req.provider_id:
        prov = db.query(ProviderDB).filter(ProviderDB.id == req.provider_id).first()
        if prov:
            base_url = base_url or prov.base_url
            api_key = api_key or resolve_provider_api_key(prov)
            if not custom_headers:
                custom_headers = json.loads(prov.custom_headers_json or "{}")

    if not base_url:
        raise HTTPException(status_code=400, detail="base_url is required")

    if base_url.startswith("mock://"):
        return {
            "status": "ok",
            "models": ["mock-gpt-4o", "mock-deepseek-r1", "mock-claude-3-5", "mock-llama-3-1"],
            "count": 4,
        }

    endpoint = f"{base_url.rstrip('/')}/models"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    headers.update(custom_headers)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(endpoint, headers=headers)
            if resp.status_code != 200:
                return {
                    "status": "error",
                    "code": resp.status_code,
                    "message": f"Endpoint returned HTTP {resp.status_code}: {resp.text[:200]}",
                    "models": [],
                }

            data = resp.json()
            # Standard OpenAI /models schema has {"data": [{"id": "..."}, ...]}
            models = []
            if isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                models = [item["id"] for item in data["data"] if isinstance(item, dict) and "id" in item]
            elif isinstance(data, list):
                models = [item["id"] if isinstance(item, dict) and "id" in item else str(item) for item in data]
            elif isinstance(data, dict) and "models" in data and isinstance(data["models"], list):
                models = [item["id"] if isinstance(item, dict) and "id" in item else str(item) for item in data["models"]]

            return {
                "status": "ok",
                "code": 200,
                "count": len(models),
                "models": sorted(models),
            }
    except Exception as e:
        return {"status": "error", "message": f"Failed to fetch models: {str(e)}", "models": []}


@router.post("/{provider_id}/ping")
async def ping_provider(provider_id: str, db: Session = Depends(get_db)):
    item = db.query(ProviderDB).filter(ProviderDB.id == provider_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Provider not found")

    if item.base_url.startswith("mock://"):
        return {
            "status": "ok",
            "code": 200,
            "latency_ms": 1.2,
            "models_count": 4,
            "message": "Sandbox demo provider active (Ready for offline testing, RTT: 1.2ms)",
        }

    endpoint = f"{item.base_url.rstrip('/')}/models"
    api_key = resolve_provider_api_key(item)
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    custom_headers = json.loads(getattr(item, "custom_headers_json", "{}") or "{}")
    headers.update(custom_headers)

    t0 = time.perf_counter()
    try:
        timeout_val = float(getattr(item, "timeout_seconds", 10.0) or 10.0)
        async with httpx.AsyncClient(timeout=min(timeout_val, 15.0)) as client:
            resp = await client.get(endpoint, headers=headers)
            elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
            models_count = 0
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    if isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                        models_count = len(data["data"])
                except Exception:
                    pass

            if resp.status_code == 200:
                msg = f"Connected successfully (RTT: {elapsed_ms}ms"
                if models_count > 0:
                    msg += f", {models_count} models found"
                msg += ")"
                return {
                    "status": "ok",
                    "code": 200,
                    "latency_ms": elapsed_ms,
                    "models_count": models_count,
                    "message": msg,
                }
            elif resp.status_code in [401, 403]:
                return {
                    "status": "auth_error",
                    "code": resp.status_code,
                    "latency_ms": elapsed_ms,
                    "message": f"Authentication failed (HTTP {resp.status_code}, RTT: {elapsed_ms}ms)",
                }
            return {
                "status": "error",
                "code": resp.status_code,
                "latency_ms": elapsed_ms,
                "message": f"Server replied with HTTP {resp.status_code} (RTT: {elapsed_ms}ms)",
            }
    except Exception as e:
        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        return {"status": "error", "latency_ms": elapsed_ms, "message": f"Connection failed ({elapsed_ms}ms): {str(e)}"}
