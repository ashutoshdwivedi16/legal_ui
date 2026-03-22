"""Database session management."""
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
