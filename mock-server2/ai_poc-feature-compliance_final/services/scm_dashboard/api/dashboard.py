"""Dashboard API — KPI, pipeline, trend, aging.

CHANGES from original:
- #3:  warning/alert/aging KPI uses order_tracking_current only (ongoing orders)
- #6:  OTD Trend: only delivered orders count. Total = delivered only.
- #7:  rescheduled = rad IS NOT NULL AND magento_rad2 IS NOT NULL AND rad::date != magento_rad2::date
- #8:  canceled count added to KPI
- #9:  Pipeline: magento_order total = overall total. Removed warning/alert/aging per stage.
       Added green/yellow/red color counts per stage.
- #10: booked avg_lt = gerp_booked_date - magento_erp_exported_at
- #11: backorder avg_lt = pick_release_date - back_order_date
- #12: shipped uses COALESCE(actual_shipment_date, wms_shipped_date)
- #13: All dates are TIMESTAMP now
- #14: 7 stages have green/yellow/red color counts
- #6(order_date): Uses order_date (now sourced from magento_po_created_at via ETL)
- #15: gerp_booked_date + 5h UTC correction (source is EST)
"""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from services.scm_dashboard.db.session import get_db
from services.scm_dashboard.schemas.dashboard import (
    KpiSummary, PipelineStage, AgingGroup, TrendPoint, DelayTrendPoint,
    AlertAgingTrendPoint,
    StageDelayTrendPoint, StageDelaySummary, StageDelayTrendResponse,
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

STAGE_ORDER = [
    "magento_order", "booked", "backorder_hold", "pick_released",
    "load_planning", "routed", "shipped",
    "hub_received", "out_for_delivery", "delivered", "canceled",
]

# 7 stages with color logic (#14)
STAGES_WITH_COLORS = {
    "magento_order", "booked", "pick_released", "routed",
    "shipped", "hub_received", "delivered",
}

REF_PATTERN = "^(rad1|rad2|rsd)$"

# #15: EST→UTC correction for gerp_booked_date
_BOOKED = "(gerp_booked_date + INTERVAL '5 hours')"

# ── Color expressions for #14 ───────────────────────────────────────────
# Each returns a SQL CASE → 'green'/'yellow'/'red'/NULL
# All timestamp-based now (#13)

COLOR_EXPRS = {
    "magento_order": """
        CASE WHEN magento_erp_exported_at IS NOT NULL AND magento_po_created_at IS NOT NULL THEN
            CASE WHEN EXTRACT(EPOCH FROM (magento_erp_exported_at - magento_po_created_at)) / 3600 <= 4 THEN 'green'
                 ELSE 'red'
            END
        END""",
    "booked": f"""
        CASE WHEN gerp_booked_date IS NOT NULL AND magento_erp_exported_at IS NOT NULL THEN
            CASE WHEN EXTRACT(EPOCH FROM ({_BOOKED} - magento_erp_exported_at)) / 3600 <= 1 THEN 'green'
                 WHEN EXTRACT(EPOCH FROM ({_BOOKED} - magento_erp_exported_at)) / 3600 <= 2 THEN 'yellow'
                 ELSE 'red'
            END
        END""",
    "pick_released": f"""
        CASE WHEN pick_release_date IS NOT NULL AND gerp_booked_date IS NOT NULL THEN
            CASE WHEN EXTRACT(EPOCH FROM (pick_release_date - {_BOOKED})) / 3600 <= 1 THEN 'green'
                 WHEN EXTRACT(EPOCH FROM (pick_release_date - {_BOOKED})) / 3600 <= 2 THEN 'yellow'
                 ELSE 'red'
            END
        END""",
    "routed": """
        CASE WHEN routed_date IS NOT NULL AND load_plan_date IS NOT NULL THEN
            CASE WHEN EXTRACT(EPOCH FROM (routed_date - load_plan_date)) / 3600 <= 1 THEN 'green'
                 WHEN EXTRACT(EPOCH FROM (routed_date - load_plan_date)) / 3600 <= 2 THEN 'yellow'
                 ELSE 'red'
            END
        END""",
    "shipped": """
        CASE WHEN COALESCE(actual_shipment_date, wms_shipped_date) IS NOT NULL AND rsd IS NOT NULL THEN
            CASE WHEN COALESCE(actual_shipment_date, wms_shipped_date)::date <= rsd::date THEN 'green'
                 WHEN COALESCE(actual_shipment_date, wms_shipped_date)::date = rsd::date + 1
                      AND EXTRACT(EPOCH FROM (COALESCE(actual_shipment_date, wms_shipped_date) - rsd)) / 3600 <= 24 THEN 'yellow'
                 ELSE 'red'
            END
        END""",
    "hub_received": """
        CASE WHEN hub_received_dt IS NOT NULL AND COALESCE(actual_shipment_date, wms_shipped_date) IS NOT NULL THEN
            CASE WHEN hub_received_dt::date <= COALESCE(actual_shipment_date, wms_shipped_date)::date THEN 'green'
                 WHEN hub_received_dt::date = COALESCE(actual_shipment_date, wms_shipped_date)::date + 1
                      AND EXTRACT(EPOCH FROM (hub_received_dt - COALESCE(actual_shipment_date, wms_shipped_date))) / 3600 <= 24 THEN 'yellow'
                 ELSE 'red'
            END
        END""",
    "delivered": """
        CASE WHEN delivered_dt IS NOT NULL AND hub_received_dt IS NOT NULL THEN
            CASE WHEN delivered_dt::date <= hub_received_dt::date THEN 'green'
                 WHEN delivered_dt::date = hub_received_dt::date + 1
                      AND EXTRACT(EPOCH FROM (delivered_dt - hub_received_dt)) / 3600 <= 24 THEN 'yellow'
                 ELSE 'red'
            END
        END""",
}

# ── Stage delay rules for stage-delay-trend (#14-2) ─────────────────────
# "delayed" = red color for each stage

STAGE_DELAY_RULES = {
    "magento_order": {
        "start": "magento_po_created_at",
        "end": "magento_erp_exported_at",
        "delay_expr": "EXTRACT(EPOCH FROM (magento_erp_exported_at - magento_po_created_at)) / 86400",
        "threshold_expr": f"({COLOR_EXPRS['magento_order']}) = 'red'",
        "unit": "day",
    },
    "booked": {
        "start": "magento_erp_exported_at",
        "end": _BOOKED,
        "delay_expr": f"EXTRACT(EPOCH FROM ({_BOOKED} - magento_erp_exported_at)) / 86400",
        "threshold_expr": f"({COLOR_EXPRS['booked']}) = 'red'",
        "unit": "day",
    },
    "pick_released": {
        "start": _BOOKED,
        "end": "pick_release_date",
        "delay_expr": f"EXTRACT(EPOCH FROM (pick_release_date - {_BOOKED})) / 86400",
        "threshold_expr": f"({COLOR_EXPRS['pick_released']}) = 'red'",
        "unit": "day",
    },
    "routed": {
        "start": "load_plan_date",
        "end": "routed_date",
        "delay_expr": "EXTRACT(EPOCH FROM (routed_date - load_plan_date)) / 86400",
        "threshold_expr": f"({COLOR_EXPRS['routed']}) = 'red'",
        "unit": "day",
    },
    "shipped": {
        "start": "rsd",
        "end": "COALESCE(actual_shipment_date, wms_shipped_date)",
        "delay_expr": "EXTRACT(EPOCH FROM (COALESCE(actual_shipment_date, wms_shipped_date) - rsd)) / 86400",
        "threshold_expr": f"({COLOR_EXPRS['shipped']}) = 'red'",
        "unit": "day",
    },
    "hub_received": {
        "start": "COALESCE(actual_shipment_date, wms_shipped_date)",
        "end": "hub_received_dt",
        "delay_expr": "EXTRACT(EPOCH FROM (hub_received_dt - COALESCE(actual_shipment_date, wms_shipped_date))) / 86400",
        "threshold_expr": f"({COLOR_EXPRS['hub_received']}) = 'red'",
        "unit": "day",
    },
    "delivered": {
        "start": "hub_received_dt",
        "end": "delivered_dt",
        "delay_expr": "EXTRACT(EPOCH FROM (delivered_dt - hub_received_dt)) / 86400",
        "threshold_expr": f"({COLOR_EXPRS['delivered']}) = 'red'",
        "unit": "day",
    },
}


def _ref_col(ref_type: str) -> str:
    if ref_type == "rad1":
        return "rad"
    elif ref_type == "rad2":
        return "magento_rad2"
    return None


def _build_filters(params: dict, carrier=None, model=None, po=None) -> str:
    parts = []
    if carrier:
        parts.append("AND carrier_code = :carrier")
        params["carrier"] = carrier
    if model:
        parts.append("AND model_code = :model")
        params["model"] = model
    if po:
        parts.append("AND cust_po_no = :po")
        params["po"] = po
    return " ".join(parts)


def _base_union(ref_type: str, extra_where: str = "") -> str:
    """UNION of current + completed for general KPI queries."""
    if ref_type in ("rad1", "rad2"):
        ref = _ref_col(ref_type)
        return f"""(
            SELECT current_stage, delivered_dt, order_date,
                   has_backorder_hold, magento_rad2, rad, {ref} AS ref_date
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end {extra_where}
            UNION ALL
            SELECT current_stage, delivered_dt, order_date,
                   has_backorder_hold, magento_rad2, rad, {ref} AS ref_date
            FROM order_tracking_completed
            WHERE order_date BETWEEN :start AND :end {extra_where}
        ) t"""
    else:
        return f"""(
            SELECT current_stage, delivered_dt, order_date,
                   has_backorder_hold, magento_rad2, rad, rsd AS ref_date,
                   CASE
                       WHEN carrier_code = 'LPTU' THEN rad
                       WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                       ELSE rad
                   END AS ref_target
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end {extra_where}
            UNION ALL
            SELECT current_stage, delivered_dt, order_date,
                   has_backorder_hold, magento_rad2, rad, rsd AS ref_date,
                   CASE
                       WHEN carrier_code = 'LPTU' THEN rad
                       WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                       ELSE rad
                   END AS ref_target
            FROM order_tracking_completed
            WHERE order_date BETWEEN :start AND :end {extra_where}
        ) t"""


def _current_only_union(ref_type: str, extra_where: str = "") -> str:
    """#3: Current table only for warning/alert/aging."""
    if ref_type in ("rad1", "rad2"):
        ref = _ref_col(ref_type)
        return f"""(
            SELECT current_stage, delivered_dt, order_date,
                   {ref} AS ref_date
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end {extra_where}
        ) t"""
    else:
        return f"""(
            SELECT current_stage, delivered_dt, order_date,
                   rsd AS ref_date,
                   CASE
                       WHEN carrier_code = 'LPTU' THEN rad
                       WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                       ELSE rad
                   END AS ref_target
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end {extra_where}
        ) t"""


def _on_time_expr(ref_type: str) -> str:
    if ref_type in ("rad1", "rad2"):
        return "delivered_dt IS NOT NULL AND (delivered_dt::date - ref_date::date) <= 0"
    else:
        return "ref_date IS NOT NULL AND ref_target IS NOT NULL AND (ref_date::date - ref_target::date) <= 0"


def _delayed_expr(ref_type: str) -> str:
    if ref_type in ("rad1", "rad2"):
        return """(delivered_dt IS NOT NULL AND (delivered_dt::date - ref_date::date) > 0)
                OR (delivered_dt IS NULL AND ref_date IS NOT NULL AND (:today - ref_date::date) > 0)"""
    else:
        return "ref_date IS NOT NULL AND ref_target IS NOT NULL AND (ref_date::date - ref_target::date) > 0"


def _warning_expr(ref_type: str) -> str:
    if ref_type in ("rad1", "rad2"):
        return "delivered_dt IS NULL AND ref_date IS NOT NULL AND (:today - ref_date::date) = -1"
    else:
        return "ref_date IS NOT NULL AND ref_target IS NOT NULL AND (ref_target::date - ref_date::date) = 1"


def _alert_expr(ref_type: str) -> str:
    if ref_type in ("rad1", "rad2"):
        return "delivered_dt IS NULL AND ref_date IS NOT NULL AND (:today - ref_date::date) = 0"
    else:
        return "ref_date IS NOT NULL AND ref_target IS NOT NULL AND (ref_target::date - ref_date::date) = 0"


def _delay_days_expr(ref_type: str) -> str:
    if ref_type in ("rad1", "rad2"):
        return """GREATEST(
            CASE WHEN delivered_dt IS NOT NULL THEN (delivered_dt::date - ref_date::date)
                 WHEN ref_date IS NOT NULL THEN (:today - ref_date::date)
                 ELSE 0 END, 0)"""
    else:
        return """GREATEST(
            CASE WHEN ref_date IS NOT NULL AND ref_target IS NOT NULL
                 THEN (ref_date::date - ref_target::date)
                 ELSE 0 END, 0)"""


# ── KPI ──────────────────────────────────────────────────────────────────

@router.get("/kpi", response_model=KpiSummary)
async def get_kpi(
    start: date = Query(...),
    end: date = Query(...),
    ref_type: str = Query("rad1", pattern=REF_PATTERN),
    carrier: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    po: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params = {"start": start, "end": end, "today": date.today()}
    extra = _build_filters(params, carrier, model, po)
    base = _base_union(ref_type, extra)

    on_time = _on_time_expr(ref_type)
    delayed = _delayed_expr(ref_type)

    # Main KPI: total, on_time, delayed, backorder, rescheduled, canceled from UNION
    sql = text(f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN {on_time} THEN 1 ELSE 0 END) AS on_time,
            SUM(CASE WHEN {delayed} THEN 1 ELSE 0 END) AS delayed_count,
            SUM(has_backorder_hold) AS backorder,
            SUM(CASE WHEN magento_rad2 IS NOT NULL AND rad IS NOT NULL
                      AND magento_rad2::date != rad::date THEN 1 ELSE 0 END) AS rescheduled,
            SUM(CASE WHEN current_stage = 'canceled' THEN 1 ELSE 0 END) AS canceled
        FROM {base}
    """)
    row = (await db.execute(sql, params)).mappings().first()

    # #3: Warning/Alert/Aging from CURRENT only (ongoing orders)
    current_base = _current_only_union(ref_type, extra)
    warning = _warning_expr(ref_type)
    alert = _alert_expr(ref_type)
    delayed_current = _delayed_expr(ref_type)

    waa_sql = text(f"""
        SELECT
            SUM(CASE WHEN {warning} THEN 1 ELSE 0 END) AS warning,
            SUM(CASE WHEN {alert} THEN 1 ELSE 0 END) AS alert_dday,
            SUM(CASE WHEN {delayed_current} THEN 1 ELSE 0 END) AS aging_total
        FROM {current_base}
    """)
    waa_row = (await db.execute(waa_sql, params)).mappings().first()

    # Avg lead time from completed only
    avg_lt = (await db.execute(text(f"""
        SELECT AVG(lt_total) FROM order_tracking_completed
        WHERE order_date BETWEEN :start AND :end AND lt_total IS NOT NULL {extra}
    """), params)).scalar()

    total = row["total"] or 0
    return KpiSummary(
        total_orders=total,
        on_time=row["on_time"] or 0,
        on_time_pct=round((row["on_time"] or 0) / total * 100, 1) if total else 0,
        delayed=row["delayed_count"] or 0,
        backorder=row["backorder"] or 0,
        warning_d1=waa_row["warning"] or 0,
        alert_dday=waa_row["alert_dday"] or 0,
        aging_total=waa_row["aging_total"] or 0,
        rescheduled=row["rescheduled"] or 0,
        canceled=row["canceled"] or 0,
        avg_lead_time=round(avg_lt, 1) if avg_lt else None,
    )


# ── Pipeline ─────────────────────────────────────────────────────────────

@router.get("/pipeline", response_model=list[PipelineStage])
async def get_pipeline(
    start: date = Query(...),
    end: date = Query(...),
    ref_type: str = Query("rad1", pattern=REF_PATTERN),
    carrier: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    po: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params = {"start": start, "end": end, "today": date.today()}
    extra = _build_filters(params, carrier, model, po)

    # Build color select expressions for the 7 color stages
    color_selects = []
    for stage_name, expr in COLOR_EXPRS.items():
        if stage_name == "magento_order":
            # magento_order: 모든 row에서 계산 (stage 필터 없음)
            color_selects.append(f"""
                SUM(CASE WHEN ({expr}) = 'green' THEN 1 ELSE 0 END) AS {stage_name}_green,
                SUM(CASE WHEN ({expr}) = 'yellow' THEN 1 ELSE 0 END) AS {stage_name}_yellow,
                SUM(CASE WHEN ({expr}) = 'red' THEN 1 ELSE 0 END) AS {stage_name}_red
            """)
        else:
            color_selects.append(f"""
                SUM(CASE WHEN current_stage = '{stage_name}' AND ({expr}) = 'green' THEN 1 ELSE 0 END) AS {stage_name}_green,
                SUM(CASE WHEN current_stage = '{stage_name}' AND ({expr}) = 'yellow' THEN 1 ELSE 0 END) AS {stage_name}_yellow,
                SUM(CASE WHEN current_stage = '{stage_name}' AND ({expr}) = 'red' THEN 1 ELSE 0 END) AS {stage_name}_red
            """)

    color_sql_part = ",\n".join(color_selects)

    # Stage counts + color counts in one query
    # #15: gerp_booked_date selected raw; _BOOKED correction applied in COLOR_EXPRS
    sql = text(f"""
        SELECT current_stage,
            COUNT(*) AS total,
            {color_sql_part}
        FROM (
            SELECT current_stage, magento_erp_exported_at, magento_po_created_at,
                   gerp_booked_date, pick_release_date, load_plan_date,
                   routed_date, actual_shipment_date, wms_shipped_date,
                   rsd, hub_received_dt, delivered_dt
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end {extra}
            UNION ALL
            SELECT current_stage, magento_erp_exported_at, magento_po_created_at,
                   gerp_booked_date, pick_release_date, load_plan_date,
                   routed_date, actual_shipment_date, wms_shipped_date,
                   rsd, hub_received_dt, delivered_dt
            FROM order_tracking_completed
            WHERE order_date BETWEEN :start AND :end {extra}
        ) t
        GROUP BY current_stage
    """)
    result = await db.execute(sql, params)
    rows = {r["current_stage"]: dict(r) for r in result.mappings().all()}

    # Overall total for magento_order stage (#9)
    overall_total = sum(r.get("total", 0) for r in rows.values())

    # #10, #11, #12: Updated avg lead times
    # #15: gerp_booked_date corrected with +5h in calculations
    lt_sql = text(f"""
        SELECT
            AVG(magento_erp_exported_at - magento_po_created_at) AS lt_magento_order,
            AVG(CASE WHEN current_stage = 'booked' THEN {_BOOKED} - magento_erp_exported_at END) AS lt_booked,
            AVG(CASE WHEN current_stage = 'backorder_hold' THEN (back_order_date + INTERVAL '5 hours') - magento_erp_exported_at END) AS lt_backorder_hold,
            AVG(CASE WHEN current_stage = 'pick_released' THEN pick_release_date - {_BOOKED} END) AS lt_pick_released,
            AVG(CASE WHEN current_stage = 'load_planning' THEN load_plan_date - pick_release_date END) AS lt_load_planning,
            AVG(CASE WHEN current_stage = 'routed' THEN routed_date - load_plan_date END) AS lt_routed,
            AVG(CASE WHEN current_stage = 'shipped' THEN COALESCE(actual_shipment_date, wms_shipped_date) - routed_date END) AS lt_shipped,
            AVG(CASE WHEN current_stage = 'hub_received' THEN hub_received_dt - COALESCE(actual_shipment_date, wms_shipped_date) END) AS lt_hub_received,
            AVG(CASE WHEN current_stage = 'out_for_delivery' THEN out_for_delivery_dt - hub_received_dt END) AS lt_out_for_delivery,
            AVG(CASE WHEN current_stage = 'delivered' AND delivered_dt >= '2026-02-18'THEN delivered_dt - out_for_delivery_dt END) AS lt_delivered
        FROM (
            SELECT current_stage, gerp_booked_date, order_date, back_order_date, pick_release_date,
                   load_plan_date, routed_date, actual_shipment_date, wms_shipped_date,
                   hub_received_dt, out_for_delivery_dt, delivered_dt,
                   magento_po_created_at, magento_erp_exported_at
            FROM order_tracking_current WHERE order_date BETWEEN :start AND :end {extra}
            UNION ALL
            SELECT current_stage, gerp_booked_date, order_date, back_order_date, pick_release_date,
                   load_plan_date, routed_date, actual_shipment_date, wms_shipped_date,
                   hub_received_dt, out_for_delivery_dt, delivered_dt,
                   magento_po_created_at, magento_erp_exported_at
            FROM order_tracking_completed WHERE order_date BETWEEN :start AND :end {extra}
        ) t
    """)
    lt = (await db.execute(lt_sql, params)).mappings().first()

    def _interval_to_hours(val):
        """Convert PostgreSQL interval to hours (float)."""
        if val is None:
            return None
        if hasattr(val, 'total_seconds'):
            return round(val.total_seconds() / 3600, 1)
        try:
            return round(float(val) * 24, 1)  # if returned as days
        except (TypeError, ValueError):
            return None
        
    def _interval_to_days(val):
        """Convert PostgreSQL interval to days (float)."""
        if val is None:
            return None
        if hasattr(val, 'total_seconds'):
            return round(val.total_seconds() / 86400, 2)
        try:
            return round(float(val), 2)
        except (TypeError, ValueError):
            return None
    
    lt_map = {
        "magento_order": _interval_to_days(lt["lt_magento_order"]),
        "booked": _interval_to_days(lt["lt_booked"]),
        "backorder_hold": _interval_to_days(lt["lt_backorder_hold"]),
        "pick_released": _interval_to_days(lt["lt_pick_released"]),
        "load_planning": _interval_to_days(lt["lt_load_planning"]),
        "routed": _interval_to_days(lt["lt_routed"]),
        "shipped": _interval_to_days(lt["lt_shipped"]),
        "hub_received": _interval_to_days(lt["lt_hub_received"]),
        "out_for_delivery": _interval_to_days(lt["lt_out_for_delivery"]),
        "delivered": _interval_to_days(lt["lt_delivered"]),
    }

    result_stages = []
    
    # magento_order 색깔은 모든 stage에서 합산 (stage 필터 없이 계산했으므로)
    mo_green = sum(r.get("magento_order_green", 0) for r in rows.values())
    mo_yellow = sum(r.get("magento_order_yellow", 0) for r in rows.values())
    mo_red = sum(r.get("magento_order_red", 0) for r in rows.values())

    for s in STAGE_ORDER:
        stage_data = rows.get(s, {})
        total = stage_data.get("total", 0)

        if s == "magento_order":
            total = overall_total

        green = yellow = red = None
        if s in STAGES_WITH_COLORS:
            if s == "magento_order":
                green = mo_green
                yellow = mo_yellow
                red = mo_red
            else:
                green = stage_data.get(f"{s}_green", 0)
                yellow = stage_data.get(f"{s}_yellow", 0)
                red = stage_data.get(f"{s}_red", 0)

        result_stages.append(PipelineStage(
            stage=s,
            total=total,
            avg_lt=lt_map.get(s),
            green=green,
            yellow=yellow,
            red=red,
        ))

    return result_stages


# ── Aging ────────────────────────────────────────────────────────────────

@router.get("/aging", response_model=list[AgingGroup])
async def get_aging(
    start: date = Query(...),
    end: date = Query(...),
    ref_type: str = Query("rad1", pattern=REF_PATTERN),
    carrier: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    po: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params = {"start": start, "end": end, "today": date.today()}
    extra = _build_filters(params, carrier, model, po)

    if ref_type in ("rad1", "rad2"):
        ref = _ref_col(ref_type)
        inner = f"""
            SELECT delivered_dt, {ref} AS ref_date
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end {extra}
            UNION ALL
            SELECT delivered_dt, {ref} AS ref_date
            FROM order_tracking_completed
            WHERE order_date BETWEEN :start AND :end {extra}
        """
        d_expr = """GREATEST(
            CASE WHEN delivered_dt IS NOT NULL THEN (delivered_dt::date - ref_date::date)
                 ELSE (:today - ref_date::date) END, 0)"""
    else:
        inner = f"""
            SELECT rsd,
                   CASE
                       WHEN carrier_code = 'LPTU' THEN rad
                       WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                       ELSE rad
                   END AS ref_target
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end {extra}
            UNION ALL
            SELECT rsd,
                   CASE
                       WHEN carrier_code = 'LPTU' THEN rad
                       WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                       ELSE rad
                   END AS ref_target
            FROM order_tracking_completed
            WHERE order_date BETWEEN :start AND :end {extra}
        """
        d_expr = """GREATEST(
            CASE WHEN rsd IS NOT NULL AND ref_target IS NOT NULL
                 THEN (rsd::date - ref_target::date) ELSE 0 END, 0)"""

    sql = text(f"""
        SELECT aging_group, COUNT(*) AS cnt, AVG(delay_days) AS avg_days
        FROM (
            SELECT
                CASE WHEN d BETWEEN 1 AND 3 THEN 'aging_1_3'
                     WHEN d BETWEEN 4 AND 7 THEN 'aging_4_7'
                     WHEN d BETWEEN 8 AND 14 THEN 'aging_8_14'
                     WHEN d >= 15 THEN 'aging_15_plus' END AS aging_group, d AS delay_days
            FROM (
                SELECT {d_expr} AS d
                FROM ({inner}) b
            ) t1
        ) t2 WHERE aging_group IS NOT NULL AND delay_days > 0
        GROUP BY aging_group
    """)
    result = await db.execute(sql, params)
    rows = {r["aging_group"]: r for r in result.mappings().all()}
    return [
        AgingGroup(aging_group=g, count=rows[g]["cnt"], avg_days=round(rows[g]["avg_days"], 1))
        for g in ["aging_1_3", "aging_4_7", "aging_8_14", "aging_15_plus"] if g in rows
    ]


# ── OTD Trend ────────────────────────────────────────────────────────────
# #6: Only delivered orders count. Total = delivered only.

@router.get("/otd-trend", response_model=list[TrendPoint])
async def get_otd_trend(
    start: date = Query(...),
    end: date = Query(...),
    ref_type: str = Query("rad1", pattern=REF_PATTERN),
    carrier: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    po: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params = {"start": start, "end": end, "today": date.today()}
    extra = _build_filters(params, carrier, model, po)

    if ref_type in ("rad1", "rad2"):
        ref = _ref_col(ref_type)
        inner = f"""
            SELECT order_date, delivered_dt, {ref} AS ref_date
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end
              AND delivered_dt IS NOT NULL {extra}
              AND {ref} IS NOT NULL 
            UNION ALL
            SELECT order_date, delivered_dt, {ref} AS ref_date
            FROM order_tracking_completed
            WHERE order_date BETWEEN :start AND :end
              AND delivered_dt IS NOT NULL {extra}
              AND {ref} IS NOT NULL 
        """
        on_time_case = """SUM(CASE
            WHEN (delivered_dt::date - ref_date::date) <= 0 THEN 1
            ELSE 0 END) AS on_time"""
    else:
        inner = f"""
            SELECT order_date, rsd,
                   CASE
                       WHEN carrier_code = 'LPTU' THEN rad
                       WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                       ELSE rad
                   END AS ref_target
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end {extra}
            UNION ALL
            SELECT order_date, rsd,
                   CASE
                       WHEN carrier_code = 'LPTU' THEN rad
                       WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                       ELSE rad
                   END AS ref_target
            FROM order_tracking_completed
            WHERE order_date BETWEEN :start AND :end {extra}
        """
        on_time_case = """SUM(CASE
            WHEN rsd IS NOT NULL AND ref_target IS NOT NULL AND (rsd::date - ref_target::date) <= 0 THEN 1
            ELSE 0 END) AS on_time"""

    sql = text(f"""
        SELECT order_date::date AS order_date, COUNT(*) AS total, {on_time_case}
        FROM ({inner}) t
        GROUP BY order_date::date ORDER BY order_date::date
    """)
    rows = (await db.execute(sql, params)).mappings().all()
    return [
        TrendPoint(date=r["order_date"], total=r["total"], on_time=r["on_time"],
                   otd_pct=round(r["on_time"] / r["total"] * 100, 1) if r["total"] else 0)
        for r in rows
    ]


# ── Delay Trend ──────────────────────────────────────────────────────────

@router.get("/delay-trend", response_model=list[DelayTrendPoint])
async def get_delay_trend(
    start: date = Query(...),
    end: date = Query(...),
    ref_type: str = Query("rad1", pattern=REF_PATTERN),
    carrier: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    po: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params = {"start": start, "end": end, "today": date.today()}
    extra = _build_filters(params, carrier, model, po)

    if ref_type in ("rad1", "rad2"):
        ref = _ref_col(ref_type)
        inner = f"""
            SELECT order_date,
                GREATEST(CASE WHEN delivered_dt IS NOT NULL THEN (delivered_dt::date - {ref}::date)
                              ELSE (:today - {ref}::date) END, 0) AS delay
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end {extra}
            UNION ALL
            SELECT order_date,
                GREATEST(CASE WHEN delivered_dt IS NOT NULL THEN (delivered_dt::date - {ref}::date)
                              ELSE (:today - {ref}::date) END, 0) AS delay
            FROM order_tracking_completed
            WHERE order_date BETWEEN :start AND :end {extra}
        """
    else:
        inner = f"""
            SELECT order_date,
                GREATEST(CASE WHEN rsd IS NOT NULL AND
                    CASE WHEN carrier_code = 'LPTU' THEN rad
                         WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                         ELSE rad END IS NOT NULL
                    THEN (rsd::date -
                        (CASE WHEN carrier_code = 'LPTU' THEN rad
                              WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                              ELSE rad END)::date)
                    ELSE 0 END, 0) AS delay
            FROM order_tracking_current
            WHERE order_date BETWEEN :start AND :end {extra}
            UNION ALL
            SELECT order_date,
                GREATEST(CASE WHEN rsd IS NOT NULL AND
                    CASE WHEN carrier_code = 'LPTU' THEN rad
                         WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                         ELSE rad END IS NOT NULL
                    THEN (rsd::date -
                        (CASE WHEN carrier_code = 'LPTU' THEN rad
                              WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
                              ELSE rad END)::date)
                    ELSE 0 END, 0) AS delay
            FROM order_tracking_completed
            WHERE order_date BETWEEN :start AND :end {extra}
        """

    sql = text(f"""
        SELECT order_date::date AS order_date,
            SUM(CASE WHEN delay > 0 THEN 1 ELSE 0 END) AS delayed_count,
            AVG(CASE WHEN delay > 0 THEN delay END) AS avg_delay_days
        FROM ({inner}) t
        GROUP BY order_date::date ORDER BY order_date::date
    """)
    rows = (await db.execute(sql, params)).mappings().all()
    return [
        DelayTrendPoint(date=r["order_date"], delayed=r["delayed_count"] or 0,
                avg_delay_days=round(r["avg_delay_days"], 1) if r["avg_delay_days"] else None)
        for r in rows
    ]


# ── Alert / Aging Trend ─────────────────────────────────────────────────

@router.get("/alert-aging-trend", response_model=list[AlertAgingTrendPoint])
async def get_alert_aging_trend(
    start: date = Query(...),
    end: date = Query(...),
    ref_type: str = Query("rad1", pattern=REF_PATTERN),
    carrier: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    po: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params = {"start": start, "end": end, "today": date.today()}
    extra = _build_filters(params, carrier, model, po)
    base = _base_union(ref_type, extra)

    alert = _alert_expr(ref_type)
    delayed = _delayed_expr(ref_type)

    sql = text(f"""
        SELECT order_date::date AS order_date,
            SUM(CASE WHEN {alert} THEN 1 ELSE 0 END) AS alert_count,
            SUM(CASE WHEN {delayed} THEN 1 ELSE 0 END) AS aging_count
        FROM {base}
        GROUP BY order_date::date ORDER BY order_date::date
    """)
    rows = (await db.execute(sql, params)).mappings().all()
    return [
        AlertAgingTrendPoint(date=r["order_date"], alert_count=r["alert_count"] or 0,
                             aging_count=r["aging_count"] or 0)
        for r in rows
    ]


# ── Stage Delay Trend (#14-2) ───────────────────────────────────────────
# Filters by current_stage, then shows trend of RED-colored orders

@router.get("/stage-delay-trend", response_model=StageDelayTrendResponse)
async def get_stage_delay_trend(
    stage: str = Query(..., description="Pipeline stage to analyze"),
    start: date = Query(...),
    end: date = Query(...),
    carrier: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    po: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    rule = STAGE_DELAY_RULES.get(stage)
    if not rule:
        return StageDelayTrendResponse(
            stage=stage,
            summary=StageDelaySummary(),
            trend=[],
        )

    params: dict = {"start": start, "end": end}
    extra = _build_filters(params, carrier, model, po)

    start_col = rule["start"]
    end_col = rule["end"]
    delay_expr = rule["delay_expr"]
    threshold_expr = rule["threshold_expr"]

    # Filter by current_stage = this stage, then find RED orders
    inner = f"""
        SELECT order_date, {delay_expr} AS delay_amount
        FROM order_tracking_current
        WHERE order_date BETWEEN :start AND :end
          AND current_stage = :stage
          AND {threshold_expr}
          {extra}
        UNION ALL
        SELECT order_date, {delay_expr} AS delay_amount
        FROM order_tracking_completed
        WHERE order_date BETWEEN :start AND :end
          AND current_stage = :stage
          AND {threshold_expr}
          {extra}
    """
    params["stage"] = stage

    trend_sql = text(f"""
        SELECT order_date::date AS order_date,
            COUNT(*) AS delayed_count,
            AVG(delay_amount) AS avg_delay
        FROM ({inner}) t
        GROUP BY order_date::date
        ORDER BY order_date::date
    """)
    trend_rows = (await db.execute(trend_sql, params)).mappings().all()

    trend = [
        StageDelayTrendPoint(
            date=r["order_date"],
            delayed=r["delayed_count"] or 0,
            avg_delay_days=round(float(r["avg_delay"]), 1) if r["avg_delay"] else None,
        )
        for r in trend_rows
    ]

    total_delayed = sum(t.delayed for t in trend)
    delayed_with_avg = [t for t in trend if t.avg_delay_days is not None and t.delayed > 0]

    if delayed_with_avg:
        weighted_sum = sum(t.avg_delay_days * t.delayed for t in delayed_with_avg)
        avg_delay = round(weighted_sum / total_delayed, 1) if total_delayed else None
        peak_day = max(delayed_with_avg, key=lambda t: t.delayed).date
    else:
        avg_delay = None
        peak_day = None

    return StageDelayTrendResponse(
        stage=stage,
        summary=StageDelaySummary(
            avg_delay=avg_delay,
            total_delayed=total_delayed,
            peak_delay_day=peak_day,
        ),
        trend=trend,
    )

