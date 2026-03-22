"""ETL main loop: extract → compute → compare → load.

CHANGES from original:
- #1:  Magento-first: fetch all Magento fulfillment rows, then LEFT JOIN AICDB results
- #2:  Delivered = D1/NS only (X1 removed). Fallback = sales_date + CLOSED only
- #5:  line_status_code and line_status_code2 extracted as separate columns
- #6:  order_date sourced from magento_po_created_at (not cust_po_date)
- #13: All date fields → TIMESTAMP (no DATE casts in extraction SQL)
- Extraction SQL: removed CAST AS DATE, keep raw timestamps
"""

import hashlib
import json
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from services.scm_dashboard.etl.stage import resolve_stage

logger = logging.getLogger(__name__)

# ── EXTRACTION SQL (runs against AICDB MySQL DB) ────────────────────────
# Changes:
# - Removed all CAST(... AS DATE): keep timestamps for #13
# - Removed X1 from edi_agg delivered_dt: only D1/NS per #2
# - Added line_status_code2 as separate column per #5
# - cust_po_date kept as timestamp (order_date will come from Magento)

EXTRACTION_SQL = """
WITH so_line AS (
    SELECT
        a.orig_sys_document_ref,
        a.orig_sys_line_ref,
        a.sales_order_no,
        a.order_line_id,
        a.order_header_id,
        a.cust_po_no,
        a.cust_po_date,
        a.model_code,
        a.bill_to_customer_code,
        a.unit_selling_price,
        a.line_status_code,
        a.line_status_code2,
        a.booked_date,
        a.pick_release_date,
        a.picking_date,
        a.actual_shipment_date,
        a.sales_date,
        a.fulfillment_date,
        a.init_promised_arrival_date,
        a.promised_arrival_date,
        a.schedule_ship_date,
        a.promised_ship_date,
        a.request_shipping_date,
        LEFT(a.store_code, 4)          AS carrier_code,
        a.warehouse_code,
        a.line_no,
        a.transfer_date,
        a.consignee_name,
        a.contact_email_addr,
        a.include_tax_amount,
        a.consignee_phone_no,
        a.consignee_addr1_info,
        a.consignee_addr2_info,
        a.consignee_city_name,
        a.consignee_state_name,
        a.consignee_postal_code,
        ROW_NUMBER() OVER (
            PARTITION BY a.orig_sys_document_ref, a.orig_sys_line_ref
            ORDER BY a.transfer_date DESC
        ) AS rn
    FROM xxomds_so_line_if a
    WHERE a.order_category_code    = 'ORDER'
      AND a.subinventory_code      = 'GOODSET'
      AND a.ship_to_customer_code IN ('US074178-LMD-S','US074178P-LMD-S','US074178E-LMD-S')
      AND a.cust_po_date BETWEEN :date_range_start AND :date_range_end
),

slf AS (
    SELECT * FROM so_line WHERE rn = 1
),

so_line_hold AS (
    SELECT
        c.sales_order_no,
        c.line_no,
        c.transfer_date AS back_order_date,
        ROW_NUMBER() OVER (
            PARTITION BY c.orig_sys_document_ref, c.orig_sys_line_ref
            ORDER BY c.transfer_date ASC
        ) AS rn2
    FROM xxomds_so_line_if c
    INNER JOIN slf
        ON c.orig_sys_document_ref = slf.orig_sys_document_ref
       AND c.orig_sys_line_ref     = slf.orig_sys_line_ref
    WHERE c.order_category_code  = 'ORDER'
      AND c.subinventory_code    = 'GOODSET'
      AND c.ship_to_customer_code IN ('US074178-LMD-S','US074178P-LMD-S','US074178E-LMD-S')
      AND c.line_status_code     = 'BOOKED'
      AND c.line_status_code2    = 'BACK'
      AND c.transfer_date        > :lookback_date
),

hold_agg AS (
    SELECT
        d.order_no,
        d.order_line_id,
        SUBSTRING_INDEX(
            GROUP_CONCAT(d.hold_name ORDER BY d.order_hold_id SEPARATOR '|'), '|', 1
        ) AS first_hold_name,
        GROUP_CONCAT(IFNULL(d.hold_name,'NULL')  ORDER BY d.order_hold_id SEPARATOR '|') AS hold_names,
        GROUP_CONCAT(IFNULL(d.hold_date,'NULL')  ORDER BY d.order_hold_id SEPARATOR '|') AS hold_dates,
        GROUP_CONCAT(IFNULL(d.release_date,'NULL') ORDER BY d.order_hold_id SEPARATOR '|') AS release_dates,
        MAX(CASE
            WHEN d.release_date IS NULL
                 AND (5 * (DATEDIFF(CURDATE(), d.hold_date) DIV 7)
                      + MID('0123444401233334012222340111123400012345001234550',
                            7 * WEEKDAY(d.hold_date) + WEEKDAY(CURDATE()) + 1, 1)) > 2
                 THEN 1
            WHEN d.release_date IS NOT NULL
                 AND (5 * (DATEDIFF(d.release_date, d.hold_date) DIV 7)
                      + MID('0123444401233334012222340111123400012345001234550',
                            7 * WEEKDAY(d.hold_date) + WEEKDAY(d.release_date) + 1, 1)) > 2
                 THEN 1
            ELSE 0
        END) AS has_backorder_hold
    FROM xxomds_order_hold_s_if d
    WHERE d.transfer_date > :lookback_date
        AND d.hold_name IN ('BACK_ORDER_HOLD', 'OVERDUE_HOLD', 'FP_HOLD')
    GROUP BY d.order_no, d.order_line_id
),

wms_agg AS (
    SELECT
        h.order_no,
        h.order_line_id,
        MAX(CASE WHEN h.status = '02' THEN h.create_date END) AS load_plan_date,
        MAX(CASE WHEN h.status = '03' THEN h.create_date END) AS routed_date,
        MAX(CASE WHEN h.status = '07' THEN h.create_date END) AS wms_shipped_date
    FROM tmr_inf_wms_status h
    WHERE h.interface_date > :lookback_date
    GROUP BY h.order_no, h.order_line_id
),

edi_agg AS (
    SELECT
        f.cust_sales_order_no,
        f.attribute1 AS model,
        MAX(f.load_id) AS load_id,
        MAX(CASE WHEN f.event_cd = 'X4' AND f.pod_desc = 'NS'
            THEN f.pod_dt END)                                   AS hub_received_pod_dt,
        MAX(CASE WHEN f.event_cd = 'AM' AND f.pod_desc = 'ST'
            THEN f.pod_dt END)                                   AS am_st_pod_dt,
        MAX(CASE WHEN f.event_cd = 'X4' AND f.pod_desc = 'NS'
            THEN f.pod_dt END)                              AS hub_received_dt,
        MAX(CASE WHEN f.event_cd = 'AM' AND f.pod_desc = 'NS'
            THEN f.pod_dt END)                                   AS out_delivery_pod_dt,
        MAX(CASE WHEN f.event_cd = 'D1' AND f.pod_desc = 'NS'
            THEN f.pod_dt END)                                   AS completed_pod_dt,
        MAX(CASE WHEN f.event_cd = 'D1' AND f.pod_desc = 'NS'
            THEN f.pod_dt END)                                   AS delivered_dt,
        MAX(CASE WHEN f.event_cd = 'AG' AND f.pod_desc = 'CS'
            THEN 1 ELSE 0 END)                                   AS has_cust_reschedule,
        MAX(CASE WHEN f.event_cd NOT IN ('AG','X4','AM','D1')
             OR  (f.event_cd = 'AG' AND f.pod_desc NOT IN ('NS','CS'))
            THEN 1 ELSE 0 END)                                   AS has_schedule_update
    FROM xxtms_ifr_tms_edi_214_pod_hd f
    WHERE f.transfer_date > :lookback_date
      AND (f.event_cd, f.pod_desc) IN (
          ('AG','NS'),('AG','CS'),('AG','IT'),('AG','DC'),
          ('AG','LM'),('AG','WW'),('X4','NS'),('AM','NS'),
          ('AM','ST'),('D1','NS'))
    GROUP BY f.cust_sales_order_no, f.attribute1
)

SELECT
    slf.sales_order_no,
    slf.order_line_id,
    slf.cust_po_no,
    slf.model_code,
    slf.bill_to_customer_code,
    slf.unit_selling_price,
    slf.line_status_code,
    slf.line_status_code2,
    CONCAT_WS('/', slf.line_status_code, slf.line_status_code2)  AS status_full,
    slf.carrier_code,
    slf.warehouse_code,
    slf.consignee_name,
    slf.contact_email_addr,
    slf.include_tax_amount,
    CONCAT_WS(', ',
        slf.consignee_addr1_info,
        slf.consignee_addr2_info,
        slf.consignee_city_name,
        CONCAT(slf.consignee_state_name, ' ', slf.consignee_postal_code)
    ) AS shipping_address,
    slf.consignee_phone_no,

    slf.cust_po_date                              AS cust_po_date,
    slf.booked_date                               AS gerp_booked_date,
    slih.back_order_date                          AS back_order_date,
    slf.pick_release_date                         AS pick_release_date,
    slf.picking_date                              AS picking_date,
    slf.actual_shipment_date                      AS actual_shipment_date,
    slf.sales_date                                AS sales_date,
    slf.fulfillment_date                          AS fulfillment_date,
    wms.load_plan_date                            AS load_plan_date,
    wms.routed_date                               AS routed_date,
    wms.wms_shipped_date                          AS wms_shipped_date,
    edi.hub_received_dt                           AS hub_received_dt,
    edi.out_delivery_pod_dt                       AS out_for_delivery_dt,
    edi.delivered_dt                               AS delivered_dt,

    slf.init_promised_arrival_date                AS rad,
    CASE WHEN slf.promised_arrival_date <> slf.init_promised_arrival_date
         THEN slf.promised_arrival_date
         ELSE NULL
    END                                           AS rad_rescheduled,
    slf.promised_ship_date                        AS rsd,
    slf.request_shipping_date                     AS request_shipping_date,

    h.first_hold_name,
    h.hold_names,
    h.hold_dates,
    h.release_dates,
    CASE
    WHEN IFNULL(h.has_backorder_hold, 0) = 1
         AND (slf.pick_release_date IS NOT NULL
              OR slf.actual_shipment_date IS NOT NULL
              OR slf.sales_date IS NOT NULL
              OR slf.fulfillment_date IS NOT NULL)
    THEN 0
    ELSE IFNULL(h.has_backorder_hold, 0)
    END AS has_backorder_hold,

    IFNULL(edi.has_cust_reschedule, 0)            AS has_cust_reschedule,
    IFNULL(edi.has_schedule_update, 0)            AS has_schedule_update,

    edi.hub_received_pod_dt,
    edi.load_id,
    edi.am_st_pod_dt,
    edi.out_delivery_pod_dt                       AS out_delivery_pod_dt_raw,
    edi.completed_pod_dt

FROM slf
LEFT JOIN (SELECT * FROM so_line_hold WHERE rn2 = 1) slih
    ON slf.sales_order_no = slih.sales_order_no
   AND slf.line_no        = slih.line_no
LEFT JOIN hold_agg h
    ON slf.sales_order_no = h.order_no
   AND slf.order_line_id  = h.order_line_id
LEFT JOIN wms_agg wms
    ON slf.sales_order_no = wms.order_no
   AND slf.order_line_id  = wms.order_line_id
LEFT JOIN edi_agg edi
    ON slf.sales_order_no = edi.cust_sales_order_no
   AND slf.model_code     = edi.model
ORDER BY slf.cust_po_date, slf.orig_sys_document_ref, slf.orig_sys_line_ref;
"""


def _safe_ts(val) -> Optional[datetime]:
    """Convert any value to datetime (timestamp). DATE → midnight."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, date):
        return datetime(val.year, val.month, val.day)
    try:
        s = str(val).strip()
        if len(s) == 10:
            return datetime.fromisoformat(s)
        return datetime.fromisoformat(s[:19])
    except (ValueError, TypeError):
        return None


def _compute_hash(row: dict) -> str:
    keys = sorted(k for k in row if k not in (
        "content_hash", "snapshot_dt", "last_updated_dt", "completed_dt"
    ))
    payload = json.dumps({k: str(row[k]) if row[k] is not None else None for k in keys},
                         sort_keys=True)
    return hashlib.md5(payload.encode()).hexdigest()


# ── SQL target statements (PostgreSQL) ───────────────────────────────────

# #13: All fields are now TIMESTAMP — no separate DATE list
_TS_FIELDS = [
    "gerp_booked_date", "back_order_date", "pick_release_date", "picking_date",
    "actual_shipment_date", "sales_date", "fulfillment_date",
    "load_plan_date", "routed_date", "wms_shipped_date",
    "hub_received_dt", "out_for_delivery_dt", "delivered_dt",
    "rad", "rad_rescheduled", "rsd",
    "am_st_pod_dt", "order_date",
    "magento_po_created_at", "magento_erp_exported_at",
]

_COLS = """
    sales_order_no, order_line_id, last_updated_dt,
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
    magento_po_created_at, magento_erp_exported_at, am_st_pod_dt, load_id
"""

_VALS = """
    :sales_order_no, :order_line_id, :snapshot_dt,
    :cust_po_no, :model_code, :bill_to_customer_code,
    :unit_selling_price, :line_status_code, :line_status_code2, :status_full,
    :carrier_code, :warehouse_code, :current_stage,
    :order_date, :gerp_booked_date, :back_order_date,
    :pick_release_date, :picking_date,
    :actual_shipment_date, :sales_date,
    :load_plan_date, :routed_date, :wms_shipped_date,
    :hub_received_dt, :out_for_delivery_dt, :delivered_dt,
    :rad, :rad_rescheduled, :rsd,
    :first_hold_name, :hold_names, :hold_dates, :has_backorder_hold,
    :lt_total, :lt_backorder_hold, :lt_fulfillment, :lt_transit,
    :consignee_name, :contact_email_addr, :include_tax_amount,
    :shipping_address, :consignee_phone_no,
    :magento_rad2, :magento_po_order_id, :magento_customer_po_no,
    :magento_po_created_at, :magento_erp_exported_at, :am_st_pod_dt, :load_id
"""

_UPDATE_SET = """
    last_updated_dt = EXCLUDED.last_updated_dt,
    cust_po_no = EXCLUDED.cust_po_no, model_code = EXCLUDED.model_code,
    bill_to_customer_code = EXCLUDED.bill_to_customer_code,
    unit_selling_price = EXCLUDED.unit_selling_price,
    line_status_code = EXCLUDED.line_status_code,
    line_status_code2 = EXCLUDED.line_status_code2,
    status_full = EXCLUDED.status_full,
    carrier_code = EXCLUDED.carrier_code, warehouse_code = EXCLUDED.warehouse_code,
    current_stage = EXCLUDED.current_stage,
    order_date = EXCLUDED.order_date, gerp_booked_date = EXCLUDED.gerp_booked_date,
    back_order_date = EXCLUDED.back_order_date,
    pick_release_date = EXCLUDED.pick_release_date, picking_date = EXCLUDED.picking_date,
    actual_shipment_date = EXCLUDED.actual_shipment_date, sales_date = EXCLUDED.sales_date,
    load_plan_date = EXCLUDED.load_plan_date, routed_date = EXCLUDED.routed_date,
    wms_shipped_date = EXCLUDED.wms_shipped_date,
    hub_received_dt = EXCLUDED.hub_received_dt,
    out_for_delivery_dt = EXCLUDED.out_for_delivery_dt,
    delivered_dt = EXCLUDED.delivered_dt,
    rad = EXCLUDED.rad, rad_rescheduled = EXCLUDED.rad_rescheduled, rsd = EXCLUDED.rsd,
    first_hold_name = EXCLUDED.first_hold_name,
    hold_names = EXCLUDED.hold_names, hold_dates = EXCLUDED.hold_dates,
    has_backorder_hold = EXCLUDED.has_backorder_hold,
    lt_total = EXCLUDED.lt_total, lt_backorder_hold = EXCLUDED.lt_backorder_hold,
    lt_fulfillment = EXCLUDED.lt_fulfillment, lt_transit = EXCLUDED.lt_transit,
    consignee_name = EXCLUDED.consignee_name,
    contact_email_addr = EXCLUDED.contact_email_addr,
    include_tax_amount = EXCLUDED.include_tax_amount,
    shipping_address = EXCLUDED.shipping_address,
    consignee_phone_no = EXCLUDED.consignee_phone_no,
    magento_rad2 = EXCLUDED.magento_rad2,
    magento_po_order_id = EXCLUDED.magento_po_order_id,
    magento_customer_po_no = EXCLUDED.magento_customer_po_no,
    magento_po_created_at = EXCLUDED.magento_po_created_at,
    magento_erp_exported_at = EXCLUDED.magento_erp_exported_at,
    am_st_pod_dt = EXCLUDED.am_st_pod_dt,
    load_id = EXCLUDED.load_id
"""

UPSERT_CURRENT = text(f"""
    INSERT INTO order_tracking_current ({_COLS})
    VALUES ({_VALS})
    ON CONFLICT (sales_order_no, order_line_id) DO UPDATE SET {_UPDATE_SET}
""")

UPSERT_COMPLETED = text(f"""
    INSERT INTO order_tracking_completed (completed_dt, {_COLS})
    VALUES (:snapshot_dt, {_VALS})
    ON CONFLICT (sales_order_no, order_line_id) DO UPDATE SET
        completed_dt = EXCLUDED.completed_dt, {_UPDATE_SET}
""")

UPSERT_COMMENTS = text("""
    INSERT INTO order_comments
        (entity_id, sales_order_no, order_line_id, comment, status, created_at)
    VALUES
        (:entity_id, :sales_order_no, :order_line_id, :comment, :status, :created_at)
    ON CONFLICT (entity_id) DO UPDATE SET
        comment = EXCLUDED.comment, status = EXCLUDED.status, created_at = EXCLUDED.created_at
""")

UPSERT_ETA_UPDATES = text("""
    INSERT INTO order_eta_updates
        (history_id, sales_order_no, order_line_id,
         source, send_email, eta_date_from, eta_date_to, created_at)
    VALUES
        (:history_id, :sales_order_no, :order_line_id,
         :source, :send_email, :eta_date_from, :eta_date_to, :created_at)
    ON CONFLICT (history_id) DO UPDATE SET
        source = EXCLUDED.source, send_email = EXCLUDED.send_email,
        eta_date_from = EXCLUDED.eta_date_from, eta_date_to = EXCLUDED.eta_date_to,
        created_at = EXCLUDED.created_at
""")

BATCH_SIZE = 500


def _lt(end, start) -> Optional[int]:
    """Lead time in days. Both must be non-None."""
    if end and start:
        if isinstance(end, datetime):
            end_d = end.date() if hasattr(end, 'date') else end
        elif isinstance(end, date):
            end_d = end
        else:
            return None
        if isinstance(start, datetime):
            start_d = start.date() if hasattr(start, 'date') else start
        elif isinstance(start, date):
            start_d = start
        else:
            return None
        return (end_d - start_d).days
    return None


def _prepare_row(raw: dict, snapshot_dt: datetime) -> dict:
    row = dict(raw)

    # #13: Convert all date/timestamp fields to proper timestamps
    for f in _TS_FIELDS:
        row[f] = _safe_ts(row.get(f))

    # #2: delivered_dt fallback — only if sales_date exists AND line_status_code='CLOSED'
    if not row["delivered_dt"] and row.get("sales_date") and row.get("line_status_code") == "CLOSED":
        row["delivered_dt"] = row["sales_date"]

    # Lead times (still in days)
    row["lt_total"] = _lt(row["delivered_dt"], row["order_date"])
    row["lt_backorder_hold"] = _lt(row["pick_release_date"], row["back_order_date"])
    row["lt_fulfillment"] = _lt(row["actual_shipment_date"], row["load_plan_date"])
    row["lt_transit"] = _lt(row["delivered_dt"], row["actual_shipment_date"])

    # Init Magento fields
    for mf in ("magento_rad2", "magento_po_order_id", "magento_customer_po_no",
               "magento_po_created_at", "magento_erp_exported_at"):
        row.setdefault(mf, None)

    # #5: ensure line_status_code2 exists
    row.setdefault("line_status_code2", None)

    row["snapshot_dt"] = snapshot_dt

    for col in ("order_line_id", "cust_po_no", "sales_order_no"):
        if row.get(col) is not None:
            row[col] = str(row[col])

    row.setdefault("load_id", None)

    return row


async def _batch_execute(db: AsyncSession, stmt, rows: list[dict]):
    for i in range(0, len(rows), BATCH_SIZE):
        await db.execute(stmt, rows[i:i + BATCH_SIZE])


async def _fetch_all_magento_fulfillment(magento_db: AsyncSession, date_start, date_end) -> list[dict]:
    """#1: Fetch ALL Magento fulfillment rows for date range. This is now the base."""
    sql = text("""
        SELECT erp_order_line_id,
            po_order_id       AS magento_po_order_id,
            customer_po_no    AS magento_customer_po_no,
            po_created_at     AS magento_po_created_at,
            erp_exported_at   AS magento_erp_exported_at,
            latest_rad        AS magento_rad2,
            export_status     AS magento_export_status,
            qty_canceled      AS magento_qty_canceled,
            qty_refunded      AS magento_qty_refunded
        FROM lg_vw_scm_order_item_fulfillment
        WHERE po_created_at BETWEEN :start AND :end
    """)
    rows = (await magento_db.execute(sql, {"start": date_start, "end": date_end})).mappings().all()
    return [dict(r) for r in rows]


async def _fetch_aicdb_by_line_ids(source_db: AsyncSession, line_ids: list,
                                    date_range_start, date_range_end, lookback_date) -> dict:
    """Fetch AICDB data and index by order_line_id for merging."""
    if not line_ids:
        return {}

    result = await source_db.execute(
        text(EXTRACTION_SQL),
        {"date_range_start": date_range_start,
         "date_range_end": date_range_end,
         "lookback_date": lookback_date},
    )
    raw_rows = result.mappings().all()

    aicdb_map = {}
    for r in raw_rows:
        key = str(r["order_line_id"])
        aicdb_map[key] = dict(r)
    return aicdb_map


async def _fetch_and_upsert_comments(
    magento_db: AsyncSession, scm_db: AsyncSession,
    po_id_to_order: dict,
):
    po_ids = list(po_id_to_order.keys())
    if not po_ids:
        return 0
    rows = []
    for i in range(0, len(po_ids), BATCH_SIZE):
        chunk = po_ids[i:i + BATCH_SIZE]
        ph = ", ".join(f":pid_{j}" for j in range(len(chunk)))
        params = {f"pid_{j}": v for j, v in enumerate(chunk)}
        sql = text(f"""
            SELECT entity_id, parent_id, comment, status, created_at
            FROM sales_order_status_history
            WHERE parent_id IN ({ph})
        """)
        for r in (await magento_db.execute(sql, params)).mappings().all():
            info = po_id_to_order.get(r["parent_id"])
            if info:
                rows.append({
                    "entity_id": r["entity_id"],
                    "sales_order_no": info["sales_order_no"],
                    "order_line_id": info["order_line_id"],
                    "comment": r["comment"],
                    "status": r["status"],
                    "created_at": r["created_at"],
                })
    if rows:
        await _batch_execute(scm_db, UPSERT_COMMENTS, rows)
    logger.info("ETL: %d comments upserted", len(rows))
    return len(rows)


async def _fetch_and_upsert_eta(
    magento_db: AsyncSession, scm_db: AsyncSession,
    cpo_to_order: dict,
):
    cpo_ids = list(cpo_to_order.keys())
    if not cpo_ids:
        return 0
    rows = []
    for i in range(0, len(cpo_ids), BATCH_SIZE):
        chunk = cpo_ids[i:i + BATCH_SIZE]
        ph = ", ".join(f":cid_{j}" for j in range(len(chunk)))
        params = {f"cid_{j}": v for j, v in enumerate(chunk)}
        sql = text(f"""
            SELECT history_id, order_increment_id, source, send_email,
                   eta_date_from, eta_date_to, created_at
            FROM lg_sales_order_eta_update_history
            WHERE order_increment_id IN ({ph})
        """)
        for r in (await magento_db.execute(sql, params)).mappings().all():
            info = cpo_to_order.get(r["order_increment_id"])
            if info:
                rows.append({
                    "history_id": r["history_id"],
                    "sales_order_no": info["sales_order_no"],
                    "order_line_id": info["order_line_id"],
                    "source": r["source"],
                    "send_email": r["send_email"],
                    "eta_date_from": r["eta_date_from"],
                    "eta_date_to": r["eta_date_to"],
                    "created_at": r["created_at"],
                })
    if rows:
        await _batch_execute(scm_db, UPSERT_ETA_UPDATES, rows)
    logger.info("ETL: %d eta updates upserted", len(rows))
    return len(rows)


async def run_etl(
    source_db: AsyncSession,
    scm_db: AsyncSession,
    date_range_start: date,
    date_range_end: date,
    magento_db: AsyncSession = None,
):
    snapshot_dt = datetime.now()

    # ── #1: Magento-first approach ──────────────────────────────────────
    # Step 1: Fetch ALL Magento fulfillment rows for the date range
    magento_rows = []
    if magento_db:
        magento_rows = await _fetch_all_magento_fulfillment(
            magento_db, date_range_start, date_range_end
        )
        logger.info("ETL: fetched %d Magento fulfillment rows", len(magento_rows))

    # Step 2: Extract AICDB data (still uses full extraction SQL)
    result = await source_db.execute(
        text(EXTRACTION_SQL),
        {"date_range_start": date_range_start,
         "date_range_end": date_range_end,
         "lookback_date": date_range_start},
    )
    raw_aicdb = result.mappings().all()
    logger.info("ETL: extracted %d AICDB rows", len(raw_aicdb))

    # Index AICDB rows by order_line_id for LEFT JOIN
    aicdb_map = {}
    for r in raw_aicdb:
        key = str(r["order_line_id"])
        aicdb_map[key] = dict(r)

    # Step 3: Merge — Magento LEFT JOIN AICDB
    all_rows = []
    seen_line_ids = set()

    for mg in magento_rows:
        line_id = str(mg["erp_order_line_id"])
        seen_line_ids.add(line_id)

        aicdb = aicdb_map.get(line_id)
        if aicdb:
            # AICDB match found — start from AICDB row, overlay Magento
            row = _prepare_row(aicdb, snapshot_dt)
        else:
            # No AICDB match — Magento-only row. Skip.
            continue

        # Overlay Magento fields
        row["magento_rad2"] = _safe_ts(mg.get("magento_rad2"))
        row["magento_po_order_id"] = mg.get("magento_po_order_id")
        row["magento_customer_po_no"] = mg.get("magento_customer_po_no")
        row["magento_po_created_at"] = _safe_ts(mg.get("magento_po_created_at"))
        row["magento_erp_exported_at"] = _safe_ts(mg.get("magento_erp_exported_at"))
        # In-memory only for stage resolution
        row["magento_export_status"] = mg.get("magento_export_status")
        row["magento_qty_canceled"] = mg.get("magento_qty_canceled")
        row["magento_qty_refunded"] = mg.get("magento_qty_refunded")

        # #6: order_date = magento_po_created_at
        row["order_date"] = row["magento_po_created_at"]

         # Recalculate lt_total after order_date is set
        row["lt_total"] = _lt(row["delivered_dt"], row["order_date"])

        all_rows.append(row)

    # Also include AICDB rows that weren't in Magento (should be rare with Magento-first)
    # for line_id, aicdb in aicdb_map.items():
    #     if line_id not in seen_line_ids:
    #         row = _prepare_row(aicdb, snapshot_dt)
    #         # #6: order_date = magento_po_created_at (will be None if no Magento match)
    #         # Fall back to cust_po_date if no Magento
    #         if not row.get("magento_po_created_at"):
    #             row["order_date"] = _safe_ts(aicdb.get("cust_po_date"))
    #         else:
    #             row["order_date"] = row["magento_po_created_at"]
    #         all_rows.append(row)

    logger.info("ETL: magento %d + aicdb-only %d = total %d rows",
                len(seen_line_ids),
                len(all_rows) - len(seen_line_ids),
                len(all_rows))

    # Step 3.5: Resolve stage (after merge)
    for row in all_rows:
        row["current_stage"] = resolve_stage(row)

    # Step 4: Split current / completed
    current_rows = []
    completed_rows = []
    for row in all_rows:
        # Skip rows with no sales_order_no (Magento-only, no ERP PK yet)
        if not row.get("sales_order_no"):
            continue
        is_done = row["current_stage"] == "delivered" or row.get("line_status_code") == "CLOSED"
        (completed_rows if is_done else current_rows).append(row)

    # Step 5: Batch upsert current
    if current_rows:
        await _batch_execute(scm_db, UPSERT_CURRENT, current_rows)

    # Step 6: Batch upsert completed
    if completed_rows:
        await _batch_execute(scm_db, UPSERT_COMPLETED, completed_rows)

        # Step 7: Delete completed from current table
        done_keys = [(r["sales_order_no"], r["order_line_id"]) for r in completed_rows]
        for i in range(0, len(done_keys), BATCH_SIZE):
            chunk = done_keys[i:i + BATCH_SIZE]
            ph = ", ".join(f"(:so_{j}, :li_{j})" for j in range(len(chunk)))
            params = {}
            for j, (so, li) in enumerate(chunk):
                params[f"so_{j}"] = so
                params[f"li_{j}"] = li
            await scm_db.execute(
                text(f"DELETE FROM order_tracking_current "
                     f"WHERE (sales_order_no, order_line_id) IN ({ph})"),
                params,
            )

    # Step 8: Comments + ETA
    if magento_db:
        po_id_to_order = {}
        cpo_to_order = {}
        for row in all_rows:
            if not row.get("sales_order_no"):
                continue
            info = {"sales_order_no": row["sales_order_no"],
                    "order_line_id": str(row["order_line_id"])}
            if row.get("magento_po_order_id"):
                po_id_to_order[row["magento_po_order_id"]] = info
            if row.get("magento_customer_po_no"):
                cpo_to_order[row["magento_customer_po_no"]] = info

        await _fetch_and_upsert_comments(magento_db, scm_db, po_id_to_order)
        await _fetch_and_upsert_eta(magento_db, scm_db, cpo_to_order)

    await scm_db.commit()
    logger.info("ETL: %d current, %d completed", len(current_rows), len(completed_rows))
    return {"upserted": len(current_rows), "completed": len(completed_rows)}

# """ETL main loop: extract → compute → compare → load.

# Source DB: MySQL (unchanged)
# Target DB: PostgreSQL (ON CONFLICT ... DO UPDATE)
# """

# import hashlib
# import json
# import logging
# from datetime import date, datetime, timedelta
# from typing import Optional

# from sqlalchemy import text
# from sqlalchemy.ext.asyncio import AsyncSession

# from services.scm_dashboard.etl.stage import resolve_stage

# logger = logging.getLogger(__name__)

# # ── EXTRACTION SQL (runs against SOURCE MySQL DB — unchanged) ────────────

# EXTRACTION_SQL = """
# WITH so_line AS (
#     SELECT
#         a.orig_sys_document_ref,
#         a.orig_sys_line_ref,
#         a.sales_order_no,
#         a.order_line_id,
#         a.order_header_id,
#         a.cust_po_no,
#         a.cust_po_date,
#         a.model_code,
#         a.bill_to_customer_code,
#         a.unit_selling_price,
#         a.line_status_code,
#         a.line_status_code2,
#         a.booked_date,
#         a.pick_release_date,
#         a.picking_date,
#         a.actual_shipment_date,
#         a.sales_date,
#         a.fulfillment_date,
#         a.init_promised_arrival_date,
#         a.promised_arrival_date,
#         a.schedule_ship_date,
#         a.promised_ship_date,
#         a.request_shipping_date,
#         LEFT(a.store_code, 4)          AS carrier_code,
#         a.warehouse_code,
#         a.line_no,
#         a.transfer_date,
#         a.consignee_name,
#         a.contact_email_addr,
#         a.include_tax_amount,
#         a.consignee_phone_no,
#         a.consignee_addr1_info,
#         a.consignee_addr2_info,
#         a.consignee_city_name,
#         a.consignee_state_name,
#         a.consignee_postal_code,
#         ROW_NUMBER() OVER (
#             PARTITION BY a.orig_sys_document_ref, a.orig_sys_line_ref
#             ORDER BY a.transfer_date DESC
#         ) AS rn
#     FROM xxomds_so_line_if a
#     WHERE a.order_category_code    = 'ORDER'
#       AND a.subinventory_code      = 'GOODSET'
#       AND a.ship_to_customer_code IN ('US074178-LMD-S','US074178P-LMD-S','US074178E-LMD-S')
#       AND a.cust_po_date BETWEEN :date_range_start AND :date_range_end
# ),

# slf AS (
#     SELECT * FROM so_line WHERE rn = 1
# ),

# so_line_hold AS (
#     SELECT
#         c.sales_order_no,
#         c.line_no,
#         c.transfer_date AS back_order_date,
#         ROW_NUMBER() OVER (
#             PARTITION BY c.orig_sys_document_ref, c.orig_sys_line_ref
#             ORDER BY c.transfer_date ASC
#         ) AS rn2
#     FROM xxomds_so_line_if c
#     INNER JOIN slf
#         ON c.orig_sys_document_ref = slf.orig_sys_document_ref
#        AND c.orig_sys_line_ref     = slf.orig_sys_line_ref
#     WHERE c.order_category_code  = 'ORDER'
#       AND c.subinventory_code    = 'GOODSET'
#       AND c.ship_to_customer_code IN ('US074178-LMD-S','US074178P-LMD-S','US074178E-LMD-S')
#       AND c.line_status_code     = 'BOOKED'
#       AND c.line_status_code2    = 'BACK'
#       AND c.transfer_date        > :lookback_date
# ),

# hold_agg AS (
#     SELECT
#         d.order_no,
#         d.order_line_id,
#         SUBSTRING_INDEX(
#             GROUP_CONCAT(d.hold_name ORDER BY d.order_hold_id SEPARATOR '|'), '|', 1
#         ) AS first_hold_name,
#         GROUP_CONCAT(IFNULL(d.hold_name,'NULL')  ORDER BY d.order_hold_id SEPARATOR '|') AS hold_names,
#         GROUP_CONCAT(IFNULL(d.hold_date,'NULL')  ORDER BY d.order_hold_id SEPARATOR '|') AS hold_dates,
#         GROUP_CONCAT(IFNULL(d.release_date,'NULL') ORDER BY d.order_hold_id SEPARATOR '|') AS release_dates,
#         MAX(CASE
#             WHEN d.release_date IS NULL
#                  AND (5 * (DATEDIFF(CURDATE(), d.hold_date) DIV 7)
#                       + MID('0123444401233334012222340111123400012345001234550',
#                             7 * WEEKDAY(d.hold_date) + WEEKDAY(CURDATE()) + 1, 1)) > 2
#                  THEN 1
#             WHEN d.release_date IS NOT NULL
#                  AND (5 * (DATEDIFF(d.release_date, d.hold_date) DIV 7)
#                       + MID('0123444401233334012222340111123400012345001234550',
#                             7 * WEEKDAY(d.hold_date) + WEEKDAY(d.release_date) + 1, 1)) > 2
#                  THEN 1
#             ELSE 0
#         END) AS has_backorder_hold
#     FROM xxomds_order_hold_s_if d
#     WHERE d.transfer_date > :lookback_date
#         AND d.hold_name IN ('BACK_ORDER_HOLD', 'OVERDUE_HOLD', 'FP_HOLD')
#     GROUP BY d.order_no, d.order_line_id
# ),

# wms_agg AS (
#     SELECT
#         h.order_no,
#         h.order_line_id,
#         MAX(CASE WHEN h.status = '02' THEN h.create_date END) AS load_plan_date,
#         MAX(CASE WHEN h.status = '03' THEN h.create_date END) AS routed_date,
#         MAX(CASE WHEN h.status = '07' THEN h.create_date END) AS wms_shipped_date
#     FROM tmr_inf_wms_status h
#     WHERE h.interface_date > :lookback_date
#     GROUP BY h.order_no, h.order_line_id
# ),

# edi_agg AS (
#     SELECT
#         f.cust_sales_order_no,
#         f.attribute1 AS model,
#         MAX(f.load_id) AS load_id, 
#         MAX(CASE WHEN f.event_cd = 'X4' AND f.pod_desc = 'NS'
#             THEN f.pod_dt END)                                   AS hub_received_pod_dt,
#         MAX(CASE WHEN f.event_cd = 'AM' AND f.pod_desc = 'ST'
#             THEN f.pod_dt END)                                   AS am_st_pod_dt,
#         RIGHT(MAX(CASE WHEN f.event_cd = 'X4' AND f.pod_desc = 'NS'
#             THEN f.pod_dt END), 10)                              AS hub_received_dt,
#         MAX(CASE WHEN f.event_cd = 'AM' AND f.pod_desc = 'NS'
#             THEN f.pod_dt END)                                   AS out_delivery_pod_dt,
#         MAX(CASE WHEN f.event_cd IN ('D1','X1') AND f.pod_desc = 'NS'
#             THEN f.pod_dt END)                                   AS completed_pod_dt,
#         RIGHT(MAX(CASE WHEN f.event_cd IN ('D1','X1') AND f.pod_desc = 'NS'
#             THEN f.pod_dt END), 10)                              AS delivered_dt,
#         MAX(CASE WHEN f.event_cd = 'AG' AND f.pod_desc = 'CS'
#             THEN 1 ELSE 0 END)                                   AS has_cust_reschedule,
#         MAX(CASE WHEN f.event_cd NOT IN ('AG','X4','AM','D1','X1')
#              OR  (f.event_cd = 'AG' AND f.pod_desc NOT IN ('NS','CS'))
#             THEN 1 ELSE 0 END)                                   AS has_schedule_update
#     FROM xxtms_ifr_tms_edi_214_pod_hd f
#     WHERE f.transfer_date > :lookback_date
#       AND (f.event_cd, f.pod_desc) IN (
#           ('AG','NS'),('AG','CS'),('AG','IT'),('AG','DC'),
#           ('AG','LM'),('AG','WW'),('X4','NS'),('AM','NS'),
#           ('AM','ST'),('D1','NS'),('X1','NS'))
#     GROUP BY f.cust_sales_order_no, f.attribute1
# )

# SELECT
#     slf.sales_order_no,
#     slf.order_line_id,
#     slf.cust_po_no,
#     slf.model_code,
#     slf.bill_to_customer_code,
#     slf.unit_selling_price,
#     slf.line_status_code,
#     CONCAT_WS('/', slf.line_status_code, slf.line_status_code2)  AS status_full,
#     slf.carrier_code,
#     slf.warehouse_code,
#     slf.consignee_name,
#     slf.contact_email_addr,
#     slf.include_tax_amount,
#     CONCAT_WS(', ',
#         slf.consignee_addr1_info,
#         slf.consignee_addr2_info,
#         slf.consignee_city_name,
#         CONCAT(slf.consignee_state_name, ' ', slf.consignee_postal_code)
#     ) AS shipping_address,
#     slf.consignee_phone_no,

#     CAST(slf.cust_po_date AS DATE)                AS order_date,
#     slf.booked_date                               AS gerp_booked_date,
#     CAST(slih.back_order_date AS DATE)            AS back_order_date,
#     slf.pick_release_date                         AS pick_release_date,
#     CAST(slf.picking_date AS DATE)                AS picking_date,
#     CAST(slf.actual_shipment_date AS DATE)        AS actual_shipment_date,
#     CAST(slf.sales_date AS DATE)                  AS sales_date,
#     CAST(slf.fulfillment_date AS DATE)            AS fulfillment_date,
#     wms.load_plan_date                 AS load_plan_date,
#     wms.routed_date                    AS routed_date,
#     wms.wms_shipped_date               AS wms_shipped_date,
#     CAST(edi.hub_received_dt AS DATE)             AS hub_received_dt,
#     CAST(edi.out_delivery_pod_dt AS DATE)         AS out_for_delivery_dt,
#     CAST(edi.delivered_dt AS DATE)                AS delivered_dt,

#     CAST(slf.init_promised_arrival_date AS DATE)  AS rad,
#     CASE WHEN slf.promised_arrival_date <> slf.init_promised_arrival_date
#          THEN CAST(slf.promised_arrival_date AS DATE)
#          ELSE NULL
#     END                                           AS rad_rescheduled,
#     CAST(slf.promised_ship_date AS DATE)          AS rsd,
#     CAST(slf.request_shipping_date AS DATE)       AS request_shipping_date,

#     h.first_hold_name,
#     h.hold_names,
#     h.hold_dates,
#     h.release_dates,
#     CASE 
#     WHEN IFNULL(h.has_backorder_hold, 0) = 1
#          AND (slf.pick_release_date IS NOT NULL
#               OR slf.actual_shipment_date IS NOT NULL
#               OR slf.sales_date IS NOT NULL
#               OR slf.fulfillment_date IS NOT NULL)
#     THEN 0
#     ELSE IFNULL(h.has_backorder_hold, 0)
#     END AS has_backorder_hold,

#     IFNULL(edi.has_cust_reschedule, 0)            AS has_cust_reschedule,
#     IFNULL(edi.has_schedule_update, 0)            AS has_schedule_update,

#     edi.hub_received_pod_dt,
#     edi.load_id,
#     edi.am_st_pod_dt,
#     edi.out_delivery_pod_dt                       AS out_delivery_pod_dt_raw,
#     edi.completed_pod_dt

# FROM slf
# LEFT JOIN (SELECT * FROM so_line_hold WHERE rn2 = 1) slih
#     ON slf.sales_order_no = slih.sales_order_no
#    AND slf.line_no        = slih.line_no
# LEFT JOIN hold_agg h
#     ON slf.sales_order_no = h.order_no
#    AND slf.order_line_id  = h.order_line_id
# LEFT JOIN wms_agg wms
#     ON slf.sales_order_no = wms.order_no
#    AND slf.order_line_id  = wms.order_line_id
# LEFT JOIN edi_agg edi
#     ON slf.sales_order_no = edi.cust_sales_order_no
#    AND slf.model_code     = edi.model
# ORDER BY slf.cust_po_date, slf.orig_sys_document_ref, slf.orig_sys_line_ref;
# """


# def _safe_date(val) -> Optional[date]:
#     if val is None:
#         return None
#     if isinstance(val, date):
#         return val
#     try:
#         return date.fromisoformat(str(val)[:10])
#     except (ValueError, TypeError):
#         return None


# def _compute_hash(row: dict) -> str:
#     keys = sorted(k for k in row if k not in (
#         "content_hash", "snapshot_dt", "last_updated_dt", "completed_dt"
#     ))
#     payload = json.dumps({k: str(row[k]) if row[k] is not None else None for k in keys},
#                          sort_keys=True)
#     return hashlib.md5(payload.encode()).hexdigest()


# # ── SQL target statements (PostgreSQL) ───────────────────────────────────

# _DATE_FIELDS = [
#     "order_date", "back_order_date",
#     "actual_shipment_date", "sales_date", "fulfillment_date",
#     "hub_received_dt", "out_for_delivery_dt", "delivered_dt",
#     "rad", "rad_rescheduled", "rsd",
# ]

# _DATETIME_FIELDS = [
#     "gerp_booked_date", "pick_release_date", "picking_date",
#     "load_plan_date", "routed_date", "wms_shipped_date",
#     "am_st_pod_dt",
# ]

# _COLS = """
#     sales_order_no, order_line_id, last_updated_dt,
#     cust_po_no, model_code, bill_to_customer_code,
#     unit_selling_price, line_status_code, status_full,
#     carrier_code, warehouse_code, current_stage,
#     order_date, gerp_booked_date, back_order_date,
#     pick_release_date, picking_date,
#     actual_shipment_date, sales_date,
#     load_plan_date, routed_date, wms_shipped_date,
#     hub_received_dt, out_for_delivery_dt, delivered_dt,
#     rad, rad_rescheduled, rsd,
#     first_hold_name, hold_names, hold_dates, has_backorder_hold,
#     lt_total, lt_backorder_hold, lt_fulfillment, lt_transit,
#     consignee_name, contact_email_addr, include_tax_amount,
#     shipping_address, consignee_phone_no,
#     magento_rad2, magento_po_order_id, magento_customer_po_no,
#     magento_po_created_at, magento_erp_exported_at, am_st_pod_dt, load_id
# """

# _VALS = """
#     :sales_order_no, :order_line_id, :snapshot_dt,
#     :cust_po_no, :model_code, :bill_to_customer_code,
#     :unit_selling_price, :line_status_code, :status_full,
#     :carrier_code, :warehouse_code, :current_stage,
#     :order_date, :gerp_booked_date, :back_order_date,
#     :pick_release_date, :picking_date,
#     :actual_shipment_date, :sales_date,
#     :load_plan_date, :routed_date, :wms_shipped_date,
#     :hub_received_dt, :out_for_delivery_dt, :delivered_dt,
#     :rad, :rad_rescheduled, :rsd,
#     :first_hold_name, :hold_names, :hold_dates, :has_backorder_hold,
#     :lt_total, :lt_backorder_hold, :lt_fulfillment, :lt_transit,
#     :consignee_name, :contact_email_addr, :include_tax_amount,
#     :shipping_address, :consignee_phone_no,
#     :magento_rad2, :magento_po_order_id, :magento_customer_po_no,
#     :magento_po_created_at, :magento_erp_exported_at, :am_st_pod_dt, :load_id
# """

# _UPDATE_SET = """
#     last_updated_dt = EXCLUDED.last_updated_dt,
#     cust_po_no = EXCLUDED.cust_po_no, model_code = EXCLUDED.model_code,
#     bill_to_customer_code = EXCLUDED.bill_to_customer_code,
#     unit_selling_price = EXCLUDED.unit_selling_price,
#     line_status_code = EXCLUDED.line_status_code, status_full = EXCLUDED.status_full,
#     carrier_code = EXCLUDED.carrier_code, warehouse_code = EXCLUDED.warehouse_code,
#     current_stage = EXCLUDED.current_stage,
#     order_date = EXCLUDED.order_date, gerp_booked_date = EXCLUDED.gerp_booked_date,
#     back_order_date = EXCLUDED.back_order_date,
#     pick_release_date = EXCLUDED.pick_release_date, picking_date = EXCLUDED.picking_date,
#     actual_shipment_date = EXCLUDED.actual_shipment_date, sales_date = EXCLUDED.sales_date,
#     load_plan_date = EXCLUDED.load_plan_date, routed_date = EXCLUDED.routed_date,
#     wms_shipped_date = EXCLUDED.wms_shipped_date,
#     hub_received_dt = EXCLUDED.hub_received_dt,
#     out_for_delivery_dt = EXCLUDED.out_for_delivery_dt,
#     delivered_dt = EXCLUDED.delivered_dt,
#     rad = EXCLUDED.rad, rad_rescheduled = EXCLUDED.rad_rescheduled, rsd = EXCLUDED.rsd,
#     first_hold_name = EXCLUDED.first_hold_name,
#     hold_names = EXCLUDED.hold_names, hold_dates = EXCLUDED.hold_dates,
#     has_backorder_hold = EXCLUDED.has_backorder_hold,
#     lt_total = EXCLUDED.lt_total, lt_backorder_hold = EXCLUDED.lt_backorder_hold,
#     lt_fulfillment = EXCLUDED.lt_fulfillment, lt_transit = EXCLUDED.lt_transit,
#     consignee_name = EXCLUDED.consignee_name,
#     contact_email_addr = EXCLUDED.contact_email_addr,
#     include_tax_amount = EXCLUDED.include_tax_amount,
#     shipping_address = EXCLUDED.shipping_address,
#     consignee_phone_no = EXCLUDED.consignee_phone_no,
#     magento_rad2 = EXCLUDED.magento_rad2,
#     magento_po_order_id = EXCLUDED.magento_po_order_id,
#     magento_customer_po_no = EXCLUDED.magento_customer_po_no,
#     magento_po_created_at = EXCLUDED.magento_po_created_at,
#     magento_erp_exported_at = EXCLUDED.magento_erp_exported_at,
#     am_st_pod_dt = EXCLUDED.am_st_pod_dt,
#     load_id = EXCLUDED.load_id
# """

# UPSERT_CURRENT = text(f"""
#     INSERT INTO order_tracking_current ({_COLS})
#     VALUES ({_VALS})
#     ON CONFLICT (sales_order_no, order_line_id) DO UPDATE SET {_UPDATE_SET}
# """)

# UPSERT_COMPLETED = text(f"""
#     INSERT INTO order_tracking_completed (completed_dt, {_COLS})
#     VALUES (:snapshot_dt, {_VALS})
#     ON CONFLICT (sales_order_no, order_line_id) DO UPDATE SET
#         completed_dt = EXCLUDED.completed_dt, {_UPDATE_SET}
# """)

# UPSERT_COMMENTS = text("""
#     INSERT INTO order_comments
#         (entity_id, sales_order_no, order_line_id, comment, status, created_at)
#     VALUES
#         (:entity_id, :sales_order_no, :order_line_id, :comment, :status, :created_at)
#     ON CONFLICT (entity_id) DO UPDATE SET
#         comment = EXCLUDED.comment, status = EXCLUDED.status, created_at = EXCLUDED.created_at
# """)

# UPSERT_ETA_UPDATES = text("""
#     INSERT INTO order_eta_updates
#         (history_id, sales_order_no, order_line_id,
#          source, send_email, eta_date_from, eta_date_to, created_at)
#     VALUES
#         (:history_id, :sales_order_no, :order_line_id,
#          :source, :send_email, :eta_date_from, :eta_date_to, :created_at)
#     ON CONFLICT (history_id) DO UPDATE SET
#         source = EXCLUDED.source, send_email = EXCLUDED.send_email,
#         eta_date_from = EXCLUDED.eta_date_from, eta_date_to = EXCLUDED.eta_date_to,
#         created_at = EXCLUDED.created_at
# """)

# BATCH_SIZE = 500


# def _lt(end, start) -> Optional[int]:
#     if end and start:
#         if isinstance(end, datetime):
#             end = end.date()
#         if isinstance(start, datetime):
#             start = start.date()
#         return (end - start).days
#     return None


# def _prepare_row(raw: dict, snapshot_dt: datetime) -> dict:
#     row = dict(raw)
#     for f in _DATE_FIELDS:
#         row[f] = _safe_date(row.get(f))
#     for f in _DATETIME_FIELDS:
#         row.setdefault(f, None)

#     if not row["delivered_dt"] and row.get("sales_date"):
#         row["delivered_dt"] = row["sales_date"]

#     row["lt_total"] = _lt(row["delivered_dt"], row["order_date"])
#     row["lt_backorder_hold"] = _lt(row["pick_release_date"], row["back_order_date"])
#     row["lt_fulfillment"] = _lt(row["actual_shipment_date"], row["load_plan_date"])
#     row["lt_transit"] = _lt(row["delivered_dt"], row["actual_shipment_date"])

#     for mf in ("magento_rad2", "magento_po_order_id", "magento_customer_po_no",
#                "magento_po_created_at", "magento_erp_exported_at"):
#         row.setdefault(mf, None)

#     row["snapshot_dt"] = snapshot_dt

#     for col in ("order_line_id", "cust_po_no", "sales_order_no"):
#         if row.get(col) is not None:
#             row[col] = str(row[col])

#     row.setdefault("load_id", None)

#     return row


# async def _batch_execute(db: AsyncSession, stmt, rows: list[dict]):
#     for i in range(0, len(rows), BATCH_SIZE):
#         await db.execute(stmt, rows[i:i + BATCH_SIZE])


# async def _fetch_magento_fulfillment(magento_db: AsyncSession, line_ids: list) -> dict:
#     if not line_ids:
#         return {}
#     magento_map = {}
#     for i in range(0, len(line_ids), BATCH_SIZE):
#         chunk = line_ids[i:i + BATCH_SIZE]
#         ph = ", ".join(f":lid_{j}" for j in range(len(chunk)))
#         params = {f"lid_{j}": v for j, v in enumerate(chunk)}
#         sql = text(f"""
#             SELECT erp_order_line_id,
#                 po_order_id     AS magento_po_order_id,
#                 customer_po_no  AS magento_customer_po_no,
#                 po_created_at   AS magento_po_created_at,
#                 erp_exported_at AS magento_erp_exported_at,
#                 latest_rad      AS magento_rad2,
#                 export_status   AS magento_export_status,
#                 qty_canceled    AS magento_qty_canceled,
#                 qty_refunded    AS magento_qty_refunded
#             FROM lg_vw_scm_order_item_fulfillment
#             WHERE erp_order_line_id IN ({ph})
#         """)
#         for r in (await magento_db.execute(sql, params)).mappings().all():
#             magento_map[str(r["erp_order_line_id"])] = dict(r)
#     return magento_map


# async def _fetch_and_upsert_comments(
#     magento_db: AsyncSession, scm_db: AsyncSession,
#     po_id_to_order: dict,
# ):
#     po_ids = list(po_id_to_order.keys())
#     if not po_ids:
#         return 0
#     rows = []
#     for i in range(0, len(po_ids), BATCH_SIZE):
#         chunk = po_ids[i:i + BATCH_SIZE]
#         ph = ", ".join(f":pid_{j}" for j in range(len(chunk)))
#         params = {f"pid_{j}": v for j, v in enumerate(chunk)}
#         sql = text(f"""
#             SELECT entity_id, parent_id, comment, status, created_at
#             FROM sales_order_status_history
#             WHERE parent_id IN ({ph})
#         """)
#         for r in (await magento_db.execute(sql, params)).mappings().all():
#             info = po_id_to_order.get(r["parent_id"])
#             if info:
#                 rows.append({
#                     "entity_id": r["entity_id"],
#                     "sales_order_no": info["sales_order_no"],
#                     "order_line_id": info["order_line_id"],
#                     "comment": r["comment"],
#                     "status": r["status"],
#                     "created_at": r["created_at"],
#                 })
#     if rows:
#         await _batch_execute(scm_db, UPSERT_COMMENTS, rows)
#     logger.info("ETL: %d comments upserted", len(rows))
#     return len(rows)


# async def _fetch_and_upsert_eta(
#     magento_db: AsyncSession, scm_db: AsyncSession,
#     cpo_to_order: dict,
# ):
#     cpo_ids = list(cpo_to_order.keys())
#     if not cpo_ids:
#         return 0
#     rows = []
#     for i in range(0, len(cpo_ids), BATCH_SIZE):
#         chunk = cpo_ids[i:i + BATCH_SIZE]
#         ph = ", ".join(f":cid_{j}" for j in range(len(chunk)))
#         params = {f"cid_{j}": v for j, v in enumerate(chunk)}
#         sql = text(f"""
#             SELECT history_id, order_increment_id, source, send_email,
#                    eta_date_from, eta_date_to, created_at
#             FROM lg_sales_order_eta_update_history
#             WHERE order_increment_id IN ({ph})
#         """)
#         for r in (await magento_db.execute(sql, params)).mappings().all():
#             info = cpo_to_order.get(r["order_increment_id"])
#             if info:
#                 rows.append({
#                     "history_id": r["history_id"],
#                     "sales_order_no": info["sales_order_no"],
#                     "order_line_id": info["order_line_id"],
#                     "source": r["source"],
#                     "send_email": r["send_email"],
#                     "eta_date_from": r["eta_date_from"],
#                     "eta_date_to": r["eta_date_to"],
#                     "created_at": r["created_at"],
#                 })
#     if rows:
#         await _batch_execute(scm_db, UPSERT_ETA_UPDATES, rows)
#     logger.info("ETL: %d eta updates upserted", len(rows))
#     return len(rows)


# async def run_etl(
#     source_db: AsyncSession,
#     scm_db: AsyncSession,
#     date_range_start: date,
#     date_range_end: date,
#     magento_db: AsyncSession = None,
# ):
#     snapshot_dt = datetime.now()

#     # 1. Extract from source DB (MySQL)
#     result = await source_db.execute(
#         text(EXTRACTION_SQL),
#         {"date_range_start": date_range_start,
#          "date_range_end": date_range_end,
#          "lookback_date": date_range_start},
#     )
#     raw_rows = result.mappings().all()
#     logger.info("ETL extracted %d rows", len(raw_rows))

#     # 2. Compute all rows
#     all_rows = [_prepare_row(raw, snapshot_dt) for raw in raw_rows]

#     # 3. Merge magento fulfillment data
#     if magento_db:
#         line_ids = [str(r["order_line_id"]) for r in all_rows]
#         mg_map = await _fetch_magento_fulfillment(magento_db, line_ids)
#         for row in all_rows:
#             mg = mg_map.get(str(row["order_line_id"]))
#             if mg:
#                 row["magento_rad2"] = _safe_date(mg.get("magento_rad2"))
#                 row["magento_po_order_id"] = mg.get("magento_po_order_id")
#                 row["magento_customer_po_no"] = mg.get("magento_customer_po_no")
#                 row["magento_po_created_at"] = mg.get("magento_po_created_at")
#                 row["magento_erp_exported_at"] = mg.get("magento_erp_exported_at")
#                 row["magento_export_status"] = mg.get("magento_export_status")
#                 row["magento_qty_canceled"] = mg.get("magento_qty_canceled")
#                 row["magento_qty_refunded"] = mg.get("magento_qty_refunded")
#         logger.info("ETL: magento merged %d/%d", len(mg_map), len(all_rows))

#     # 3.5 Resolve stage (after magento merge)
#     for row in all_rows:
#         row["current_stage"] = resolve_stage(row)

#     # 4. Split current / completed
#     current_rows = []
#     completed_rows = []
#     for row in all_rows:
#         is_done = row["current_stage"] == "delivered" or row.get("line_status_code") == "CLOSED"
#         (completed_rows if is_done else current_rows).append(row)

#     # 5. Batch upsert current (PostgreSQL)
#     if current_rows:
#         await _batch_execute(scm_db, UPSERT_CURRENT, current_rows)

#     # 6. Batch upsert completed (PostgreSQL)
#     if completed_rows:
#         await _batch_execute(scm_db, UPSERT_COMPLETED, completed_rows)

#         # 7. Bulk delete completed from current table
#         done_keys = [(r["sales_order_no"], r["order_line_id"]) for r in completed_rows]
#         for i in range(0, len(done_keys), BATCH_SIZE):
#             chunk = done_keys[i:i + BATCH_SIZE]
#             ph = ", ".join(f"(:so_{j}, :li_{j})" for j in range(len(chunk)))
#             params = {}
#             for j, (so, li) in enumerate(chunk):
#                 params[f"so_{j}"] = so
#                 params[f"li_{j}"] = li
#             await scm_db.execute(
#                 text(f"DELETE FROM order_tracking_current "
#                      f"WHERE (sales_order_no, order_line_id) IN ({ph})"),
#                 params,
#             )

#     # 8. Fetch & upsert comments + eta from magento
#     if magento_db:
#         po_id_to_order = {}
#         cpo_to_order = {}
#         for row in all_rows:
#             info = {"sales_order_no": row["sales_order_no"],
#                     "order_line_id": str(row["order_line_id"])}
#             if row.get("magento_po_order_id"):
#                 po_id_to_order[row["magento_po_order_id"]] = info
#             if row.get("magento_customer_po_no"):
#                 cpo_to_order[row["magento_customer_po_no"]] = info

#         await _fetch_and_upsert_comments(magento_db, scm_db, po_id_to_order)
#         await _fetch_and_upsert_eta(magento_db, scm_db, cpo_to_order)

#     await scm_db.commit()
#     logger.info("ETL: %d current, %d completed", len(current_rows), len(completed_rows))
#     return {"upserted": len(current_rows), "completed": len(completed_rows)}
