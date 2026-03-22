import logging
from sshtunnel import SSHTunnelForwarder
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from common.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── SCM Dashboard DB (PostgreSQL, local container) ──
engine = create_async_engine(
    settings.ai_database_url,
    echo=False,
    pool_pre_ping=True,
    connect_args={"server_settings": {"search_path": "scm_dashboard"}},
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ── Magento DB (PostgreSQL, local container, separate database) ──
magento_engine = create_async_engine(settings.magento_database_url, echo=False, pool_pre_ping=True)
magento_async_session = async_sessionmaker(magento_engine, class_=AsyncSession, expire_on_commit=False)

# ── AIC Source DB (MySQL – via SSH tunnel locally, direct in deployed envs) ──
_ssh_tunnel: SSHTunnelForwarder | None = None
_source_engine = None
_source_async_session = None


def _ensure_source_db():
    """Initialise source-DB engine: via SSH tunnel (dev) or direct (deployed)."""
    global _ssh_tunnel, _source_engine, _source_async_session

    if _source_async_session is not None:
        return

    if settings.ssh_enabled:
        # ── Local dev: connect through SSH tunnel ──
        logger.info("Opening SSH tunnel to %s@%s:%s",
                    settings.sec_aic_bastion_username,
                    settings.sec_aic_bastion_host,
                    settings.sec_aic_bastion_port)

        _ssh_tunnel = SSHTunnelForwarder(
            (settings.sec_aic_bastion_host, settings.sec_aic_bastion_port),
            ssh_username=settings.sec_aic_bastion_username,
            ssh_pkey=settings.sec_aic_bastion_private_key_path,
            remote_bind_address=(settings.sec_aic_db_host, settings.sec_aic_db_port),
        )
        _ssh_tunnel.start()
        local_port = _ssh_tunnel.local_bind_port
        logger.info("SSH tunnel open → 127.0.0.1:%s", local_port)

        url = settings.source_database_url(local_port)

    elif settings.sec_aic_db_configured:
        # ── Deployed: direct connection ──
        logger.info("Connecting directly to AIC DB at %s:%s",
                    settings.sec_aic_db_host, settings.sec_aic_db_port)
        url = settings.sec_aic_database_url

    else:
        logger.warning("AIC DB not configured – source DB unavailable")
        return

    _source_engine = create_async_engine(url, echo=False, pool_pre_ping=True)
    _source_async_session = async_sessionmaker(
        _source_engine, class_=AsyncSession, expire_on_commit=False,
    )


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


async def get_magento_db() -> AsyncSession:
    async with magento_async_session() as session:
        yield session


async def get_source_db() -> AsyncSession:
    _ensure_source_db()
    if _source_async_session is None:
        raise RuntimeError("Source DB not available – check SSH / .env settings")
    async with _source_async_session() as session:
        yield session