
Order Tracking Alert System
Database & ETL Implementation Spec
v1.0  |  Feb 2026  |  Phase 1 (LMD Only)
 
1. System Overview
Hourly ETL batch that tracks order lifecycle from Magento to delivery. Append-only snapshots for audit, materialized current-state table for dashboard.

Main goal: building an interactive dashboard. Frontend: react, Backend: python (fastapi)
Tech Stack: FastAPI (backend) + React (frontend) + MySQL (DB) + system crontab (ETL scheduler)
Front end dashboard 로 만들기 가능한 것 ✅
•	Filters: date range(order_date), PO(cust_po_no), category(category_code) → 다 current 테이블에 있음
•	KPI tiles: total count, OTD(delivered + on_track), avg lead time(lt_total), fulfillment time(lt_fulfillment), transit time(lt_transit), back-orders(current_stage='backorder_hold') → 전부 가능
•	Alert/Aging/Back-order 카드: alert_status, aging_group, current_stage로 바로 집계
•	End-to-end pipeline: current_stage로 GROUP BY하면 각 단계별 count, warning, alert, aging 다 나옴
•	Detail overlay: snapshot 테이블에서 history timeline 조회 가능
•	List view: current 테이블 SELECT로 바로 가능


ETL Flow:
1. Extract  → Read 5 source tables (existing, read-only)
2. Compute  → Stage resolution, alert calc, category, lead times (Python)
3. Compare  → MD5 content_hash vs current table
4. Load     → If changed: INSERT snapshot + UPSERT current (same transaction)

Tables to CREATE:
Table	Type	Purpose
order_tracking_snapshot	Append-only	Full state change history (partitioned quarterly)
order_tracking_current	UPSERT	1 row per order line — dashboard/alert source
alert_stage_config	Config	Stage definitions, ref dates, stage ordering

Source tables (READ-ONLY, existing):
xxomds_so_line_if       → Order line master
xxomv_order_if          → Order interface (RAD1, RAD2)
xxomds_order_hold_s_if  → Order holds
xxtms_ifr_tms_edi_214_pod_hd  → EDI214 delivery events
tmr_inf_wms_status      → TMS/WMS status transitions
lg_warehouse_leadtime   → Carrier lead times (existing config)
 

2. DDL — Table Definitions
2.1 order_tracking_snapshot
CREATE TABLE order_tracking_snapshot (
    snapshot_id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    snapshot_dt            DATETIME NOT NULL DEFAULT NOW(),

    -- Keys
    sales_order_no         VARCHAR(30) NOT NULL,
    order_line_id          VARCHAR(30) NOT NULL,

    -- Order info
    cust_po_no             VARCHAR(30),
    model_code             VARCHAR(50),
    bill_to_customer_code  VARCHAR(50),
    unit_selling_price     DECIMAL(12,2),
    line_status_code       VARCHAR(30),

    -- ETL computed
    current_stage          VARCHAR(30) NOT NULL,
    alert_status           VARCHAR(20) NOT NULL DEFAULT 'on_track',
    aging_days             INT DEFAULT 0,
    aging_group            VARCHAR(20),
    category_code          VARCHAR(50),
    category_accumulated   TEXT,

    -- Stage 1: Order dates
    order_date             DATE,
    gerp_booked_date       DATE,
    back_order_date        DATE,
    pick_release_date      DATE,

    -- Stage 2: In-Transit dates
    load_plan_date         DATE,
    actual_shipment_date   DATE,

    -- Stage 3: Delivery dates (from EDI214)
    hub_received_dt        DATE,          -- X4/NS
    out_for_delivery_dt    DATE,          -- AM/NS
    delivered_dt           DATE,          -- D1/NS or X1/NS

    -- RAD & RSD
    rad1                   DATE,          -- Initial request date
    rad2                   DATE,          -- Changed on MyLG
    rad3                   DATE,          -- Changed by LMD (AG/NS)
    rad4                   DATE,          -- Changed by Cx (AG/CS)
    rsd                    DATE,          -- Request Ship Date (f_get_rsd)

    -- Holds
    first_hold_name        VARCHAR(50),
    hold_names             TEXT,
    hold_dates             TEXT,

    -- EDI214 raw refs
    scheduled_pod_desc     VARCHAR(100),
    scheduled_pod_dt       VARCHAR(100),
    cust_updated_pod_desc  VARCHAR(100),
    updated_pod_desc       VARCHAR(100),
    received_agent_pod_dt  VARCHAR(100),
    out_delivery_pod_dt    VARCHAR(100),
    completed_pod_dt       VARCHAR(100),

    -- Lead times (days)
    lt_total               INT,           -- delivered - order_date
    lt_backorder_hold      INT,           -- back_order - pick_release
    lt_stock_allocation    INT,           -- pick_release - booked
    lt_fulfillment         INT,           -- shipped(07) - not_started(01)
    lt_transit             INT,           -- delivered - shipped

    -- Change detection
    content_hash           CHAR(32) NOT NULL,

    INDEX idx_snap_lookup (sales_order_no, order_line_id, snapshot_dt DESC),
    INDEX idx_snap_alert (alert_status, snapshot_dt),
    INDEX idx_snap_stage (current_stage, snapshot_dt),
    INDEX idx_snap_dt (snapshot_dt)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
PARTITION BY RANGE (TO_DAYS(snapshot_dt)) (
    PARTITION p2025q1 VALUES LESS THAN (TO_DAYS('2025-04-01')),
    PARTITION p2025q2 VALUES LESS THAN (TO_DAYS('2025-07-01')),
    PARTITION p2025q3 VALUES LESS THAN (TO_DAYS('2025-10-01')),
    PARTITION p2025q4 VALUES LESS THAN (TO_DAYS('2026-01-01')),
    PARTITION p2026q1 VALUES LESS THAN (TO_DAYS('2026-04-01')),
    PARTITION p2026q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
 
2.2 order_tracking_current
Same columns as snapshot, but PK = (sales_order_no, order_line_id). One row per order line.
CREATE TABLE order_tracking_current (
    sales_order_no         VARCHAR(30) NOT NULL,
    order_line_id          VARCHAR(30) NOT NULL,
    last_updated_dt        DATETIME NOT NULL DEFAULT NOW(),

    -- Same columns as snapshot (minus snapshot_id)
    cust_po_no             VARCHAR(30),
    model_code             VARCHAR(50),
    bill_to_customer_code  VARCHAR(50),
    unit_selling_price     DECIMAL(12,2),
    line_status_code       VARCHAR(30),
    current_stage          VARCHAR(30) NOT NULL,
    alert_status           VARCHAR(20) NOT NULL DEFAULT 'on_track',
    aging_days             INT DEFAULT 0,
    aging_group            VARCHAR(20),
    category_code          VARCHAR(50),
    category_accumulated   TEXT,
    order_date             DATE,
    gerp_booked_date       DATE,
    back_order_date        DATE,
    pick_release_date      DATE,
    load_plan_date         DATE,
    actual_shipment_date   DATE,
    hub_received_dt        DATE,
    out_for_delivery_dt    DATE,
    delivered_dt           DATE,
    rad1                   DATE,
    rad2                   DATE,
    rad3                   DATE,
    rad4                   DATE,
    rsd                    DATE,
    first_hold_name        VARCHAR(50),
    hold_names             TEXT,
    hold_dates             TEXT,
    scheduled_pod_desc     VARCHAR(100),
    scheduled_pod_dt       VARCHAR(100),
    cust_updated_pod_desc  VARCHAR(100),
    updated_pod_desc       VARCHAR(100),
    received_agent_pod_dt  VARCHAR(100),
    out_delivery_pod_dt    VARCHAR(100),
    completed_pod_dt       VARCHAR(100),
    lt_total               INT,
    lt_backorder_hold      INT,
    lt_stock_allocation    INT,
    lt_fulfillment         INT,
    lt_transit             INT,
    content_hash           CHAR(32) NOT NULL,

    PRIMARY KEY (sales_order_no, order_line_id),
    INDEX idx_curr_alert (alert_status),
    INDEX idx_curr_stage (current_stage),
    INDEX idx_curr_order_date (order_date),
    INDEX idx_curr_aging (aging_group, aging_days),
    INDEX idx_curr_composite (order_date, alert_status, current_stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

2.3 alert_stage_config
CREATE TABLE alert_stage_config (
    stage_name     VARCHAR(30) PRIMARY KEY,
    stage_order    INT NOT NULL,
    check_field    VARCHAR(50) NOT NULL,     -- column to check for this stage
    ref_date_type  VARCHAR(10) NOT NULL,     -- 'rad' or 'rsd'
    offset_days    INT DEFAULT 0,            -- offset from ref date
    source_system  VARCHAR(20),
    source_key     VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

Seed data:
INSERT INTO alert_stage_config VALUES
('ordered',          10, 'order_date',          'none', 0, 'AIC',    'cust_po_date'),
('booked',           20, 'gerp_booked_date',    'none', 0, 'AIC',    'booked_date'),
('backorder_hold',   25, 'back_order_date',     'rsd', -1, 'AIC',    'line_status BACK'),
('pick_released',    30, 'pick_release_date',   'rsd', -1, 'AIC',    'pick_release_date'),
('load_planning',    40, 'load_plan_date',      'rsd', -1, 'TMS',    'status=02'),
('shipped',          60, 'actual_shipment_date','rsd',  0, 'WMS',    'status=07'),
('hub_received',     70, 'hub_received_dt',     'rad', -1, 'EDI214', 'X4/NS'),
('out_for_delivery', 80, 'out_for_delivery_dt', 'rad',  0, 'EDI214', 'AM/NS'),
('delivered',        90, 'delivered_dt',         'rad',  0, 'EDI214', 'D1/NS or X1/NS'),
('closed',          100, 'line_status_code',    'none',  0, 'AIC',    'CLOSED');
 
3. ETL Extraction Query
Runs hourly. Outputs one flat row per active order line. All column names are verified against existing source tables.

-- ══════════════════════════════════════════════════════════════
-- Hourly ETL extraction — all columns from verified source tables
-- ══════════════════════════════════════════════════════════════

WITH so_line_if AS (
    SELECT a.*,
        ROW_NUMBER() OVER (
            PARTITION BY a.orig_sys_document_ref, a.orig_sys_line_ref
            ORDER BY a.transfer_date DESC
        ) AS rn
    FROM xxomds_so_line_if a
    WHERE a.order_category_code = 'ORDER'
      AND a.subinventory_code = 'GOODSET'
      AND a.ship_to_customer_code IN (
          'US074178-LMD-S','US074178P-LMD-S','US074178E-LMD-S')
      AND a.ordered_date BETWEEN :date_range_start AND :date_range_end
)

, so_line_if_hold AS (
    SELECT c.*,
        ROW_NUMBER() OVER (
            PARTITION BY c.orig_sys_document_ref, c.orig_sys_line_ref
            ORDER BY c.transfer_date
        ) AS rn2
    FROM xxomds_so_line_if c
    WHERE c.order_category_code = 'ORDER'
      AND c.subinventory_code = 'GOODSET'
      AND c.ship_to_customer_code IN (
          'US074178-LMD-S','US074178P-LMD-S','US074178E-LMD-S')
      AND c.line_status_code = 'BOOKED'
      AND c.line_status_code2 = 'BACK'
      AND c.transfer_date > :lookback_date
)

, order_hold_s_if AS (
    SELECT e.order_no, e.order_line_id,
        SUBSTRING_INDEX(
            GROUP_CONCAT(e.hold_name ORDER BY e.order_hold_id SEPARATOR '|'),
            '|', 1) AS first_hold_name,
        GROUP_CONCAT(IFNULL(e.hold_name,'NULL')
            ORDER BY e.order_hold_id SEPARATOR '|') AS hold_names,
        GROUP_CONCAT(IFNULL(e.hold_date,'NULL')
            ORDER BY e.order_hold_id SEPARATOR '|') AS hold_dates,
        GROUP_CONCAT(IFNULL(e.release_date,'NULL')
            ORDER BY e.order_hold_id SEPARATOR '|') AS release_dates
    FROM (
        SELECT d.order_hold_id, d.order_no, d.order_line_id,
            MAX(d.hold_date) AS hold_date,
            MAX(d.hold_name) AS hold_name,
            MAX(d.release_date) AS release_date
        FROM xxomds_order_hold_s_if d
        WHERE d.transfer_date > :lookback_date
        GROUP BY d.order_hold_id, d.order_no, d.order_line_id
    ) e
    GROUP BY e.order_no, e.order_line_id
)

, ifr_tms_edi_214_pod_hd AS (
    SELECT
        g.cust_sales_order_no,
        g.model,
        GROUP_CONCAT(g.serial_no) AS serial_no,
        MAX(IF(g.delivery_status='Delivery Scheduled',
            CONCAT_WS('-',g.event_cd,g.pod_desc),NULL))     AS scheduled_pod_desc,
        MAX(IF(g.delivery_status='Delivery Scheduled',
            g.pod_dt,NULL))                                   AS scheduled_pod_dt,
        MAX(IF(g.delivery_status='Scheduled by Customer',
            CONCAT_WS('-',g.event_cd,g.pod_desc),NULL))     AS cust_updated_pod_desc,
        MAX(IF(g.delivery_status='Scheduled by Customer',
            g.pod_dt,NULL))                                   AS cust_updated_pod_dt,
        MAX(IF(g.delivery_status='Schedule Updated',
            CONCAT_WS('-',g.event_cd,g.pod_desc),NULL))     AS updated_pod_desc,
        MAX(IF(g.delivery_status='Schedule Updated',
            g.pod_dt,NULL))                                   AS updated_pod_dt,
        MAX(IF(g.delivery_status='Received at Agent',
            CONCAT_WS('-',g.event_cd,g.pod_desc),NULL))     AS received_agent_pod_desc,
        MAX(IF(g.delivery_status='Received at Agent',
            g.pod_dt,NULL))                                   AS received_agent_pod_dt,
        RIGHT(MAX(IF(g.delivery_status='Received at Agent',
            g.pod_dt,NULL)),10)                               AS last_received_agent_pod_dt,
        MAX(IF(g.delivery_status='Out For Delivery',
            CONCAT_WS('-',g.event_cd,g.pod_desc),NULL))     AS out_delivery_pod_desc,
        MAX(IF(g.delivery_status='Out For Delivery',
            g.pod_dt,NULL))                                   AS out_delivery_pod_dt,
        MAX(IF(g.delivery_status='Delivery Completed',
            CONCAT_WS('-',g.event_cd,g.pod_desc),NULL))     AS completed_pod_desc,
        MAX(IF(g.delivery_status='Delivery Completed',
            g.pod_dt,NULL))                                   AS completed_pod_dt,
        RIGHT(MAX(IF(g.delivery_status='Delivery Completed',
            g.pod_dt,NULL)),10)                               AS last_completed_pod_dt
    FROM (
        SELECT f.customer_order_no, f.cust_sales_order_no,
            CASE
                WHEN f.event_cd='AG' AND f.pod_desc='NS' THEN 'Delivery Scheduled'
                WHEN f.event_cd='AG' AND f.pod_desc='CS' THEN 'Scheduled by Customer'
                WHEN f.event_cd='X4' AND f.pod_desc='NS' THEN 'Received at Agent'
                WHEN f.event_cd='AM' AND f.pod_desc='NS' THEN 'Out For Delivery'
                WHEN f.event_cd IN ('D1','X1') AND f.pod_desc='NS' THEN 'Delivery Completed'
                ELSE 'Schedule Updated'
            END AS delivery_status,
            GROUP_CONCAT(f.carr_cd ORDER BY f.transfer_date SEPARATOR '|') AS carr_cd,
            GROUP_CONCAT(f.load_id ORDER BY f.transfer_date SEPARATOR '|') AS load_id,
            f.event_cd,
            GROUP_CONCAT(f.pod_desc ORDER BY f.transfer_date SEPARATOR '|') AS pod_desc,
            GROUP_CONCAT(f.pod_dt ORDER BY f.transfer_date SEPARATOR '|') AS pod_dt,
            f.attribute1 AS model,
            GROUP_CONCAT(f.attribute2 ORDER BY f.transfer_date SEPARATOR '|') AS serial_no,
            MIN(f.transfer_date) AS min_transfer_date,
            MAX(f.transfer_date) AS max_transfer_date
        FROM xxtms_ifr_tms_edi_214_pod_hd f
        WHERE f.transfer_date > :lookback_date
          AND (f.event_cd, f.pod_desc) IN (
              ('AG','NS'),('AG','CS'),('AG','IT'),('AG','DC'),
              ('AG','LM'),('AG','WW'),('X4','NS'),('AM','NS'),
              ('D1','NS'),('X1','NS'))
        GROUP BY f.customer_order_no, f.cust_sales_order_no,
                 delivery_status, f.event_cd, model
    ) g
    GROUP BY g.cust_sales_order_no, g.model
)

, inf_wms_status AS (
    SELECT h.order_no, h.order_line_id,
        MAX(IF(h.status='02', h.interface_date, NULL)) AS load_plan_date,
        GROUP_CONCAT(h.interface_date ORDER BY h.interface_date SEPARATOR '|') AS trx_date,
        GROUP_CONCAT(h.status ORDER BY h.interface_date SEPARATOR '|') AS status,
        GROUP_CONCAT(h.status_desc ORDER BY h.interface_date SEPARATOR '|') AS status_desc
    FROM tmr_inf_wms_status h
    WHERE h.interface_date > :lookback_date
    GROUP BY h.order_no, h.order_line_id
)

-- ══════════════════════════════════════════════════════════════
-- Main SELECT
-- ══════════════════════════════════════════════════════════════
SELECT
    -- Keys
    sli.sales_order_no,
    sli.order_line_id,
    sli.cust_po_no,
    sli.model_code,
    sli.bill_to_customer_code,
    sli.unit_selling_price,
    sli.line_status_code,

    -- Stage 1 dates
    CAST(sli.cust_po_date AS DATE)           AS order_date,
    CAST(sli.booked_date AS DATE)             AS gerp_booked_date,
    CAST(slih.transfer_date AS DATE)          AS back_order_date,
    CAST(sli.pick_release_date AS DATE)       AS pick_release_date,

    -- Stage 2 dates
    CAST(iws.load_plan_date AS DATE)          AS load_plan_date,
    CAST(sli.actual_shipment_date AS DATE)    AS actual_shipment_date,

    -- Stage 3 dates
    CAST(ite214ph.last_received_agent_pod_dt AS DATE) AS hub_received_dt,
    ite214ph.out_delivery_pod_dt,              -- parse in Python
    CAST(ite214ph.last_completed_pod_dt AS DATE)      AS delivered_dt,

    -- RAD variants
    DATE_FORMAT(xoi.request_date, '%Y-%m-%d')     AS rad1,
    DATE_FORMAT(xoi_upd.request_date, '%Y-%m-%d') AS rad2,
    ite214ph.scheduled_pod_dt                      AS rad3_raw,    -- parse in Python
    ite214ph.cust_updated_pod_dt                   AS rad4_raw,    -- parse in Python

    -- Holds
    ohsi.first_hold_name,
    ohsi.hold_names,
    ohsi.hold_dates,

    -- EDI214 raw (for reference / category logic)
    ite214ph.scheduled_pod_desc,
    ite214ph.scheduled_pod_dt,
    ite214ph.cust_updated_pod_desc,
    ite214ph.updated_pod_desc,
    ite214ph.updated_pod_dt,
    ite214ph.received_agent_pod_dt,
    ite214ph.out_delivery_pod_dt   AS out_delivery_pod_dt_raw,
    ite214ph.completed_pod_dt,

    -- For RSD calculation in Python
    sli.request_shipping_date,

    -- WMS status trail
    iws.status                                AS wms_status_trail,
    iws.status_desc                           AS wms_status_desc_trail,
    iws.trx_date                              AS wms_trx_dates

FROM xxomv_order_if xoi
INNER JOIN so_line_if sli
    ON xoi.orig_sys_document_ref = sli.orig_sys_document_ref
    AND xoi.orig_sys_line_ref = sli.orig_sys_line_ref
    AND sli.line_status_code NOT IN ('CANCELLED')
    AND sli.rn = 1
LEFT JOIN xxomv_order_if xoi_upd
    ON sli.order_header_id = xoi_upd.original_header_id
    AND sli.order_line_id = xoi_upd.original_line_id
    AND xoi_upd.operation_code = 'UPDATE'
    AND xoi_upd.transfer_date > :lookback_date
    AND xoi_upd.process_status_code = 'S'
LEFT JOIN so_line_if_hold slih
    ON sli.sales_order_no = slih.sales_order_no
    AND sli.line_no = slih.line_no AND slih.rn2 = 1
LEFT JOIN order_hold_s_if ohsi
    ON sli.sales_order_no = ohsi.order_no
    AND sli.order_line_id = ohsi.order_line_id
LEFT JOIN ifr_tms_edi_214_pod_hd ite214ph
    ON sli.sales_order_no = ite214ph.cust_sales_order_no
    AND sli.model_code = ite214ph.model
LEFT JOIN inf_wms_status iws
    ON sli.sales_order_no = iws.order_no
    AND sli.order_line_id = iws.order_line_id
WHERE xoi.transfer_date > :lookback_date
    AND xoi.process_status_code = 'S'
    AND xoi.subinventory_code IS NULL
ORDER BY sli.cust_po_date, sli.orig_sys_document_ref;
 
4. Python ETL Logic
4.1 Stage Resolution
Walk from highest stage to lowest. First non-null date wins. This implements the ignore rule automatically.
def resolve_stage(row: dict) -> str:
    if row['line_status_code'] == 'CLOSED':
        return 'closed'
    if row['delivered_dt']:          return 'delivered'
    if row['out_for_delivery_dt']:   return 'out_for_delivery'
    if row['hub_received_dt']:       return 'hub_received'
    if row['actual_shipment_date']:  return 'shipped'
    if row['load_plan_date']:        return 'load_planning'
    if row['pick_release_date']:     return 'pick_released'
    if row['back_order_date'] and not row['pick_release_date']:
        return 'backorder_hold'
    if row['gerp_booked_date']:      return 'booked'
    return 'ordered'

4.2 Alert Calculation
Business-day diff between today and the reference date (RAD or RSD) for the current stage.
def business_days_diff(d1: date, d2: date) -> int:
    """Positive if d2 > d1 (overdue)."""
    if d1 == d2: return 0
    sign = 1 if d2 > d1 else -1
    start, end = min(d1, d2), max(d1, d2)
    count = sum(1 for i in range((end - start).days)
               if (start + timedelta(days=i+1)).weekday() < 5)
    return count * sign


def classify_aging(days: int) -> str | None:
    if days <= 0:  return None
    if days <= 3:  return 'aging_1_3'
    if days <= 7:  return 'aging_4_7'
    if days <= 14: return 'aging_8_14'
    return 'aging_15_plus'


def calc_alert(row: dict, config: dict, today: date) -> tuple:
    """Returns (alert_status, aging_days, aging_group)"""
    stage = row['current_stage']
    if stage in ('delivered', 'closed'):
        return ('on_track', 0, None)

    cfg = config.get(stage)
    if not cfg:
        return ('on_track', 0, None)

    # Pick reference date: RAD or RSD
    if cfg['ref_date_type'] == 'rsd':
        ref = row.get('rsd')
    elif cfg['ref_date_type'] == 'rad':
        ref = row.get('rad2') or row.get('rad1')  # prefer updated RAD
    else:
        return ('on_track', 0, None)

    if not ref:
        return ('on_track', 0, None)

    # Apply offset (e.g. rsd-1 means must be done 1 day before rsd)
    meet_date = ref + timedelta(days=cfg['offset_days'])
    diff = business_days_diff(meet_date, today)

    if diff < 0:   return ('on_track', 0, None)
    if diff == 0:  return ('warning', 0, None)      # D-1
    if diff == 1:  return ('alert', 0, None)         # D-Day
    return ('aging', diff - 1, classify_aging(diff - 1))  # D+1~

4.3 Category Resolution
Prioritized waterfall from original category_02 CASE logic.
def resolve_category(row: dict) -> str | None:
    rad = row.get('rad2') or row.get('rad1')

    # 01: ERP booked too late
    if row['gerp_booked_date'] and row['order_date']:
        if (row['order_date'] - row['gerp_booked_date']).days <= -2:
            return '01_Order_Creation_Error'

    # 02: API Failure (order_date == rad1)
    if row['order_date'] and row['rad1']:
        if row['order_date'] == row['rad1']:
            return '02_API_Failure'

    # 09: On-time delivery
    if row['delivered_dt'] and rad:
        if row['delivered_dt'] <= rad:
            return '09_On_Time_Delivery'

    # 03: Warehouse planning late
    if (row.get('updated_pod_desc')
            and row['pick_release_date'] and rad
            and (row['pick_release_date'] - rad).days < -1
            and row['actual_shipment_date']
            and (row['actual_shipment_date'] - rad).days > -1):
        return '03_Warehouse_Planning_Late'

    # 04: Back order (by hold type)
    if row.get('first_hold_name') in (
            'BACK_ORDER_HOLD','OVERDUE_HOLD','FP_HOLD'):
        return '04_Back_Order'

    # 06: Order manipulation (by hold type)
    if row.get('first_hold_name') in (
            'MANUAL_HOLD','FUTURE_HOLD','CUSTOMER_HOLD','PAYTERM_HOLD'):
        return '06_Order_Manipulation'

    # 07: Carrier disruption
    if row.get('updated_pod_desc'):
        return '07_Carrier_Disruption'

    # 11: Customer-initiated LMD reschedule
    if row.get('cust_updated_pod_desc'):
        return '11_LMD_Schedule_Change_Cx'

    # 13: Hub capacity issue
    if row.get('actual_shipment_date') and row.get('hub_received_dt'):
        diff = business_days_diff(
            row['actual_shipment_date'], row['hub_received_dt'])
        if diff <= -2:
            return '13_Hub_Capacity'

    return None

4.4 Content Hash
Computed AFTER stage/alert resolution. Includes every field that affects dashboard display.
import hashlib

def compute_hash(row: dict) -> str:
    fields = [
        row.get('line_status_code',''),
        row.get('current_stage',''),
        row.get('alert_status',''),
        str(row.get('aging_days','')),
        row.get('category_code',''),
        str(row.get('order_date','')),
        str(row.get('gerp_booked_date','')),
        str(row.get('back_order_date','')),
        str(row.get('pick_release_date','')),
        str(row.get('load_plan_date','')),
        str(row.get('actual_shipment_date','')),
        str(row.get('hub_received_dt','')),
        str(row.get('out_for_delivery_dt','')),
        str(row.get('delivered_dt','')),
        str(row.get('rad1','')),
        str(row.get('rad2','')),
        str(row.get('rad3','')),
        str(row.get('rad4','')),
        str(row.get('rsd','')),
        row.get('first_hold_name',''),
    ]
    return hashlib.md5('|'.join(str(f) for f in fields).encode()).hexdigest()

4.5 ETL Main Loop
def run_etl(db_conn, stage_config: dict):
    today = date.today()
    snapshot_dt = datetime.now()

    # 1. Extract
    rows = db_conn.execute(EXTRACTION_QUERY, params).fetchall()

    for row in rows:
        row = dict(row)

        # 2. Compute RSD (reuse f_get_rsd logic in Python or call DB func)
        row['rsd'] = calc_rsd(row.get('rad1'), row.get('carrier_id'))

        # 3. Resolve stage
        row['current_stage'] = resolve_stage(row)

        # 4. Calculate alert
        row['alert_status'], row['aging_days'], row['aging_group'] = \
            calc_alert(row, stage_config, today)

        # 5. Resolve category
        row['category_code'] = resolve_category(row)

        # 6. Compute lead times
        row['lt_total'] = calc_lt(row['delivered_dt'], row['order_date'])
        row['lt_backorder_hold'] = calc_lt(row['back_order_date'],
                                           row['pick_release_date'])
        row['lt_stock_allocation'] = calc_lt(row['pick_release_date'],
                                             row['gerp_booked_date'])
        row['lt_fulfillment'] = calc_lt(row['actual_shipment_date'],
                                        row['load_plan_date'])
        row['lt_transit'] = calc_lt(row['delivered_dt'],
                                    row['actual_shipment_date'])

        # 7. Hash (after all computation)
        new_hash = compute_hash(row)

        # 8. Compare
        existing = db_conn.execute(
            'SELECT content_hash FROM order_tracking_current '
            'WHERE sales_order_no=:so AND order_line_id=:li',
            {'so': row['sales_order_no'], 'li': row['order_line_id']}
        ).fetchone()

        if existing and existing['content_hash'] == new_hash:
            continue  # No change, skip

        # 9. Write (single transaction)
        row['content_hash'] = new_hash
        row['snapshot_dt'] = snapshot_dt
        db_conn.execute(INSERT_SNAPSHOT_SQL, row)
        db_conn.execute(UPSERT_CURRENT_SQL, row)

    db_conn.commit()
 
5. Dashboard Queries
All from order_tracking_current. No joins to source tables. No runtime computation.

5.1 KPI Summary
SELECT
    COUNT(*)                                                        AS total_orders,
    SUM(current_stage IN ('delivered','closed'))                     AS on_time,
    SUM(alert_status = 'aging')                                     AS delayed,
    SUM(current_stage = 'backorder_hold')                           AS backorder,
    SUM(rad2 IS NOT NULL OR rad3 IS NOT NULL)                       AS rescheduled,
    SUM(alert_status = 'warning')                                   AS warning_d1,
    SUM(alert_status = 'alert')                                     AS alert_dday,
    SUM(alert_status = 'aging')                                     AS aging_total,
    AVG(lt_total)                                                   AS avg_lead_time
FROM order_tracking_current
WHERE order_date BETWEEN :start AND :end;

5.2 Stage Pipeline
SELECT current_stage,
    COUNT(*)                           AS total,
    SUM(alert_status = 'warning')      AS warning,
    SUM(alert_status = 'alert')        AS alert,
    SUM(alert_status = 'aging')        AS aging,
    AVG(lt_total)                      AS avg_lt
FROM order_tracking_current
WHERE order_date BETWEEN :start AND :end
GROUP BY current_stage
ORDER BY FIELD(current_stage,
    'ordered','booked','backorder_hold','pick_released',
    'load_planning','shipped',
    'hub_received','out_for_delivery','delivered','closed');

5.3 Aging Breakdown
SELECT aging_group, COUNT(*) AS cnt, AVG(aging_days) AS avg_aging
FROM order_tracking_current
WHERE alert_status = 'aging'
    AND order_date BETWEEN :start AND :end
GROUP BY aging_group
ORDER BY FIELD(aging_group,
    'aging_1_3','aging_4_7','aging_8_14','aging_15_plus');

5.4 List View
SELECT sales_order_no, order_line_id, cust_po_no, model_code,
    current_stage, alert_status, aging_days, aging_group,
    category_code, order_date, gerp_booked_date,
    pick_release_date, actual_shipment_date,
    hub_received_dt, out_for_delivery_dt, delivered_dt,
    rad1, rad2, rad3, rsd, first_hold_name, lt_total
FROM order_tracking_current
WHERE order_date BETWEEN :start AND :end
    AND (:po IS NULL OR cust_po_no = :po)
    AND (:stage IS NULL OR current_stage = :stage)
    AND (:alert IS NULL OR alert_status = :alert)
ORDER BY FIELD(alert_status,'aging','alert','warning','on_track'),
    aging_days DESC, order_date;

5.5 Detail View (Overlay)
-- Current state
SELECT * FROM order_tracking_current
WHERE sales_order_no = :so AND order_line_id = :li;

-- History timeline
SELECT snapshot_dt, current_stage, alert_status, aging_days,
    order_date, gerp_booked_date, back_order_date,
    pick_release_date, load_plan_date, actual_shipment_date,
    hub_received_dt, out_for_delivery_dt, delivered_dt,
    category_code, first_hold_name
FROM order_tracking_snapshot
WHERE sales_order_no = :so AND order_line_id = :li
ORDER BY snapshot_dt;
 
6. ETL Load SQL
6.1 Snapshot INSERT
INSERT INTO order_tracking_snapshot (
    snapshot_dt, sales_order_no, order_line_id,
    cust_po_no, model_code, bill_to_customer_code,
    unit_selling_price, line_status_code,
    current_stage, alert_status, aging_days, aging_group,
    category_code, category_accumulated,
    order_date, gerp_booked_date, back_order_date, pick_release_date,
    load_plan_date, actual_shipment_date,
    hub_received_dt, out_for_delivery_dt, delivered_dt,
    rad1, rad2, rad3, rad4, rsd,
    first_hold_name, hold_names, hold_dates,
    scheduled_pod_desc, scheduled_pod_dt,
    cust_updated_pod_desc, updated_pod_desc,
    received_agent_pod_dt, out_delivery_pod_dt, completed_pod_dt,
    lt_total, lt_backorder_hold, lt_stock_allocation,
    lt_fulfillment, lt_transit,
    content_hash
) VALUES (
    :snapshot_dt, :sales_order_no, :order_line_id,
    :cust_po_no, :model_code, :bill_to_customer_code,
    :unit_selling_price, :line_status_code,
    :current_stage, :alert_status, :aging_days, :aging_group,
    :category_code, :category_accumulated,
    :order_date, :gerp_booked_date, :back_order_date, :pick_release_date,
    :load_plan_date, :actual_shipment_date,
    :hub_received_dt, :out_for_delivery_dt, :delivered_dt,
    :rad1, :rad2, :rad3, :rad4, :rsd,
    :first_hold_name, :hold_names, :hold_dates,
    :scheduled_pod_desc, :scheduled_pod_dt,
    :cust_updated_pod_desc, :updated_pod_desc,
    :received_agent_pod_dt, :out_delivery_pod_dt, :completed_pod_dt,
    :lt_total, :lt_backorder_hold, :lt_stock_allocation,
    :lt_fulfillment, :lt_transit,
    :content_hash
);

6.2 Current UPSERT
INSERT INTO order_tracking_current (
    sales_order_no, order_line_id, last_updated_dt,
    cust_po_no, model_code, bill_to_customer_code,
    unit_selling_price, line_status_code,
    current_stage, alert_status, aging_days, aging_group,
    category_code, category_accumulated,
    order_date, gerp_booked_date, back_order_date, pick_release_date,
    load_plan_date, actual_shipment_date,
    hub_received_dt, out_for_delivery_dt, delivered_dt,
    rad1, rad2, rad3, rad4, rsd,
    first_hold_name, hold_names, hold_dates,
    scheduled_pod_desc, scheduled_pod_dt,
    cust_updated_pod_desc, updated_pod_desc,
    received_agent_pod_dt, out_delivery_pod_dt, completed_pod_dt,
    lt_total, lt_backorder_hold, lt_stock_allocation,
    lt_fulfillment, lt_transit,
    content_hash
) VALUES (
    :sales_order_no, :order_line_id, :snapshot_dt,
    :cust_po_no, :model_code, :bill_to_customer_code,
    :unit_selling_price, :line_status_code,
    :current_stage, :alert_status, :aging_days, :aging_group,
    :category_code, :category_accumulated,
    :order_date, :gerp_booked_date, :back_order_date, :pick_release_date,
    :load_plan_date, :actual_shipment_date,
    :hub_received_dt, :out_for_delivery_dt, :delivered_dt,
    :rad1, :rad2, :rad3, :rad4, :rsd,
    :first_hold_name, :hold_names, :hold_dates,
    :scheduled_pod_desc, :scheduled_pod_dt,
    :cust_updated_pod_desc, :updated_pod_desc,
    :received_agent_pod_dt, :out_delivery_pod_dt, :completed_pod_dt,
    :lt_total, :lt_backorder_hold, :lt_stock_allocation,
    :lt_fulfillment, :lt_transit,
    :content_hash
) ON DUPLICATE KEY UPDATE
    last_updated_dt      = VALUES(last_updated_dt),
    cust_po_no           = VALUES(cust_po_no),
    model_code           = VALUES(model_code),
    bill_to_customer_code= VALUES(bill_to_customer_code),
    unit_selling_price   = VALUES(unit_selling_price),
    line_status_code     = VALUES(line_status_code),
    current_stage        = VALUES(current_stage),
    alert_status         = VALUES(alert_status),
    aging_days           = VALUES(aging_days),
    aging_group          = VALUES(aging_group),
    category_code        = VALUES(category_code),
    category_accumulated = VALUES(category_accumulated),
    order_date           = VALUES(order_date),
    gerp_booked_date     = VALUES(gerp_booked_date),
    back_order_date      = VALUES(back_order_date),
    pick_release_date    = VALUES(pick_release_date),
    load_plan_date       = VALUES(load_plan_date),
    actual_shipment_date = VALUES(actual_shipment_date),
    hub_received_dt      = VALUES(hub_received_dt),
    out_for_delivery_dt  = VALUES(out_for_delivery_dt),
    delivered_dt         = VALUES(delivered_dt),
    rad1                 = VALUES(rad1),
    rad2                 = VALUES(rad2),
    rad3                 = VALUES(rad3),
    rad4                 = VALUES(rad4),
    rsd                  = VALUES(rsd),
    first_hold_name      = VALUES(first_hold_name),
    hold_names           = VALUES(hold_names),
    hold_dates           = VALUES(hold_dates),
    scheduled_pod_desc   = VALUES(scheduled_pod_desc),
    scheduled_pod_dt     = VALUES(scheduled_pod_dt),
    cust_updated_pod_desc= VALUES(cust_updated_pod_desc),
    updated_pod_desc     = VALUES(updated_pod_desc),
    received_agent_pod_dt= VALUES(received_agent_pod_dt),
    out_delivery_pod_dt  = VALUES(out_delivery_pod_dt),
    completed_pod_dt     = VALUES(completed_pod_dt),
    lt_total             = VALUES(lt_total),
    lt_backorder_hold    = VALUES(lt_backorder_hold),
    lt_stock_allocation  = VALUES(lt_stock_allocation),
    lt_fulfillment       = VALUES(lt_fulfillment),
    lt_transit           = VALUES(lt_transit),
    content_hash         = VALUES(content_hash);

GET /api/dashboard/kpi?start=2026-01-01&end=2026-01-31
Response:
{
  "total_orders": 1250,
  "on_time": 980,
  "on_time_pct": 78.4,
  "delayed": 85,
  "backorder": 42,
  "rescheduled": 63,
  "warning_d1": 28,
  "alert_dday": 15,
  "aging_total": 85,
  "avg_lead_time": 6.3,
  "avg_fulfillment": 2.1,
  "avg_transit": 3.8
}

GET /api/dashboard/pipeline?start=2026-01-01&end=2026-01-31
Response:
[
  {"stage": "ordered", "total": 45, "warning": 3, "alert": 1, "aging": 0},
  {"stage": "booked", "total": 32, "warning": 5, "alert": 2, "aging": 1},
  ...
]

GET /api/dashboard/aging?start=2026-01-01&end=2026-01-31
Response:
[
  {"aging_group": "aging_1_3", "count": 35, "avg_days": 2.1},
  {"aging_group": "aging_4_7", "count": 28, "avg_days": 5.4},
  {"aging_group": "aging_8_14", "count": 15, "avg_days": 10.2},
  {"aging_group": "aging_15_plus", "count": 7, "avg_days": 22.1}
]

GET /api/dashboard/otd-trend?start=2026-01-01&end=2026-01-31
Query: SELECT order_date, COUNT(*) AS total,
  SUM(delivered_dt <= COALESCE(rad2,rad1)) AS on_time
  FROM order_tracking_current
  WHERE current_stage IN ('delivered','closed')
  AND order_date BETWEEN :start AND :end
  GROUP BY order_date ORDER BY order_date
Response:
[
  {"date": "2026-01-01", "total": 42, "on_time": 38, "otd_pct": 90.5},
  {"date": "2026-01-02", "total": 55, "on_time": 47, "otd_pct": 85.5},
  ...
]

GET /api/dashboard/delay-trend?start=2026-01-01&end=2026-01-31
Query: SELECT order_date, SUM(alert_status='aging') AS delayed,
  AVG(CASE WHEN aging_days>0 THEN aging_days END) AS avg_delay
  FROM order_tracking_current
  WHERE order_date BETWEEN :start AND :end
  GROUP BY order_date ORDER BY order_date
Response:
[
  {"date": "2026-01-01", "delayed": 5, "avg_delay_days": 3.2},
  ...
]

GET /api/orders?start=2026-01-01&end=2026-01-31&po=&stage=&alert=&page=1&size=50
Response:
{
  "total": 1250,
  "page": 1,
  "data": [
    {
      "sales_order_no": "SO123456",
      "order_line_id": "1",
      "cust_po_no": "PO789",
      "model_code": "OLED55C4",
      "current_stage": "shipped",
      "alert_status": "aging",
      "aging_days": 3,
      "order_date": "2026-01-10",
      "rad1": "2026-01-16",
      "lt_total": null,
      ...
    }
  ]
}

GET /api/orders/{sales_order_no}/{order_line_id}
Response:
{
  "current": { /* full row from order_tracking_current */ },
  "history": [
    {"snapshot_dt": "2026-01-10 08:00:00", "current_stage": "ordered", "alert_status": "on_track"},
    {"snapshot_dt": "2026-01-10 14:00:00", "current_stage": "booked", "alert_status": "on_track"},
    {"snapshot_dt": "2026-01-12 08:00:00", "current_stage": "shipped", "alert_status": "warning"},
    ...
  ]
}
Section 8. Dashboard Layout
┌─────────────────────────────────────────────────────────────┐
│ FILTERS                                                      │
│ [Date Range] [PO Search] [Stage ▼] [Alert ▼]                │
└─────────────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Total    │ OTD      │ Avg Lead │ Avg      │ Avg      │ Back-    │
│ Orders   │ Rate     │ Time     │ Fulfill  │ Transit  │ Orders   │
│ 1,250    │ 78.4%    │ 6.3d     │ 2.1d     │ 3.8d     │ 42       │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

┌───────────┬───────────┬───────────┐
│ ⚠ Warning │ 🔴 Alert  │ 📊 Aging  │
│ D-1: 28   │ D-Day: 15 │ Total: 85 │
│           │           │ 1-3d: 35  │
│           │           │ 4-7d: 28  │
│           │           │ 8-14d: 15 │
│           │           │ 15+d: 7   │
└───────────┴───────────┴───────────┘

┌─────────────────────────────────────────────────────────────┐
│ END-TO-END PIPELINE  (horizontal stage flow)                 │
│                                                              │
│ Order → Booked → BackOrder → PickRel → LoadPlan → Shipped   │
│  45      32        12         28        18         65        │
│                                                              │
│ → HubRecv → OutForDel → Delivered                            │
│    42        35          980                                 │
│                                                              │
│ Each box shows: total / warning(yellow) / alert(red) / aging │
│ GET /api/dashboard/pipeline                                  │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────────┬────────────────────────────┐
│ OTD TREND (Line Chart)     │ DELAY TREND (Line Chart)   │
│ X: order_date              │ X: order_date              │
│ Y: otd_pct (%)             │ Y: delayed count           │
│ GET /api/dashboard/        │ GET /api/dashboard/        │
│     otd-trend              │     delay-trend            │
└────────────────────────────┴────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ AGING MONITORING (Stacked Bar Chart)                         │
│ X: aging groups (1-3, 4-7, 8-14, 15+)                       │
│ Y: count                                                     │
│ Color: by current_stage                                      │
│ GET /api/dashboard/aging                                     │
└─────────────────────────────────────────────────────────────┘

Click any pipeline stage or aging bar → navigates to LIST VIEW

┌─────────────────────────────────────────────────────────────┐
│ LIST VIEW (Table with sort/filter)                           │
│ Columns: PO, SO, Model, Stage, Alert, Aging, Order Date,    │
│          RAD1, Delivered, Lead Time                           │
│ Sort default: aging desc, then alert, then warning           │
│ Pagination: 50 per page                                      │
│ Export: CSV button                                            │
│ GET /api/orders                                              │
└─────────────────────────────────────────────────────────────┘

Click any row → opens DETAIL OVERLAY

┌─────────────────────────────────────────────────────────────┐
│ DETAIL OVERLAY (Modal/Slide-over)                            │
│ Header: PO / SO / Model / Order Date                         │
│ Status: current_stage + alert badge                          │
│                                                              │
│ TIMELINE (vertical):                                         │
│   ● Order      2026-01-10                                    │
│   ● Booked     2026-01-10                                    │
│   ● Shipped    2026-01-12                                    │
│   ○ Hub Recv   (pending)                                     │
│   ○ Delivered  (pending)                                     │
│                                                              │
│ GET /api/orders/{so}/{line_id}                               │
└─────────────────────────────────────────────────────────────┘

All filters apply globally: changing a filter refreshes
KPI tiles + pipeline + charts + list simultaneously.

