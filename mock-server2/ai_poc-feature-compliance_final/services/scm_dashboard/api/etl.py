from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from services.scm_dashboard.db.session import get_db, get_source_db, get_magento_db
from services.scm_dashboard.etl.runner import run_etl

router = APIRouter(prefix="/api/etl", tags=["Dashboard"])


@router.post("/run")
async def trigger_etl(
    start: date = Query(
        default=None,
        description="Date range start (default: 30 days ago)",
    ),
    end: date = Query(
        default=None,
        description="Date range end (default: today)",
    ),
    scm_db: AsyncSession = Depends(get_db),
    source_db: AsyncSession = Depends(get_source_db),
    magento_db: AsyncSession = Depends(get_magento_db),
):
    """Manually trigger the ETL pipeline."""
    if not end:
        end = date.today()
    if not start:
        start = end - timedelta(days=30)

    result = await run_etl(
        source_db=source_db,
        scm_db=scm_db,
        date_range_start=start,
        date_range_end=end,
        magento_db=magento_db
    )
    return {
        "status": "completed",
        "date_range": {"start": str(start), "end": str(end)},
        "upserted": result["upserted"],
        "completed": result["completed"],
    }
