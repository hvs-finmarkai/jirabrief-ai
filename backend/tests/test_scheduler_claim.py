"""Proves a due schedule is actually picked up.

Previously nothing ever read `next_run_at` back, so scheduled reports never
fired. These tests run against the real database because the behaviour that
matters - row-level claiming - only exists in Postgres.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select
from app.core.database import async_session
from app.models.tables import Organization, ReportSchedule
from app.scheduler.runner import _claim_one


@pytest.fixture
async def org_with_due_schedule():
    """An org with one schedule that came due an hour ago."""
    async with async_session() as db:
        org = Organization(name="Sched Test", slug=f"sched-{uuid.uuid4().hex[:8]}")
        db.add(org)
        await db.flush()

        schedule = ReportSchedule(
            organization_id=org.id,
            project_key="TEST",
            project_name="Test Project",
            report_type="SPRINT_SUMMARY",
            frequency="daily",
            time_of_day="09:00",
            timezone="UTC",
            enabled=True,
            next_run_at=datetime.now(timezone.utc) - timedelta(hours=1),
            failure_count=0,
        )
        db.add(schedule)
        await db.commit()
        ids = (org.id, schedule.id)

    yield ids

    async with async_session() as db:
        await db.execute(
            ReportSchedule.__table__.delete().where(ReportSchedule.organization_id == ids[0])
        )
        await db.execute(Organization.__table__.delete().where(Organization.id == ids[0]))
        await db.commit()


async def test_due_schedule_is_claimed(org_with_due_schedule):
    _, schedule_id = org_with_due_schedule
    async with async_session() as db:
        claimed = await _claim_one(db, datetime.now(timezone.utc))
    assert claimed == str(schedule_id), "a schedule past its next_run_at must be claimed"


async def test_claiming_pushes_next_run_into_the_future(org_with_due_schedule):
    _, schedule_id = org_with_due_schedule
    now = datetime.now(timezone.utc)

    async with async_session() as db:
        await _claim_one(db, now)

    async with async_session() as db:
        row = (
            await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
        ).scalar_one()
        assert row.next_run_at > now, (
            "next_run_at must move forward on claim, otherwise the same schedule "
            "is re-claimed on every tick and the report is generated repeatedly"
        )


async def test_a_schedule_is_not_claimed_twice(org_with_due_schedule):
    """The double-send guard: a second worker (or the next tick) must not pick
    up a schedule that has already been claimed."""
    now = datetime.now(timezone.utc)
    async with async_session() as db:
        first = await _claim_one(db, now)
    async with async_session() as db:
        second = await _claim_one(db, now)

    assert first is not None
    assert second is None, "a claimed schedule must not be handed out again"


async def test_disabled_schedule_is_never_claimed(org_with_due_schedule):
    org_id, schedule_id = org_with_due_schedule
    async with async_session() as db:
        row = (
            await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
        ).scalar_one()
        row.enabled = False
        await db.commit()

    async with async_session() as db:
        assert await _claim_one(db, datetime.now(timezone.utc)) is None


async def test_future_schedule_is_not_claimed(org_with_due_schedule):
    org_id, schedule_id = org_with_due_schedule
    async with async_session() as db:
        row = (
            await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
        ).scalar_one()
        row.next_run_at = datetime.now(timezone.utc) + timedelta(days=1)
        await db.commit()

    async with async_session() as db:
        assert await _claim_one(db, datetime.now(timezone.utc)) is None
