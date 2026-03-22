"""Examples of how to connect to database and run SQL queries."""
import asyncio
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from common.lib.db.session import async_session_maker, engine
from common.lib.db.models import AnomalyAudit


# ============================================================================
# Example 1: Using async session (Recommended for application code)
# ============================================================================
async def example_using_session():
    """Create session and run ORM queries."""
    async with async_session_maker() as session:
        # INSERT - Add new record using ORM
        new_audit = AnomalyAudit(
            anomaly_type="spike",
            category="tvs",
            metric_name="conversion_rate",
            metric_value=0.05,
            change_percentage=-30.0,
            assigned_agent="retail_monitor",
            investigation_status="pending"
        )
        session.add(new_audit)
        await session.commit()
        await session.refresh(new_audit)
        print(f"Created audit: {new_audit.id}")
        
        # SELECT - Query using ORM
        stmt = select(AnomalyAudit).where(AnomalyAudit.investigation_status == "pending")
        result = await session.execute(stmt)
        audits = result.scalars().all()
        print(f"Found {len(audits)} pending audits")
        
        # UPDATE - Modify record
        audit = audits[0]
        audit.investigation_status = "in_progress"
        await session.commit()
        print(f"Updated audit {audit.id}")
        
        # DELETE - Remove record
        await session.delete(audit)
        await session.commit()
        print(f"Deleted audit {audit.id}")


# ============================================================================
# Example 2: Using raw SQL with session
# ============================================================================
async def example_raw_sql_with_session():
    """Execute raw SQL queries using session."""
    async with async_session_maker() as session:
        # SELECT with raw SQL
        result = await session.execute(
            text("SELECT id, anomaly_type, metric_name FROM anomaly_audits LIMIT 5")
        )
        rows = result.fetchall()
        for row in rows:
            print(f"ID: {row.id}, Type: {row.anomaly_type}, Metric: {row.metric_name}")
        
        # INSERT with raw SQL
        await session.execute(
            text("""
                INSERT INTO anomaly_audits 
                (anomaly_type, category, metric_name, metric_value, change_percentage, assigned_agent, investigation_status)
                VALUES (:type, :category, :metric, :value, :change, :agent, :status)
            """),
            {
                "type": "drop",
                "category": "laptops",
                "metric": "revenue",
                "value": 50000.0,
                "change": -15.5,
                "agent": "retail_monitor",
                "status": "pending"
            }
        )
        await session.commit()
        print("Inserted via raw SQL")


# ============================================================================
# Example 3: Using engine directly for connection pool
# ============================================================================
async def example_using_engine_directly():
    """Use engine for connection-level operations."""
    # Get a connection from the pool
    async with engine.connect() as conn:
        # Execute raw SQL
        result = await conn.execute(text("SELECT COUNT(*) as count FROM anomaly_audits"))
        count = result.scalar()
        print(f"Total audits: {count}")
        
        # Run in transaction
        async with conn.begin():
            await conn.execute(
                text("UPDATE anomaly_audits SET investigation_status = 'reviewed' WHERE investigation_status = 'completed'")
            )
            # Automatically commits when context exits


# ============================================================================
# Example 4: Dependency injection pattern (for FastAPI routes)
# ============================================================================
async def example_fastapi_dependency(session: AsyncSession):
    """
    This function signature matches FastAPI's Depends pattern.
    
    Usage in routes:
    @router.post("/investigate")
    async def investigate(
        request: AnomalyDetectionRequest,
        session: AsyncSession = Depends(get_session)
    ):
        # Use session here
        audit = AnomalyAudit(...)
        session.add(audit)
        await session.commit()
        return {"id": audit.id}
    """
    # Query data
    stmt = select(AnomalyAudit).order_by(AnomalyAudit.created_at.desc()).limit(10)
    result = await session.execute(stmt)
    recent_audits = result.scalars().all()
    return recent_audits


# ============================================================================
# Example 5: Complex queries with joins and filters
# ============================================================================
async def example_complex_queries():
    """Advanced SQLAlchemy queries."""
    async with async_session_maker() as session:
        # Filter with multiple conditions
        stmt = (
            select(AnomalyAudit)
            .where(
                AnomalyAudit.investigation_status == "completed",
                AnomalyAudit.change_percentage < -20.0
            )
            .order_by(AnomalyAudit.detected_at.desc())
            .limit(10)
        )
        result = await session.execute(stmt)
        critical_audits = result.scalars().all()
        
        # Aggregate queries
        count_by_status = await session.execute(
            text("""
                SELECT investigation_status, COUNT(*) as count
                FROM anomaly_audits
                GROUP BY investigation_status
            """)
        )
        for row in count_by_status:
            print(f"{row.investigation_status}: {row.count}")


# ============================================================================
# Example 6: Bulk operations
# ============================================================================
async def example_bulk_operations():
    """Efficient bulk insert/update operations."""
    async with async_session_maker() as session:
        # Bulk insert
        audits = [
            AnomalyAudit(
                anomaly_type="spike",
                category=f"category_{i}",
                metric_name="test_metric",
                metric_value=float(i),
                change_percentage=10.0,
                assigned_agent="test_agent",
                investigation_status="pending"
            )
            for i in range(100)
        ]
        session.add_all(audits)
        await session.commit()
        print(f"Bulk inserted {len(audits)} records")
        
        # Bulk update with raw SQL (faster for large updates)
        await session.execute(
            text("UPDATE anomaly_audits SET investigation_status = 'archived' WHERE category LIKE 'category_%'")
        )
        await session.commit()


# ============================================================================
# Main runner
# ============================================================================
async def main():
    """Run all examples."""
    print("=" * 80)
    print("Example 1: Using async session (ORM)")
    print("=" * 80)
    await example_using_session()
    
    print("\n" + "=" * 80)
    print("Example 2: Raw SQL with session")
    print("=" * 80)
    await example_raw_sql_with_session()
    
    print("\n" + "=" * 80)
    print("Example 3: Using engine directly")
    print("=" * 80)
    await example_using_engine_directly()
    
    print("\n" + "=" * 80)
    print("Example 5: Complex queries")
    print("=" * 80)
    await example_complex_queries()
    
    print("\n" + "=" * 80)
    print("Example 6: Bulk operations")
    print("=" * 80)
    await example_bulk_operations()


if __name__ == "__main__":
    asyncio.run(main())
