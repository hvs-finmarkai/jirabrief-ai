"""A schedule auto-disabled after repeated failures must get a clean slate when
someone turns it back on, otherwise the next single failure disables it again.
"""
from __future__ import annotations
import uuid
import pytest
from app.core.database import async_session
from app.models.tables import Organization, ReportSchedule
from app.schedules.service import (
    ScheduleCreateRequest,
    ScheduleUpdateRequest,
    create_schedule,
    update_schedule,
)


@pytest.fixture
async def org_id():
    async with async_session() as db:
        org = Organization(name="Reenable", slug=f"re-{uuid.uuid4().hex[:8]}")
        db.add(org)
        await db.commit()
        oid = str(org.id)

    yield oid

    async with async_session() as db:
        await db.execute(
            ReportSchedule.__table__.delete().where(ReportSchedule.organization_id == uuid.UUID(oid))
        )
        await db.execute(Organization.__table__.delete().where(Organization.id == uuid.UUID(oid)))
        await db.commit()


async def _make(db, org_id: str):
    return await create_schedule(
        db,
        org_id,
        ScheduleCreateRequest(
            project_key="CRM",
            project_name="CRM Migration",
            report_type="SPRINT_SUMMARY",
            frequency="daily",
            time_of_day="09:00",
            timezone="UTC",
        ),
        created_by="alice",
    )


async def _set_failed_and_disabled(schedule_id: str, count: int = 5):
    async with async_session() as db:
        row = await db.get(ReportSchedule, uuid.UUID(schedule_id))
        row.failure_count = count
        row.enabled = False
        await db.commit()


async def test_reenabling_clears_the_failure_count(org_id):
    async with async_session() as db:
        schedule = await _make(db, org_id)
    await _set_failed_and_disabled(schedule.id)

    async with async_session() as db:
        updated = await update_schedule(
            db, schedule.id, org_id, ScheduleUpdateRequest(enabled=True)
        )

    assert updated.enabled is True
    assert updated.failure_count == 0, (
        "a re-enabled schedule left at the failure limit would be auto-disabled "
        "again on its very next failure"
    )


async def test_unrelated_edit_does_not_clear_the_count(org_id):
    """Only the disabled -> enabled transition resets it; editing the time of an
    already-enabled schedule must not wipe its failure history."""
    async with async_session() as db:
        schedule = await _make(db, org_id)

    async with async_session() as db:
        row = await db.get(ReportSchedule, uuid.UUID(schedule.id))
        row.failure_count = 3
        await db.commit()

    async with async_session() as db:
        updated = await update_schedule(
            db, schedule.id, org_id, ScheduleUpdateRequest(time_of_day="10:30")
        )

    assert updated.failure_count == 3


async def test_disabling_keeps_the_count(org_id):
    async with async_session() as db:
        schedule = await _make(db, org_id)

    async with async_session() as db:
        row = await db.get(ReportSchedule, uuid.UUID(schedule.id))
        row.failure_count = 4
        await db.commit()

    async with async_session() as db:
        updated = await update_schedule(
            db, schedule.id, org_id, ScheduleUpdateRequest(enabled=False)
        )

    assert updated.enabled is False
    assert updated.failure_count == 4
