"""Category resolution: prioritized waterfall from CASE logic."""

from services.scm_dashboard.etl.alert import business_days_diff


def resolve_category(row: dict) -> str | None:
    rad = row.get("rad2") or row.get("rad1")

    # 01: ERP booked too late
    if row.get("gerp_booked_date") and row.get("order_date"):
        if (row["order_date"] - row["gerp_booked_date"]).days <= -2:
            return "01_Order_Creation_Error"

    # 02: API Failure (order_date == rad1)
    if row.get("order_date") and row.get("rad1"):
        if row["order_date"] == row["rad1"]:
            return "02_API_Failure"

    # 09: On-time delivery
    if row.get("delivered_dt") and rad:
        if row["delivered_dt"] <= rad:
            return "09_On_Time_Delivery"

    # 03: Warehouse planning late
    if (
        row.get("updated_pod_desc")
        and row.get("pick_release_date")
        and rad
        and (row["pick_release_date"] - rad).days < -1
        and row.get("actual_shipment_date")
        and (row["actual_shipment_date"] - rad).days > -1
    ):
        return "03_Warehouse_Planning_Late"

    # 04: Back order (by hold type)
    if row.get("first_hold_name") in (
        "BACK_ORDER_HOLD",
        "OVERDUE_HOLD",
        "FP_HOLD",
    ):
        return "04_Back_Order"

    # 06: Order manipulation (by hold type)
    if row.get("first_hold_name") in (
        "MANUAL_HOLD",
        "FUTURE_HOLD",
        "CUSTOMER_HOLD",
        "PAYTERM_HOLD",
    ):
        return "06_Order_Manipulation"

    # 07: Carrier disruption
    if row.get("updated_pod_desc"):
        return "07_Carrier_Disruption"

    # 11: Customer-initiated LMD reschedule
    if row.get("cust_updated_pod_desc"):
        return "11_LMD_Schedule_Change_Cx"

    # 13: Hub capacity issue
    if row.get("actual_shipment_date") and row.get("hub_received_dt"):
        diff = business_days_diff(
            row["actual_shipment_date"], row["hub_received_dt"]
        )
        if diff <= -2:
            return "13_Hub_Capacity"

    return None
