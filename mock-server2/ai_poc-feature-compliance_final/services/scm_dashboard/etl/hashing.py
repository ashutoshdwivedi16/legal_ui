"""Content hash for change detection."""

import hashlib


def compute_hash(row: dict) -> str:
    """Hash only actual data fields, exclude computed values."""
    fields = [
        row.get("line_status_code", ""),
        row.get("current_stage", ""),
        row.get("category_code", ""),
        str(row.get("order_date", "")),
        str(row.get("gerp_booked_date", "")),
        str(row.get("back_order_date", "")),
        str(row.get("pick_release_date", "")),
        str(row.get("load_plan_date", "")),
        str(row.get("actual_shipment_date", "")),
        str(row.get("hub_received_dt", "")),
        str(row.get("out_for_delivery_dt", "")),
        str(row.get("delivered_dt", "")),
        str(row.get("rad1", "")),
        str(row.get("rad2", "")),
        str(row.get("rad3", "")),
        str(row.get("rad4", "")),
        str(row.get("rsd", "")),
        row.get("first_hold_name", ""),
    ]
    return hashlib.md5("|".join(str(f) for f in fields).encode()).hexdigest()
