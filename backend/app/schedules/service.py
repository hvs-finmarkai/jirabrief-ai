from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone, time
from typing import Literal
from pydantic import BaseModel, Field
from zoneinfo import ZoneInfo


class Schedule(BaseModel):
    id: str
    organization_id: str
    project_key: str
    project_name: str
    sprint_id: str | None
    report_type: str
    template_id: str | None
    frequency: Literal["daily", "weekly", "monthly"]
    day_of_week: int | None
    day_of_month: int | None
    time_of_day: str
    timezone: str
    require_approval: bool
    enabled: bool
    next_run_at: str | None
    last_run_at: str | None
    last_run_status: str | None
    failure_count: int
    created_by: str | None
    created_at: str


class ScheduleCreateRequest(BaseModel):
    project_key: str
    project_name: str
    sprint_id: str | None = None
    report_type: str
    template_id: str | None = None
    frequency: Literal["daily", "weekly", "monthly"]
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    day_of_month: int | None = Field(default=None, ge=1, le=28)
    time_of_day: str = "09:00"
    timezone: str = "UTC"
    require_approval: bool = False


class ScheduleUpdateRequest(BaseModel):
    frequency: Literal["daily", "weekly", "monthly"] | None = None
    day_of_week: int | None = None
    day_of_month: int | None = None
    time_of_day: str | None = None
    timezone: str | None = None
    require_approval: bool | None = None
    enabled: bool | None = None


_schedule_store: dict[str, Schedule] = {}


def calculate_next_run(
    frequency: str,
    time_of_day: str,
    tz_name: str,
    day_of_week: int | None = None,
    day_of_month: int | None = None,
    after: datetime | None = None,
) -> datetime:
    tz = ZoneInfo(tz_name)
    now = after or datetime.now(tz)
    hour, minute = int(time_of_day.split(":")[0]), int(time_of_day.split(":")[1])
    target_time = time(hour, minute)

    if frequency == "daily":
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(days=1)
        return candidate.astimezone(timezone.utc)

    elif frequency == "weekly":
        dow = day_of_week or 0
        days_ahead = dow - now.weekday()
        if days_ahead < 0:
            days_ahead += 7
        candidate = now + timedelta(days=days_ahead)
        candidate = candidate.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(weeks=1)
        return candidate.astimezone(timezone.utc)

    elif frequency == "monthly":
        dom = day_of_month or 1
        candidate = now.replace(day=min(dom, 28), hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now:
            if now.month == 12:
                candidate = candidate.replace(year=now.year + 1, month=1)
            else:
                candidate = candidate.replace(month=now.month + 1)
        return candidate.astimezone(timezone.utc)

    return now.astimezone(timezone.utc)


def create_schedule(org_id: str, body: ScheduleCreateRequest, created_by: str | None = None) -> Schedule:
    schedule_id = str(uuid.uuid4())
    next_run = calculate_next_run(
        frequency=body.frequency,
        time_of_day=body.time_of_day,
        tz_name=body.timezone,
        day_of_week=body.day_of_week,
        day_of_month=body.day_of_month,
    )

    schedule = Schedule(
        id=schedule_id,
        organization_id=org_id,
        project_key=body.project_key,
        project_name=body.project_name,
        sprint_id=body.sprint_id,
        report_type=body.report_type,
        template_id=body.template_id,
        frequency=body.frequency,
        day_of_week=body.day_of_week,
        day_of_month=body.day_of_month,
        time_of_day=body.time_of_day,
        timezone=body.timezone,
        require_approval=body.require_approval,
        enabled=True,
        next_run_at=next_run.isoformat(),
        last_run_at=None,
        last_run_status=None,
        failure_count=0,
        created_by=created_by,
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    _schedule_store[schedule_id] = schedule
    return schedule


def list_schedules(org_id: str) -> list[Schedule]:
    return [s for s in _schedule_store.values() if s.organization_id == org_id]


def get_schedule(schedule_id: str, org_id: str) -> Schedule | None:
    s = _schedule_store.get(schedule_id)
    if s and s.organization_id == org_id:
        return s
    return None


def update_schedule(schedule_id: str, org_id: str, body: ScheduleUpdateRequest) -> Schedule | None:
    s = get_schedule(schedule_id, org_id)
    if not s:
        return None

    if body.frequency is not None:
        s.frequency = body.frequency
    if body.day_of_week is not None:
        s.day_of_week = body.day_of_week
    if body.day_of_month is not None:
        s.day_of_month = body.day_of_month
    if body.time_of_day is not None:
        s.time_of_day = body.time_of_day
    if body.timezone is not None:
        s.timezone = body.timezone
    if body.require_approval is not None:
        s.require_approval = body.require_approval
    if body.enabled is not None:
        s.enabled = body.enabled

    s.next_run_at = calculate_next_run(
        frequency=s.frequency,
        time_of_day=s.time_of_day,
        tz_name=s.timezone,
        day_of_week=s.day_of_week,
        day_of_month=s.day_of_month,
    ).isoformat()

    return s


def delete_schedule(schedule_id: str, org_id: str) -> bool:
    s = get_schedule(schedule_id, org_id)
    if s:
        del _schedule_store[schedule_id]
        return True
    return False


def mark_run(schedule_id: str, org_id: str, success: bool, error_msg: str | None = None) -> Schedule | None:
    s = get_schedule(schedule_id, org_id)
    if not s:
        return None

    s.last_run_at = datetime.now(timezone.utc).isoformat()
    s.last_run_status = "SUCCESS" if success else "FAILED"

    if not success:
        s.failure_count += 1
    else:
        s.failure_count = 0

    s.next_run_at = calculate_next_run(
        frequency=s.frequency,
        time_of_day=s.time_of_day,
        tz_name=s.timezone,
        day_of_week=s.day_of_week,
        day_of_month=s.day_of_month,
    ).isoformat()

    return s
