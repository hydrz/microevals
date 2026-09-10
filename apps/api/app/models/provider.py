"""Provider database and pydantic models."""

import json
import os
from typing import Dict, List, Optional
from sqlalchemy import Column, String, Text, Boolean, Integer
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.core.database import Base


class ProviderDB(Base):
    __tablename__ = "providers"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    api_key = Column(String, default="")
    models_json = Column(Text, default="[]")
    timeout_seconds = Column(Integer, default=60)
    custom_headers_json = Column(Text, default="{}")
    model_pricing_json = Column(Text, default="{}")
    is_default = Column(Boolean, default=False)


class ProviderSchema(BaseModel):
    id: str
    name: str
    base_url: str
    has_api_key: bool = False
    api_key_masked: str = ""
    models: List[str] = Field(default_factory=list)
    timeout_seconds: int = 60
    custom_headers: Dict[str, str] = Field(default_factory=dict)
    model_pricing: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    is_default: bool = False


class ProviderCreateUpdate(BaseModel):
    id: Optional[str] = None
    name: str
    base_url: str
    api_key: Optional[str] = None
    models: List[str] = Field(default_factory=list)
    timeout_seconds: Optional[int] = 60
    custom_headers: Optional[Dict[str, str]] = Field(default_factory=dict)
    model_pricing: Optional[Dict[str, Dict[str, float]]] = Field(default_factory=dict)
    is_default: Optional[bool] = False


def mask_api_key(api_key: str) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "•" * len(api_key)
    return f"{api_key[:3]}...{api_key[-4:]}"


def resolve_provider_api_key(provider: ProviderDB) -> str:
    known_names = {
        "prov_openai": "OPENAI_API_KEY",
        "prov_deepseek": "DEEPSEEK_API_KEY",
        "prov_siliconflow": "SILICONFLOW_API_KEY",
    }
    generic_name = f"MICROEVALS_{provider.id.upper().replace('-', '_')}_API_KEY"
    known_name = known_names.get(provider.id)
    return (
        os.getenv(generic_name)
        or (os.getenv(known_name) if known_name else None)
        or provider.api_key
        or ""
    )


def normalize_default_provider(db: Session, preferred_id: Optional[str] = None) -> None:
    providers = db.query(ProviderDB).order_by(ProviderDB.id).all()
    if not providers:
        return
    chosen = next((p for p in providers if p.id == preferred_id), None) if preferred_id else None
    chosen = chosen or next((p for p in providers if p.is_default), None)
    chosen = chosen or next((p for p in providers if p.id == "prov_mock"), providers[0])
    for provider in providers:
        provider.is_default = provider.id == chosen.id
