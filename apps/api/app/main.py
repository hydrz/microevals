"""FastAPI Main Application Entrypoint for MicroEvals."""

import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.datasets import router as datasets_router
from app.api.evaluations import router as evals_router
from app.api.playground import router as playground_router
from app.api.presets import router as presets_router
from app.api.providers import router as providers_router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.migrations import run_migrations
from app.models.provider import ProviderDB, normalize_default_provider


def seed_default_providers():
    """Seed popular providers on first launch if table is empty."""
    db = SessionLocal()
    try:
        mock_prov = db.query(ProviderDB).filter(ProviderDB.id == "prov_mock").first()
        if not mock_prov:
            db.add(
                ProviderDB(
                    id="prov_mock",
                    name="Sandbox Demo (No Key)",
                    base_url="mock://builtin",
                    api_key="mock-key",
                    models_json=json.dumps(["mock-gpt-4o", "mock-deepseek-r1", "mock-claude-3.5"]),
                    is_default=False,
                )
            )
            db.commit()

        count = db.query(ProviderDB).count()
        if count <= 1:
            defaults = [
                ProviderDB(
                    id="prov_deepseek",
                    name="DeepSeek",
                    base_url="https://api.deepseek.com/v1",
                    api_key=os.getenv("DEEPSEEK_API_KEY", ""),
                    models_json=json.dumps(["deepseek-chat", "deepseek-reasoner"]),
                    is_default=False,
                ),
                ProviderDB(
                    id="prov_openai",
                    name="OpenAI",
                    base_url="https://api.openai.com/v1",
                    api_key=os.getenv("OPENAI_API_KEY", ""),
                    models_json=json.dumps(["gpt-4o", "gpt-4o-mini", "o3-mini"]),
                    is_default=False,
                ),
                ProviderDB(
                    id="prov_siliconflow",
                    name="SiliconFlow (硅基流动)",
                    base_url="https://api.siliconflow.cn/v1",
                    api_key=os.getenv("SILICONFLOW_API_KEY", ""),
                    models_json=json.dumps([
                        "deepseek-ai/DeepSeek-V3",
                        "deepseek-ai/DeepSeek-R1",
                        "Qwen/Qwen2.5-72B-Instruct",
                    ]),
                    is_default=False,
                ),
                ProviderDB(
                    id="prov_ollama",
                    name="Ollama (Local)",
                    base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
                    api_key="",
                    models_json=json.dumps(["llama3.1", "qwen2.5:7b", "deepseek-r1:8b"]),
                    is_default=False,
                ),
            ]
            db.add_all(defaults)
        db.flush()
        normalize_default_provider(db)
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    seed_default_providers()
    yield
    # Shutdown


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="MicroEvals Backend API Service",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(playground_router)
app.include_router(evals_router)
app.include_router(datasets_router)
app.include_router(providers_router)
app.include_router(presets_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": settings.app_name}
