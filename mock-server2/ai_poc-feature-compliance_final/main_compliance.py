"""
Slim FastAPI entry point — loads ONLY the compliance service.
Skips product_comparison / scm_dashboard / kpimonitor (those need LLM/MySQL/Redis).

Start: .venv/bin/uvicorn main_compliance:app --host 0.0.0.0 --port 9090 --reload
Docs:  http://localhost:9090/docs
"""
from __future__ import annotations

from dotenv import load_dotenv

# Load .env FIRST so all env vars are in os.environ before any module imports them.
load_dotenv()

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from common.lib.db.session import engine
from common.lib.db.base import Base
from services.compliance.api.router import router as compliance_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run any pending schema migrations on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅  Compliance service is up")
    yield
    print("🛑  Shutting down compliance service")


app = FastAPI(
    title="Compliance Service",
    description="FastAPI compliance backend backed by PostgreSQL.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount compliance under the same prefix as production
app.include_router(compliance_router, prefix="/us/common/ai/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "db": "postgres", "service": "compliance"}
