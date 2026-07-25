from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo
from app.models.tables import ReportSchedule


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


def calculate_next_run(
    frequency: str,
    time_of_day: str,
    tz_name: str,
    day_of_week: int | None = None,
    day_of_month: int | None = None,
    after: datetime | None = None,
) -> datetime:
    tz = ZoneInfo(tz_name)
    now = after.astimezone(tz) if after else datetime.now(tz)
    hour, minute = int(time_of_day.split(":")[0]), int(time_of_day.split(":")[1])

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


def _to_schedule(row: ReportSchedule) -> Schedule:
    return Schedule(
        id=str(row.id),
        organization_id=str(row.organization_id),
        project_key=row.project_key,
        project_name=row.project_name,
        sprint_id=row.sprint_id,
        report_type=row.report_type,
        template_id=str(row.template_id) if row.template_id else None,
        frequency=row.frequency,
        day_of_week=row.day_of_week,
        day_of_month=row.day_of_month,
        time_of_day=row.time_of_day,
        timezone=row.timezone,
        require_approval=row.require_approval,
        enabled=row.enabled,
        next_run_at=row.next_run_at.isoformat() if row.next_run_at else None,
        last_run_at=row.last_run_at.isoformat() if row.last_run_at else None,
        last_run_status=row.last_run_status,
        failure_count=row.failure_count,
        created_by=row.created_by,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


def _next_run_for(row: ReportSchedule) -> datetime:
    return calculate_next_run(
        frequency=row.frequency,
        time_of_day=row.time_of_day,
        tz_name=row.timezone,
        day_of_week=row.day_of_week,
        day_of_month=row.day_of_month,
    )


async def create_schedule(
    db: AsyncSession,
    org_id: str,
    body: ScheduleCreateRequest,
    created_by: str | None = None,
) -> Schedule:
    next_run = calculate_next_run(
        frequency=body.frequency,
        time_of_day=body.time_of_day,
        tz_name=body.timezone,
        day_of_week=body.day_of_week,
        day_of_month=body.day_of_month,
    )

    row = ReportSchedule(
        organization_id=uuid.UUID(org_id),
        project_key=body.project_key,
        project_name=body.project_name,
        sprint_id=body.sprint_id,
        report_type=body.report_type,
        template_id=uuid.UUID(body.template_id) if body.template_id else None,
        frequency=body.frequency,
        day_of_week=body.day_of_week,
        day_of_month=body.day_of_month,
        time_of_day=body.time_of_day,
        timezone=body.timezone,
        require_approval=body.require_approval,
        enabled=True,
        next_run_at=next_run,
        failure_count=0,
        created_by=created_by,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _to_schedule(row)


async def list_schedules(db: AsyncSession, org_id: str) -> list[Schedule]:
    result = await db.execute(
        select(ReportSchedule)
        .where(ReportSchedule.organization_id == uuid.UUID(org_id))
        .order_by(ReportSchedule.created_at.desc())
    )
    return [_to_schedule(r) for r in result.scalars().all()]


async def _get_row(db: AsyncSession, schedule_id: str, org_id: str) -> ReportSchedule | None:
    try:
        sid = uuid.UUID(schedule_id)
    except ValueError:
        return None
    result = await db.execute(
        select(ReportSchedule).where(
            ReportSchedule.id == sid,
            ReportSchedule.organization_id == uuid.UUID(org_id),
        )
    )
    return result.scalar_one_or_none()


async def get_schedule(db: AsyncSession, schedule_id: str, org_id: str) -> Schedule | None:
    row = await _get_row(db, schedule_id, org_id)
    return _to_schedule(row) if row else None


async def update_schedule(
    db: AsyncSession, schedule_id: str, org_id: str, body: ScheduleUpdateRequest
) -> Schedule | None:
    row = await _get_row(db, schedule_id, org_id)
    if not row:
        return None

    was_enabled = row.enabled

    for field in (
        "frequency",
        "day_of_week",
        "day_of_month",
        "time_of_day",
        "timezone",
        "require_approval",
        "enabled",
    ):
        value = getattr(body, field)
        if value is not None:
            setattr(row, field, value)

    # Re-enabling is the user saying "I've dealt with it". Without clearing the
    # counter, a schedule auto-disabled at the failure limit would be disabled
    # again by its very next failure.
    if row.enabled and not was_enabled:
        row.failure_count = 0

    row.next_run_at = _next_run_for(row)
    await db.commit()
    await db.refresh(row)
    return _to_schedule(row)


async def delete_schedule(db: AsyncSession, schedule_id: str, org_id: str) -> bool:
    row = await _get_row(db, schedule_id, org_id)
    if not row:
        return False
    await db.delete(row)
    await db.commit()
    return True


async def mark_run(
    db: AsyncSession,
    schedule_id: str,
    org_id: str,
    success: bool,
    error_msg: str | None = None,
) -> Schedule | None:
    row = await _get_row(db, schedule_id, org_id)
    if not row:
        return None

    row.last_run_at = datetime.now(timezone.utc)
    row.last_run_status = "SUCCESS" if success else "FAILED"
    row.failure_count = 0 if success else row.failure_count + 1
    row.next_run_at = _next_run_for(row)

    await db.commit()
    await db.refresh(row)
    return _to_schedule(row)
