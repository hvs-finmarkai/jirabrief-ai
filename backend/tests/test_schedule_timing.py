from __future__ import annotations
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import pytest
from app.schedules.service import calculate_next_run


def _at(iso: str, tz: str = "UTC") -> datetime:
    return datetime.fromisoformat(iso).replace(tzinfo=ZoneInfo(tz))


def test_daily_next_run_is_later_today_when_time_has_not_passed():
    after = _at("2026-07-26T06:00:00", "UTC")
    nxt = calculate_next_run("daily", "09:00", "UTC", after=after)
    assert nxt == datetime(2026, 7, 26, 9, 0, tzinfo=timezone.utc)


def test_daily_rolls_to_tomorrow_once_the_time_has_passed():
    after = _at("2026-07-26T10:00:00", "UTC")
    nxt = calculate_next_run("daily", "09:00", "UTC", after=after)
    assert nxt == datetime(2026, 7, 27, 9, 0, tzinfo=timezone.utc)


def test_weekly_targets_the_requested_weekday():
    # 2026-07-26 is a Sunday; day_of_week=0 is Monday.
    after = _at("2026-07-26T10:00:00", "UTC")
    nxt = calculate_next_run("weekly", "09:00", "UTC", day_of_week=0, after=after)
    assert nxt.weekday() == 0
    assert nxt > after


def test_monthly_rolls_into_next_month():
    after = _at("2026-07-26T10:00:00", "UTC")
    nxt = calculate_next_run("monthly", "09:00", "UTC", day_of_month=1, after=after)
    assert (nxt.year, nxt.month, nxt.day) == (2026, 8, 1)


def test_monthly_december_rolls_into_january():
    after = _at("2026-12-15T10:00:00", "UTC")
    nxt = calculate_next_run("monthly", "09:00", "UTC", day_of_month=1, after=after)
    assert (nxt.year, nxt.month) == (2027, 1)


def test_result_is_always_utc_and_in_the_future():
    after = _at("2026-07-26T10:00:00", "UTC")
    for frequency in ("daily", "weekly", "monthly"):
        nxt = calculate_next_run(frequency, "09:00", "UTC", day_of_week=2, day_of_month=5, after=after)
        assert nxt.tzinfo is timezone.utc
        assert nxt > after


def test_local_time_is_honoured_across_timezones():
    """09:00 in New York must not be stored as 09:00 UTC."""
    after = _at("2026-07-26T00:00:00", "UTC")
    nxt = calculate_next_run("daily", "09:00", "America/New_York", after=after)
    local = nxt.astimezone(ZoneInfo("America/New_York"))
    assert (local.hour, local.minute) == (9, 0)
    # New York is UTC-4 in July, so 09:00 local is 13:00 UTC.
    assert nxt.hour == 13


def test_daily_time_survives_a_dst_transition():
    """US DST ends 2026-11-01. A 09:00 local schedule must stay 09:00 local
    either side of the change, not drift by an hour."""
    tz = "America/New_York"
    before_dst = calculate_next_run("daily", "09:00", tz, after=_at("2026-10-30T12:00:00", "UTC"))
    after_dst = calculate_next_run("daily", "09:00", tz, after=_at("2026-11-03T12:00:00", "UTC"))

    assert before_dst.astimezone(ZoneInfo(tz)).hour == 9
    assert after_dst.astimezone(ZoneInfo(tz)).hour == 9
    # The UTC offset genuinely changed (EDT -> EST), proving the test is real.
    assert before_dst.hour != after_dst.hour
