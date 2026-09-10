"""Application configuration and environment loading."""

import os
from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "MicroEvals API"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./microevals.db")
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))
    cors_origins: list[str] = ["*"]


settings = Settings()
