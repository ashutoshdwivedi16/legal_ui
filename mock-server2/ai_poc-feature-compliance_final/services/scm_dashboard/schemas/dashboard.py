from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class KpiSummary(BaseModel):
    total_orders: int = 0
    on_time: int = 0
    on_time_pct: float = 0.0
    delayed: int = 0
    backorder: int = 0
    warning_d1: int = 0
    alert_dday: int = 0
    aging_total: int = 0
    rescheduled: int = 0
    canceled: int = 0  # #8: new
    avg_lead_time: Optional[float] = None


class PipelineStage(BaseModel):
    stage: str
    total: int = 0
    avg_lt: Optional[float] = None
    # #9: removed warning/alert/aging
    # #14: color counts (only for 7 stages, None for others)
    green: Optional[int] = None
    yellow: Optional[int] = None
    red: Optional[int] = None


class AgingGroup(BaseModel):
    aging_group: str
    count: int = 0
    avg_days: Optional[float] = None


class TrendPoint(BaseModel):
    date: date
    total: int = 0
    on_time: int = 0
    otd_pct: float = 0.0


class DelayTrendPoint(BaseModel):
    date: date
    delayed: int = 0
    avg_delay_days: Optional[float] = None


class AlertAgingTrendPoint(BaseModel):
    date: date
    alert_count: int = 0
    aging_count: int = 0


class CommentItem(BaseModel):
    entity_id: int
    comment: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None


class EtaUpdateItem(BaseModel):
    history_id: int
    source: Optional[str] = None
    send_email: Optional[str] = None
    eta_date_from: Optional[date] = None
    eta_date_to: Optional[date] = None
    created_at: Optional[datetime] = None


class OrderListItem(BaseModel):
    sales_order_no: str
    order_line_id: str
    cust_po_no: Optional[str] = None
    model_code: Optional[str] = None
    bill_to_customer_code: Optional[str] = None
    unit_selling_price: Optional[float] = None
    line_status_code: Optional[str] = None
    line_status_code2: Optional[str] = None  # #5: separate column
    status_full: Optional[str] = None
    carrier_code: Optional[str] = None
    warehouse_code: Optional[str] = None
    current_stage: str
    delivery_status: str = "on_track"
    delay_days: int = 0
    aging_group: Optional[str] = None

    # #13: All TIMESTAMP
    order_date: Optional[datetime] = None
    gerp_booked_date: Optional[datetime] = None
    back_order_date: Optional[datetime] = None
    pick_release_date: Optional[datetime] = None
    picking_date: Optional[datetime] = None
    actual_shipment_date: Optional[datetime] = None
    sales_date: Optional[datetime] = None
    load_plan_date: Optional[datetime] = None
    routed_date: Optional[datetime] = None
    wms_shipped_date: Optional[datetime] = None
    hub_received_dt: Optional[datetime] = None
    out_for_delivery_dt: Optional[datetime] = None
    delivered_dt: Optional[datetime] = None

    rad: Optional[datetime] = None
    rad_rescheduled: Optional[datetime] = None
    rsd: Optional[datetime] = None
    magento_rad2: Optional[datetime] = None

    first_hold_name: Optional[str] = None
    hold_names: Optional[str] = None
    hold_dates: Optional[str] = None
    has_backorder_hold: int = 0

    lt_total: Optional[int] = None
    lt_backorder_hold: Optional[int] = None
    lt_fulfillment: Optional[int] = None
    lt_transit: Optional[int] = None

    consignee_name: Optional[str] = None
    contact_email_addr: Optional[str] = None
    include_tax_amount: Optional[float] = None
    shipping_address: Optional[str] = None
    consignee_phone_no: Optional[str] = None

    magento_po_order_id: Optional[int] = None
    magento_customer_po_no: Optional[int] = None
    magento_po_created_at: Optional[datetime] = None
    magento_erp_exported_at: Optional[datetime] = None
    am_st_pod_dt: Optional[datetime] = None
    load_id: Optional[str] = None

    source: str = "current"

    class Config:
        extra = "ignore"


class OrderListResponse(BaseModel):
    total: int
    page: int
    data: list[OrderListItem]


class OrderDetailResponse(BaseModel):
    order: OrderListItem
    comments: list[CommentItem] = []
    eta_updates: list[EtaUpdateItem] = []


class StageDelayTrendPoint(BaseModel):
    date: date
    delayed: int = 0
    avg_delay_days: Optional[float] = None


class StageDelaySummary(BaseModel):
    avg_delay: Optional[float] = None
    total_delayed: int = 0
    peak_delay_day: Optional[date] = None


class StageDelayTrendResponse(BaseModel):
    stage: str
    summary: StageDelaySummary
    trend: list[StageDelayTrendPoint] = []

