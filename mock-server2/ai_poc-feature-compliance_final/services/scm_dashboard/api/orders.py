"""Orders API — list & detail with SQL-level filtering, sorting, pagination.

CHANGES from original:
- #5:  line_status_code2 added to _COLS
- #13: All dates are TIMESTAMP — date comparisons use ::date cast
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from services.scm_dashboard.db.session import get_db
from services.scm_dashboard.schemas.dashboard import (
    OrderListResponse, OrderListItem, OrderDetailResponse,
    CommentItem, EtaUpdateItem,
)

router = APIRouter(prefix="/api/orders", tags=["Dashboard"])

REF_PATTERN = "^(rad1|rad2|rsd)$"

SORTABLE_COLS = {
    "sales_order_no", "order_line_id", "cust_po_no", "model_code",
    "carrier_code", "warehouse_code", "current_stage", "status_full",
    "line_status_code", "line_status_code2", "magento_po_created_at",
    "order_date", "gerp_booked_date", "back_order_date",
    "pick_release_date", "actual_shipment_date", "delivered_dt",
    "rad", "magento_rad2", "rsd", "load_id",
    "unit_selling_price", "include_tax_amount",
    "hub_received_dt", "out_for_delivery_dt", "am_st_pod_dt",
    "load_plan_date", "routed_date", "wms_shipped_date",
    "lt_total", "lt_backorder_hold", "lt_fulfillment", "lt_transit",
    "delay_days", "delivery_status",
}

_DEFAULT_ORDER = """
    ORDER BY
        CASE delivery_status
            WHEN 'delayed' THEN 1
            WHEN 'alert_dday' THEN 2
            WHEN 'warning' THEN 3
            WHEN 'on_track' THEN 4
            WHEN 'on_time' THEN 5
            ELSE 6
        END,
        delay_days DESC,
        order_date ASC
"""

# #5: added line_status_code2
_COLS = """sales_order_no, order_line_id, last_updated_dt,
    cust_po_no, model_code, bill_to_customer_code,
    unit_selling_price, line_status_code, line_status_code2, status_full,
    carrier_code, warehouse_code, current_stage,
    order_date, gerp_booked_date, back_order_date,
    pick_release_date, picking_date,
    actual_shipment_date, sales_date,
    load_plan_date, routed_date, wms_shipped_date,
    hub_received_dt, out_for_delivery_dt, delivered_dt,
    rad, rad_rescheduled, rsd,
    first_hold_name, hold_names, hold_dates, has_backorder_hold,
    lt_total, lt_backorder_hold, lt_fulfillment, lt_transit,
    consignee_name, contact_email_addr, include_tax_amount,
    shipping_address, consignee_phone_no,
    magento_rad2, magento_po_order_id, magento_customer_po_no,
    magento_po_created_at, magento_erp_exported_at, am_st_pod_dt, load_id"""


def _ref_col(ref_type: str) -> str:
    if ref_type == "rad1":
        return "rad"
    elif ref_type == "rad2":
        return "magento_rad2"
    return None


def _ref_target_expr() -> str:
    return """CASE
        WHEN carrier_code = 'LPTU' THEN rad
        WHEN carrier_code IN ('XPOT','LPHB') THEN rad - INTERVAL '2 days'
        ELSE rad
    END"""


def _mask_name(name: str) -> str:
    if not name:
        return name
    parts = name.strip().split()
    return ".".join(p[0].upper() for p in parts if p) + "."


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return email
    local, domain = email.split("@", 1)
    dom_parts = domain.split(".")
    return f"{local[0]}***@***.{dom_parts[-1]}"


def _mask_address(addr: str) -> str:
    if not addr:
        return addr
    parts = [p.strip() for p in addr.split(",")]
    if len(parts) >= 2:
        return ", ".join(parts[-2:])
    return parts[-1]


def _build_order_clause(sort_by: Optional[str], sort_dir: str) -> str:
    if sort_by and sort_by in SORTABLE_COLS:
        if sort_by == "delivery_status":
            return f"""
                ORDER BY
                    CASE delivery_status
                        WHEN 'delayed' THEN 1
                        WHEN 'alert_dday' THEN 2
                        WHEN 'warning' THEN 3
                        WHEN 'on_track' THEN 4
                        WHEN 'on_time' THEN 5
                        ELSE 6
                    END {"DESC" if sort_dir == "desc" else "ASC"}
            """
        return f"ORDER BY {sort_by} {sort_dir} NULLS LAST"
    return _DEFAULT_ORDER


def _base_select(ref_type: str, where: str) -> str:
    # #13: Use ::date for date comparisons on TIMESTAMP fields
    if ref_type in ("rad1", "rad2"):
        ref = _ref_col(ref_type)
        inner = f"""
            SELECT {_COLS}, {ref} AS ref_date, 'current' AS source
            FROM order_tracking_current WHERE {where}
            UNION ALL
            SELECT {_COLS}, {ref} AS ref_date, 'completed' AS source
            FROM order_tracking_completed WHERE {where}
        """
        return f"""
            SELECT *,
                CASE
                    WHEN current_stage = 'canceled' THEN 'canceled'
                    WHEN delivered_dt IS NOT NULL AND (delivered_dt::date - ref_date::date) <= 0 THEN 'on_time'
                    WHEN delivered_dt IS NOT NULL AND (delivered_dt::date - ref_date::date) > 0 THEN 'delayed'
                    WHEN delivered_dt IS NULL AND ref_date IS NOT NULL AND (:today - ref_date::date) > 0 THEN 'delayed'
                    WHEN delivered_dt IS NULL AND ref_date IS NOT NULL AND (:today - ref_date::date) = 0 THEN 'alert_dday'
                    WHEN delivered_dt IS NULL AND ref_date IS NOT NULL AND (:today - ref_date::date) = -1 THEN 'warning'
                    ELSE 'on_track'
                END AS delivery_status,
                CASE WHEN current_stage IN ('canceled') THEN 0
                    ELSE GREATEST(
                    CASE
                        WHEN delivered_dt IS NOT NULL THEN (delivered_dt::date - ref_date::date)
                        WHEN ref_date IS NOT NULL THEN (:today - ref_date::date)
                        ELSE 0
                    END, 0
                ) END AS delay_days,
                CASE WHEN current_stage IN ('canceled') THEN NULL
                    ELSE CASE
                    WHEN GREATEST(CASE WHEN delivered_dt IS NOT NULL THEN (delivered_dt::date - ref_date::date)
                         WHEN ref_date IS NOT NULL THEN (:today - ref_date::date) ELSE 0 END, 0) BETWEEN 1 AND 3 THEN 'aging_1_3'
                    WHEN GREATEST(CASE WHEN delivered_dt IS NOT NULL THEN (delivered_dt::date - ref_date::date)
                         WHEN ref_date IS NOT NULL THEN (:today - ref_date::date) ELSE 0 END, 0) BETWEEN 4 AND 7 THEN 'aging_4_7'
                    WHEN GREATEST(CASE WHEN delivered_dt IS NOT NULL THEN (delivered_dt::date - ref_date::date)
                         WHEN ref_date IS NOT NULL THEN (:today - ref_date::date) ELSE 0 END, 0) BETWEEN 8 AND 14 THEN 'aging_8_14'
                    WHEN GREATEST(CASE WHEN delivered_dt IS NOT NULL THEN (delivered_dt::date - ref_date::date)
                         WHEN ref_date IS NOT NULL THEN (:today - ref_date::date) ELSE 0 END, 0) >= 15 THEN 'aging_15_plus'
                    ELSE NULL
                END
                END AS aging_group
            FROM ({inner}) t
        """
    else:
        ref_target = _ref_target_expr()
        inner = f"""
            SELECT {_COLS}, rsd AS ref_date, ({ref_target})::date AS ref_target, 'current' AS source
            FROM order_tracking_current WHERE {where}
            UNION ALL
            SELECT {_COLS}, rsd AS ref_date, ({ref_target})::date AS ref_target, 'completed' AS source
            FROM order_tracking_completed WHERE {where}
        """
        return f"""
            SELECT *,
                CASE
                    WHEN ref_date IS NOT NULL AND ref_target IS NOT NULL AND (ref_date::date - ref_target) <= 0 THEN 'on_time'
                    WHEN ref_date IS NOT NULL AND ref_target IS NOT NULL AND (ref_date::date - ref_target) > 0 THEN 'delayed'
                    WHEN ref_date IS NOT NULL AND ref_target IS NOT NULL AND (ref_target - ref_date::date) = 1 THEN 'warning'
                    WHEN ref_date IS NOT NULL AND ref_target IS NOT NULL AND (ref_target - ref_date::date) = 0 THEN 'alert_dday'
                    ELSE 'on_track'
                END AS delivery_status,
                GREATEST(
                    CASE WHEN ref_date IS NOT NULL AND ref_target IS NOT NULL
                         THEN (ref_date::date - ref_target)
                         ELSE 0
                    END, 0
                ) AS delay_days,
                CASE
                    WHEN GREATEST(CASE WHEN ref_date IS NOT NULL AND ref_target IS NOT NULL
                         THEN (ref_date::date - ref_target) ELSE 0 END, 0) BETWEEN 1 AND 3 THEN 'aging_1_3'
                    WHEN GREATEST(CASE WHEN ref_date IS NOT NULL AND ref_target IS NOT NULL
                         THEN (ref_date::date - ref_target) ELSE 0 END, 0) BETWEEN 4 AND 7 THEN 'aging_4_7'
                    WHEN GREATEST(CASE WHEN ref_date IS NOT NULL AND ref_target IS NOT NULL
                         THEN (ref_date::date - ref_target) ELSE 0 END, 0) BETWEEN 8 AND 14 THEN 'aging_8_14'
                    WHEN GREATEST(CASE WHEN ref_date IS NOT NULL AND ref_target IS NOT NULL
                         THEN (ref_date::date - ref_target) ELSE 0 END, 0) >= 15 THEN 'aging_15_plus'
                    ELSE NULL
                END AS aging_group
            FROM ({inner}) t
        """


@router.get("", response_model=OrderListResponse)
async def list_orders(
    start: date = Query(...),
    end: date = Query(...),
    ref_type: str = Query("rad1", pattern=REF_PATTERN),
    po: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    carrier: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None, description="Column to sort by"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    where_parts = ["order_date BETWEEN :start AND :end"]
    params: dict = {"start": start, "end": end, "today": date.today()}

    if po:
        where_parts.append("cust_po_no = :po"); params["po"] = po
    if stage:
        where_parts.append("current_stage = :stage"); params["stage"] = stage
    if model:
        where_parts.append("model_code = :model"); params["model"] = model
    if carrier:
        where_parts.append("carrier_code = :carrier"); params["carrier"] = carrier

    w = " AND ".join(where_parts)
    base = _base_select(ref_type, w)

    if status == "backorder":
        outer = f"SELECT * FROM ({base}) enriched WHERE has_backorder_hold = 1"
    elif status == "aging":
        outer = f"SELECT * FROM ({base}) enriched WHERE delay_days > 0"
    elif status:
        outer = f"SELECT * FROM ({base}) enriched WHERE delivery_status = :status"
        params["status"] = status
    else:
        outer = f"SELECT * FROM ({base}) enriched"

    count_sql = text(f"SELECT COUNT(*) FROM ({outer}) counted")
    total = (await db.execute(count_sql, params)).scalar() or 0

    order_clause = _build_order_clause(sort_by, sort_dir)
    params["limit"] = size
    params["offset"] = (page - 1) * size

    data_sql = text(f"{outer} {order_clause} LIMIT :limit OFFSET :offset")
    rows = (await db.execute(data_sql, params)).mappings().all()

    return OrderListResponse(
        total=total,
        page=page,
        data=[OrderListItem(**dict(r)) for r in rows],
    )


@router.get("/{sales_order_no}/{order_line_id}", response_model=OrderDetailResponse)
async def get_order_detail(
    sales_order_no: str,
    order_line_id: str,
    ref_type: str = Query("rad1", pattern=REF_PATTERN),
    db: AsyncSession = Depends(get_db),
):
    params = {"so": sales_order_no, "li": order_line_id, "today": date.today()}

    if ref_type in ("rad1", "rad2"):
        ref = _ref_col(ref_type)
        status_expr = f"""
            CASE
                WHEN delivered_dt IS NOT NULL AND (delivered_dt::date - {ref}::date) <= 0 THEN 'on_time'
                WHEN delivered_dt IS NOT NULL AND (delivered_dt::date - {ref}::date) > 0 THEN 'delayed'
                WHEN delivered_dt IS NULL AND {ref} IS NOT NULL AND (:today - {ref}::date) > 0 THEN 'delayed'
                WHEN delivered_dt IS NULL AND {ref} IS NOT NULL AND (:today - {ref}::date) = 0 THEN 'alert_dday'
                WHEN delivered_dt IS NULL AND {ref} IS NOT NULL AND (:today - {ref}::date) = -1 THEN 'warning'
                ELSE 'on_track'
            END"""
        delay_expr = f"""GREATEST(
            CASE WHEN delivered_dt IS NOT NULL THEN (delivered_dt::date - {ref}::date)
                 WHEN {ref} IS NOT NULL THEN (:today - {ref}::date)
                 ELSE 0 END, 0)"""
    else:
        ref_target = _ref_target_expr()
        status_expr = f"""
            CASE
                WHEN rsd IS NOT NULL AND ({ref_target})::date IS NOT NULL AND (rsd::date - ({ref_target})::date) <= 0 THEN 'on_time'
                WHEN rsd IS NOT NULL AND ({ref_target})::date IS NOT NULL AND (rsd::date - ({ref_target})::date) > 0 THEN 'delayed'
                WHEN rsd IS NOT NULL AND ({ref_target})::date IS NOT NULL AND (({ref_target})::date - rsd::date) = 1 THEN 'warning'
                WHEN rsd IS NOT NULL AND ({ref_target})::date IS NOT NULL AND (({ref_target})::date - rsd::date) = 0 THEN 'alert_dday'
                ELSE 'on_track'
            END"""
        delay_expr = f"""GREATEST(
            CASE WHEN rsd IS NOT NULL AND ({ref_target})::date IS NOT NULL
                 THEN (rsd::date - ({ref_target})::date)
                 ELSE 0 END, 0)"""

    order_row = None
    for table, src in [("order_tracking_current", "current"), ("order_tracking_completed", "completed")]:
        sql = text(f"""
            SELECT *,
                '{src}' AS source,
                {status_expr} AS delivery_status,
                {delay_expr} AS delay_days
            FROM {table}
            WHERE sales_order_no = :so AND order_line_id = :li
        """)
        row = (await db.execute(sql, params)).mappings().first()
        if row:
            order_row = dict(row)
            break

    if not order_row:
        raise HTTPException(404, "Order not found")

    # Fetch comments
    comments_sql = text("""
        SELECT entity_id, comment, status, created_at
        FROM order_comments
        WHERE sales_order_no = :so AND order_line_id = :li
        ORDER BY created_at
    """)
    comment_rows = (await db.execute(comments_sql, params)).mappings().all()
    comments = [CommentItem(**dict(c)) for c in comment_rows]

    # Fetch ETA updates
    eta_sql = text("""
        SELECT history_id, source, send_email, eta_date_from, eta_date_to, created_at
        FROM order_eta_updates
        WHERE sales_order_no = :so AND order_line_id = :li
        ORDER BY created_at
    """)
    eta_rows = (await db.execute(eta_sql, params)).mappings().all()
    eta_updates = [EtaUpdateItem(**dict(e)) for e in eta_rows]

    # Mask PII
    order_row["consignee_name"] = _mask_name(order_row.get("consignee_name") or "")
    order_row["contact_email_addr"] = _mask_email(order_row.get("contact_email_addr") or "")
    order_row["shipping_address"] = _mask_address(order_row.get("shipping_address") or "")

    return OrderDetailResponse(
        order=OrderListItem(**order_row),
        comments=comments,
        eta_updates=eta_updates,
    )
