from sqlalchemy import (
    Column, String, Integer, Date, DateTime, Numeric, Text, Index,
    SmallInteger, func,
)
from services.scm_dashboard.db import Base


class OrderTrackingCurrent(Base):
    __tablename__ = "order_tracking_current"

    sales_order_no = Column(String(30), primary_key=True)
    order_line_id = Column(String(30), primary_key=True)
    last_updated_dt = Column(DateTime, nullable=False, server_default=func.now())

    cust_po_no = Column(String(30))
    model_code = Column(String(50))
    bill_to_customer_code = Column(String(50))
    unit_selling_price = Column(Numeric(12, 2))
    line_status_code = Column(String(30))
    status_full = Column(String(60))
    carrier_code = Column(String(10))
    warehouse_code = Column(String(20))
    current_stage = Column(String(30), nullable=False)

    order_date = Column(Date)
    gerp_booked_date = Column(Date)
    back_order_date = Column(Date)
    pick_release_date = Column(Date)
    picking_date = Column(Date)
    actual_shipment_date = Column(Date)
    sales_date = Column(Date)
    load_plan_date = Column(Date)
    routed_date = Column(Date)
    wms_shipped_date = Column(Date)
    hub_received_dt = Column(Date)
    out_for_delivery_dt = Column(Date)
    delivered_dt = Column(Date)

    rad = Column(Date)
    rad_rescheduled = Column(Date)
    rsd = Column(Date)

    first_hold_name = Column(String(50))
    hold_names = Column(Text)
    hold_dates = Column(Text)
    has_backorder_hold = Column(SmallInteger, default=0)

    lt_total = Column(Integer)
    lt_backorder_hold = Column(Integer)
    lt_fulfillment = Column(Integer)
    lt_transit = Column(Integer)

    __table_args__ = (
        Index("idx_curr_stage", "current_stage"),
        Index("idx_curr_order_date", "order_date"),
        Index("idx_curr_composite", "order_date", "current_stage"),
    )


class OrderTrackingCompleted(Base):
    __tablename__ = "order_tracking_completed"

    sales_order_no = Column(String(30), primary_key=True)
    order_line_id = Column(String(30), primary_key=True)
    completed_dt = Column(DateTime, nullable=False)
    last_updated_dt = Column(DateTime, nullable=False, server_default=func.now())

    cust_po_no = Column(String(30))
    model_code = Column(String(50))
    bill_to_customer_code = Column(String(50))
    unit_selling_price = Column(Numeric(12, 2))
    line_status_code = Column(String(30))
    status_full = Column(String(60))
    carrier_code = Column(String(10))
    warehouse_code = Column(String(20))
    current_stage = Column(String(30), nullable=False)

    order_date = Column(Date)
    gerp_booked_date = Column(Date)
    back_order_date = Column(Date)
    pick_release_date = Column(Date)
    picking_date = Column(Date)
    actual_shipment_date = Column(Date)
    sales_date = Column(Date)
    load_plan_date = Column(Date)
    routed_date = Column(Date)
    wms_shipped_date = Column(Date)
    hub_received_dt = Column(Date)
    out_for_delivery_dt = Column(Date)
    delivered_dt = Column(Date)

    rad = Column(Date)
    rad_rescheduled = Column(Date)
    rsd = Column(Date)

    first_hold_name = Column(String(50))
    hold_names = Column(Text)
    hold_dates = Column(Text)
    has_backorder_hold = Column(SmallInteger, default=0)

    lt_total = Column(Integer)
    lt_backorder_hold = Column(Integer)
    lt_fulfillment = Column(Integer)
    lt_transit = Column(Integer)

    __table_args__ = (
        Index("idx_comp_order_date", "order_date"),
        Index("idx_comp_stage", "current_stage"),
    )

    
# from sqlalchemy import (
#     Column, String, Integer, Date, DateTime, Numeric, Text, Index,
#     SmallInteger, func,
# )
# from db import Base


# class OrderTrackingCurrent(Base):
#     """One row per in-progress order line."""
#     __tablename__ = "order_tracking_current"

#     sales_order_no = Column(String(30), primary_key=True)
#     order_line_id = Column(String(30), primary_key=True)
#     last_updated_dt = Column(DateTime, nullable=False, server_default=func.now())

#     cust_po_no = Column(String(30))
#     model_code = Column(String(50))
#     bill_to_customer_code = Column(String(50))
#     unit_selling_price = Column(Numeric(12, 2))
#     line_status_code = Column(String(30))
#     status_full = Column(String(60))
#     carrier_code = Column(String(10))
#     warehouse_code = Column(String(20))
#     current_stage = Column(String(30), nullable=False)

#     order_date = Column(Date)
#     gerp_booked_date = Column(Date)
#     pick_release_date = Column(Date)
#     picking_date = Column(Date)
#     actual_shipment_date = Column(Date)
#     sales_date = Column(Date)
#     load_plan_date = Column(Date)
#     routed_date = Column(Date)
#     wms_shipped_date = Column(Date)
#     hub_received_dt = Column(Date)
#     out_for_delivery_dt = Column(Date)
#     delivered_dt = Column(Date)

#     rad = Column(Date)
#     rad_rescheduled = Column(Date)
#     rsd = Column(Date)

#     first_hold_name = Column(String(50))
#     hold_names = Column(Text)
#     hold_dates = Column(Text)
#     has_backorder_hold = Column(SmallInteger, default=0)

#     lt_total = Column(Integer)
#     lt_backorder_hold = Column(Integer)
#     lt_fulfillment = Column(Integer)
#     lt_transit = Column(Integer)

#     __table_args__ = (
#         Index("idx_curr_stage", "current_stage"),
#         Index("idx_curr_order_date", "order_date"),
#         Index("idx_curr_composite", "order_date", "current_stage"),
#     )


# class OrderTrackingCompleted(Base):
#     """Delivered / closed order lines."""
#     __tablename__ = "order_tracking_completed"

#     sales_order_no = Column(String(30), primary_key=True)
#     order_line_id = Column(String(30), primary_key=True)
#     completed_dt = Column(DateTime, nullable=False)
#     last_updated_dt = Column(DateTime, nullable=False, server_default=func.now())

#     cust_po_no = Column(String(30))
#     model_code = Column(String(50))
#     bill_to_customer_code = Column(String(50))
#     unit_selling_price = Column(Numeric(12, 2))
#     line_status_code = Column(String(30))
#     status_full = Column(String(60))
#     carrier_code = Column(String(10))
#     warehouse_code = Column(String(20))
#     current_stage = Column(String(30), nullable=False)

#     order_date = Column(Date)
#     gerp_booked_date = Column(Date)
#     pick_release_date = Column(Date)
#     picking_date = Column(Date)
#     actual_shipment_date = Column(Date)
#     sales_date = Column(Date)
#     load_plan_date = Column(Date)
#     routed_date = Column(Date)
#     wms_shipped_date = Column(Date)
#     hub_received_dt = Column(Date)
#     out_for_delivery_dt = Column(Date)
#     delivered_dt = Column(Date)

#     rad = Column(Date)
#     rad_rescheduled = Column(Date)
#     rsd = Column(Date)

#     first_hold_name = Column(String(50))
#     hold_names = Column(Text)
#     hold_dates = Column(Text)
#     has_backorder_hold = Column(SmallInteger, default=0)

#     lt_total = Column(Integer)
#     lt_backorder_hold = Column(Integer)
#     lt_fulfillment = Column(Integer)
#     lt_transit = Column(Integer)

#     __table_args__ = (
#         Index("idx_comp_order_date", "order_date"),
#         Index("idx_comp_stage", "current_stage"),
#     )

