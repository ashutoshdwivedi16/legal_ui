"""Alert calculation: business-day diff between today and reference date."""

from datetime import date, timedelta


def business_days_diff(d1: date, d2: date) -> int:
    """Positive if d2 > d1 (overdue)."""
    if d1 == d2:
        return 0
    sign = 1 if d2 > d1 else -1
    start, end = min(d1, d2), max(d1, d2)
    count = sum(
        1 for i in range((end - start).days)
        if (start + timedelta(days=i + 1)).weekday() < 5
    )
    return count * sign


def classify_aging(days: int) -> str | None:
    if days <= 0:
        return None
    if days <= 3:
        return "aging_1_3"
    if days <= 7:
        return "aging_4_7"
    if days <= 14:
        return "aging_8_14"
    return "aging_15_plus"


def calc_alert(row: dict, config: dict, today: date) -> tuple:
    """Returns (alert_status, aging_days, aging_group)."""
    stage = row.get("current_stage", "")
    if stage in ("delivered", "closed"):
        return ("on_track", 0, None)

    cfg = config.get(stage)
    if not cfg:
        return ("on_track", 0, None)

    # Pick reference date: RAD or RSD
    if cfg["ref_date_type"] == "rsd":
        ref = row.get("rsd")
    elif cfg["ref_date_type"] == "rad":
        ref = row.get("rad2") or row.get("rad1")
    else:
        return ("on_track", 0, None)

    if not ref:
        return ("on_track", 0, None)

    # Apply offset (e.g. rsd-1 means must be done 1 day before rsd)
    meet_date = ref + timedelta(days=cfg["offset_days"])
    diff = business_days_diff(meet_date, today)

    if diff < 0:
        return ("on_track", 0, None)
    if diff == 0:
        return ("warning", 0, None)  # D-1
    if diff == 1:
        return ("alert", 0, None)  # D-Day
    return ("aging", diff - 1, classify_aging(diff - 1))  # D+1~
