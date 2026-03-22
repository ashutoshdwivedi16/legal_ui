"""Stage resolution — determine current_stage for a line item.

Changes from original:
- #2: Delivered = D1/NS only (X1 removed) OR (sales_date AND line_status_code='CLOSED')
- #4: hub_received — removed fulfillment_date IS NULL condition
- #12: shipped — uses COALESCE logic (wms_shipped_date or actual_shipment_date)
"""

from typing import Optional


def resolve_stage(row: dict) -> str:
    """Determine current_stage for a line item. First match wins."""

    # Canceled
    if row.get("line_status_code") == "CANCELLED":
        return "canceled"
    if (row.get("magento_export_status") == 0
        and (row.get("magento_qty_canceled") == 1
             or row.get("magento_qty_refunded") == 1)):
        return "canceled"

    # Delivered: EDI D1/NS only, OR (sales_date + CLOSED)
    # X1/NS removed per requirement #2
    if row.get("delivered_dt"):
        return "delivered"
    if row.get("sales_date") and row.get("line_status_code") == "CLOSED":
        return "delivered"

    # Out for Delivery: EDI AM-NS, shipped, not yet fulfilled
    if row.get("out_for_delivery_dt") and not row.get("fulfillment_date"):
        return "out_for_delivery"

    # Hub Received: EDI X4-NS + actual_shipment_date
    # fulfillment_date check removed per requirement #4
    if row.get("hub_received_dt") and row.get("actual_shipment_date"):
        return "hub_received"

    # Shipped: wms_shipped_date OR actual_shipment_date
    if row.get("wms_shipped_date") or row.get("actual_shipment_date"):
        return "shipped"

    # Routed: tms status=03
    if row.get("routed_date"):
        return "routed"

    # Load Planning: tms status=02
    if row.get("load_plan_date"):
        return "load_planning"

    # Pick Released: pick_release_date set, picking not yet done
    if row.get("pick_release_date") and not row.get("picking_date"):
        return "pick_released"

    # Back-Order Hold
    if row.get("has_backorder_hold"):
        return "backorder_hold"

    # Booked: booked_date set, no pick_release
    if row.get("gerp_booked_date") and not row.get("pick_release_date"):
        return "booked"

    # Magento Order (default)
    return "magento_order"

# from typing import Optional
# def resolve_stage(row: dict) -> str:
#     """Determine current_stage for a line item. Check delivered first."""

#     # Canceled
#     if row.get("line_status_code") == "CANCELLED":
#         return "canceled"
#     if (row.get("magento_export_status") == 0
#         and (row.get("magento_qty_canceled") == 1
#              or row.get("magento_qty_refunded") == 1)):
#         return "canceled"
    
#     # Delivered: EDI D1/X1 OR sales_date set
#     if row.get("delivered_dt") or row.get("sales_date"):
#         return "delivered"

#     # Out for Delivery: EDI AM-NS, shipped, not yet fulfilled
#     if row.get("out_for_delivery_dt") and not row.get("fulfillment_date"):
#         return "out_for_delivery"

#     # Hub Received: EDI X4-NS, shipped, not yet fulfilled
#     if row.get("hub_received_dt") and row.get("actual_shipment_date") and not row.get("fulfillment_date"):
#         return "hub_received"

#     # WMS Shipped: tms status=07 or actual_shipment_date
#     if row.get("wms_shipped_date") or row.get("actual_shipment_date"):
#         return "shipped"

#     # TMS Routed: tms status=03
#     if row.get("routed_date"):
#         return "routed"

#     # TMS Load Planning: tms status=02
#     if row.get("load_plan_date"):
#         return "load_planning"

#     # Pick Released: pick_release_date set, picking not yet done
#     if row.get("pick_release_date") and not row.get("picking_date"):
#         return "pick_released"

#     # Back-Order Hold: has back-order hold flag
#     if row.get("has_backorder_hold"):
#         return "backorder_hold"

#     # Booked: booked_date set, no pick_release
#     if row.get("gerp_booked_date") and not row.get("pick_release_date"):
#         return "booked"

#     # Magento Order (default)
#     return "magento_order" 
