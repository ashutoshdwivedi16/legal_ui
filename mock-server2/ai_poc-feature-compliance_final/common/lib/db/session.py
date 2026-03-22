"""Database session management."""
import os
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from common.config.database import settings
from common.lib.db.base import Base
from common.lib.utils.logging import get_logger, log_event
from common.constants.logging import (
    SERVICE_DATABASE,
    INFO,
    ERROR,
    DATABASE_INIT,
    DATABASE_INIT_FAILED
)

# ── SQLite override for lightweight local development ──────────────────────
# Set USE_SQLITE=true in .env to run without PostgreSQL.
_use_sqlite = os.getenv("USE_SQLITE", "false").lower() == "true"
if _use_sqlite:
    _sqlite_path = os.getenv("SQLITE_PATH", "./dev.db")
    _db_url = f"sqlite+aiosqlite:///{_sqlite_path}"
    engine = create_async_engine(
        _db_url,
        echo=settings.echo_sql,
        future=True,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_async_engine(settings.get_database_url(), echo=settings.echo_sql, future=True)
async_session_maker = async_sessionmaker[AsyncSession](engine, expire_on_commit=False)


async def get_session() -> AsyncSession:
    """Get database session."""
    async with async_session_maker() as session:
        yield session


async def init_db() -> None:
    """Initialize database tables."""
    log_event(
        level=INFO,
        message="Initializing database tables",
        event=DATABASE_INIT,
        service=SERVICE_DATABASE
    )
    
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        log_event(
            level=INFO,
            message="Database tables created successfully",
            event=DATABASE_INIT,
            service=SERVICE_DATABASE
        )
    except Exception as e:
        log_event(
            level=ERROR,
            message=f"Database initialization failed: {str(e)}",
            event=DATABASE_INIT_FAILED,
            service=SERVICE_DATABASE
        )
        raise
