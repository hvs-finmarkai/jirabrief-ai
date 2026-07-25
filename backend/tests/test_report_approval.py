"""The approval workflow is now driven from the Reports page, so the state
machine and its tenant scoping are pinned down here.
"""
from __future__ import annotations
import uuid
import pytest
from app.core.database import async_session
from app.models.tables import Organization, Report
from app.reports.storage import get_report, list_reports, save_report, update_approval

REPORT_DATA = {
    "project_key": "CRM",
    "project_name": "CRM Migration",
    "sprint_name": "Sprint 24",
    "report_type": "SPRINT_SUMMARY",
    "title": "Sprint Summary - Sprint 24",
    "content": {"title": "Sprint Summary", "completed": []},
    "ai_provider": "fallback",
    "ai_model": "deterministic",
    "quality": {"status": "PASSED", "verified_sources": 1, "total_references": 1},
}


@pytest.fixture
async def two_orgs():
    async with async_session() as db:
        a = Organization(name="Org A", slug=f"a-{uuid.uuid4().hex[:8]}")
        b = Organization(name="Org B", slug=f"b-{uuid.uuid4().hex[:8]}")
        db.add_all([a, b])
        await db.commit()
        ids = (str(a.id), str(b.id))

    yield ids

    async with async_session() as db:
        for org_id in ids:
            await db.execute(Report.__table__.delete().where(Report.organization_id == uuid.UUID(org_id)))
            await db.execute(Organization.__table__.delete().where(Organization.id == uuid.UUID(org_id)))
        await db.commit()


async def _new_report(org_id: str):
    async with async_session() as db:
        return await save_report(db, organization_id=org_id, report_data=REPORT_DATA, source_keys=["CRM-1"])


async def test_new_reports_start_as_draft(two_orgs):
    org_a, _ = two_orgs
    report = await _new_report(org_a)
    assert report.approval_status == "DRAFT"


async def test_full_happy_path(two_orgs):
    org_a, _ = two_orgs
    report = await _new_report(org_a)

    async with async_session() as db:
        for step in ("IN_REVIEW", "APPROVED", "SENT"):
            result = await update_approval(db, report.id, org_a, step, actor="alice")
            assert result is not None, f"transition to {step} should be allowed"
            assert result.approval_status == step


async def test_approval_records_who_and_when(two_orgs):
    org_a, _ = two_orgs
    report = await _new_report(org_a)

    async with async_session() as db:
        await update_approval(db, report.id, org_a, "IN_REVIEW", actor="alice")
        approved = await update_approval(db, report.id, org_a, "APPROVED", actor="alice")

    assert approved.approved_by == "alice"
    assert approved.approved_at is not None


@pytest.mark.parametrize("illegal", ["APPROVED", "SENT"])
async def test_draft_cannot_skip_review(two_orgs, illegal):
    org_a, _ = two_orgs
    report = await _new_report(org_a)
    async with async_session() as db:
        assert await update_approval(db, report.id, org_a, illegal, actor="alice") is None


async def test_sent_is_terminal(two_orgs):
    org_a, _ = two_orgs
    report = await _new_report(org_a)
    async with async_session() as db:
        for step in ("IN_REVIEW", "APPROVED", "SENT"):
            await update_approval(db, report.id, org_a, step, actor="alice")
        for attempt in ("DRAFT", "IN_REVIEW", "APPROVED"):
            assert await update_approval(db, report.id, org_a, attempt, actor="alice") is None, (
                "a sent report must not be reopened"
            )


async def test_approval_persists_across_sessions(two_orgs):
    org_a, _ = two_orgs
    report = await _new_report(org_a)
    async with async_session() as db:
        await update_approval(db, report.id, org_a, "IN_REVIEW", actor="alice")

    async with async_session() as db:
        reloaded = await get_report(db, report.id, org_a)
    assert reloaded.approval_status == "IN_REVIEW"


async def test_another_org_cannot_advance_your_report(two_orgs):
    org_a, org_b = two_orgs
    report = await _new_report(org_a)

    async with async_session() as db:
        assert await update_approval(db, report.id, org_b, "IN_REVIEW", actor="mallory") is None
        assert await get_report(db, report.id, org_b) is None

    async with async_session() as db:
        assert (await get_report(db, report.id, org_a)).approval_status == "DRAFT"


async def test_list_is_filterable_by_approval_status(two_orgs):
    org_a, _ = two_orgs
    first = await _new_report(org_a)
    await _new_report(org_a)

    async with async_session() as db:
        await update_approval(db, first.id, org_a, "IN_REVIEW", actor="alice")
        in_review = await list_reports(db, org_a, approval_status="IN_REVIEW")
        drafts = await list_reports(db, org_a, approval_status="DRAFT")

    assert [r.id for r in in_review] == [first.id]
    assert first.id not in [r.id for r in drafts]
