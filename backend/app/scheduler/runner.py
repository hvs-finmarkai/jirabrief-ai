"""Background worker that actually runs report schedules.

Creating a schedule previously only stored a `next_run_at` timestamp - nothing
ever read it back, so scheduled reports never fired. This runner is the missing
half: it wakes on an interval, claims every schedule that has come due, and
generates (and optionally delivers) the report.

Claiming uses `SELECT ... FOR UPDATE SKIP LOCKED`, so running more than one
backend instance is safe: each due schedule is picked up by exactly one worker
instead of every instance racing to generate the same report.
"""
from __future__ import annotations
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.audit import log_event
from app.core.config import get_settings
from app.core.database import async_session
from app.models.tables import ReportSchedule

logger = logging.getLogger(__name__)

# A schedule that keeps failing is disabled rather than retried forever.
MAX_CONSECUTIVE_FAILURES = 5


class SchedulerRunner:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stopping = asyncio.Event()

    async def start(self) -> None:
        settings = get_settings()
        if not settings.scheduler_enabled:
            logger.info("Scheduler disabled (SCHEDULER_ENABLED=false)")
            return
        self._stopping.clear()
        self._task = asyncio.create_task(self._loop(), name="jirabrief-scheduler")
        logger.info("Scheduler started (every %ss)", settings.scheduler_interval_seconds)

    async def stop(self) -> None:
        if self._task is None:
            return
        self._stopping.set()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None
        logger.info("Scheduler stopped")

    async def _loop(self) -> None:
        interval = get_settings().scheduler_interval_seconds
        while not self._stopping.is_set():
            try:
                count = await run_due_schedules()
                if count:
                    logger.info("Scheduler processed %d due schedule(s)", count)
            except asyncio.CancelledError:
                raise
            except Exception:
                # A bad tick must never kill the loop.
                logger.exception("Scheduler tick failed")

            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=interval)
            except asyncio.TimeoutError:
                continue


async def run_due_schedules(now: datetime | None = None) -> int:
    """Claim and execute every schedule that is due. Returns how many ran."""
    now = now or datetime.now(timezone.utc)
    processed = 0

    while True:
        async with async_session() as db:
            schedule_id = await _claim_one(db, now)
            if schedule_id is None:
                return processed
            await _execute(db, schedule_id)
            processed += 1


async def _claim_one(db: AsyncSession, now: datetime) -> str | None:
    """Lock a single due schedule and push its next_run_at forward.

    Moving next_run_at forward inside the same transaction as the lock is what
    stops a second worker (or the next tick) from picking up the same row while
    this one is still generating.
    """
    from app.schedules.service import _next_run_for

    result = await db.execute(
        select(ReportSchedule)
        .where(
            ReportSchedule.enabled.is_(True),
            ReportSchedule.next_run_at.is_not(None),
            ReportSchedule.next_run_at <= now,
        )
        .order_by(ReportSchedule.next_run_at)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    row = result.scalar_one_or_none()
    if row is None:
        await db.rollback()
        return None

    row.next_run_at = _next_run_for(row)
    schedule_id = str(row.id)
    await db.commit()
    return schedule_id


async def _execute(db: AsyncSession, schedule_id: str) -> None:
    from app.schedules.service import mark_run

    result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
    row = result.scalar_one_or_none()
    if row is None:
        return

    org_id = str(row.organization_id)
    try:
        await _generate_and_deliver(db, row)
        await mark_run(db, schedule_id, org_id, success=True)
    except Exception as exc:
        logger.exception("Scheduled report %s failed", schedule_id)
        schedule = await mark_run(db, schedule_id, org_id, success=False, error_msg=str(exc))
        if schedule and schedule.failure_count >= MAX_CONSECUTIVE_FAILURES:
            await _disable(db, schedule_id)


async def _disable(db: AsyncSession, schedule_id: str) -> None:
    result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
    row = result.scalar_one_or_none()
    if row is None:
        return
    row.enabled = False
    await db.commit()
    logger.warning(
        "Schedule %s disabled after %d consecutive failures", schedule_id, MAX_CONSECUTIVE_FAILURES
    )


async def _generate_and_deliver(db: AsyncSession, row: ReportSchedule) -> None:
    """Pull the schedule's Jira data, generate the report, store it, and deliver
    it unless the schedule requires human approval first."""
    from app.jira.routes import _get_client
    from app.reports.generator import generate_report
    from app.reports.storage import save_report

    org_id = str(row.organization_id)
    client = await _get_client(db, row.organization_id)

    sprint_id = int(row.sprint_id) if row.sprint_id and row.sprint_id.isdigit() else None
    issues = await client.get_issues(row.project_key, sprint_id)
    if not issues:
        raise RuntimeError(f"No Jira issues found for {row.project_key}")

    sprint_name = "Current Sprint"
    sprint_end_date = None
    if sprint_id is not None:
        for sprint in await client.get_sprints(row.project_key):
            if sprint["id"] == sprint_id:
                sprint_name = sprint["name"]
                sprint_end_date = sprint.get("end_date")
                break

    report = await generate_report(
        report_type=row.report_type,
        issues=issues,
        project_key=row.project_key,
        project_name=row.project_name,
        sprint_name=sprint_name,
        sprint_end_date=sprint_end_date,
    )

    stored = await save_report(
        db,
        organization_id=org_id,
        report_data=report.model_dump(),
        source_keys=report.source_issue_keys,
        generated_by=f"schedule:{row.id}",
    )

    await log_event(
        db,
        event="schedule.report_generated",
        actor=f"schedule:{row.id}",
        organization_id=org_id,
        metadata={"report_id": stored.id, "project_key": row.project_key},
    )

    if row.require_approval:
        # Leaves the report in DRAFT for a human to approve before it is sent.
        logger.info("Report %s awaiting approval (schedule %s)", stored.id, row.id)
        return

    from app.delivery.providers import deliver_report_to_channels

    await deliver_report_to_channels(db, organization_id=org_id, report=stored)
