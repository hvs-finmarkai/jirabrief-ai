from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.tables import Report, ReportSource, ReportTemplateRow


class StoredReport(BaseModel):
    id: str
    organization_id: str
    project_key: str
    project_name: str
    sprint_name: str | None
    sprint_id: str | None
    report_type: str
    title: str
    status: str
    approval_status: str
    overall_status: str | None
    generated_content: dict
    edited_content: dict | None
    ai_provider: str
    ai_model: str
    quality_status: str | None
    quality_details: dict | None
    custom_instructions: str | None
    source_issue_keys: list[str]
    generated_by: str | None
    approved_by: str | None
    approved_at: str | None
    generated_at: str
    created_at: str


class ReportTemplate(BaseModel):
    id: str
    name: str
    report_type: str
    tone: str
    length: str
    enabled_sections: list[str] | None
    additional_instructions: str | None
    is_system: bool


class ComparisonResult(BaseModel):
    newly_completed: list[str]
    new_blockers: list[str]
    resolved_blockers: list[str]
    status_changes: list[str]
    new_risks: list[str]
    removed_risks: list[str]


SYSTEM_TEMPLATES: list[ReportTemplate] = [
    ReportTemplate(
        id="tmpl-sprint-summary",
        name="Sprint Summary",
        report_type="SPRINT_SUMMARY",
        tone="concise",
        length="standard",
        enabled_sections=["completed", "in_progress", "blockers", "slipped", "next_work"],
        additional_instructions=None,
        is_system=True,
    ),
    ReportTemplate(
        id="tmpl-status-report",
        name="Status Report",
        report_type="STATUS_REPORT",
        tone="concise",
        length="standard",
        enabled_sections=["current_state", "progress", "completed_work", "current_work", "blockers", "risks", "next_actions"],
        additional_instructions=None,
        is_system=True,
    ),
    ReportTemplate(
        id="tmpl-executive-digest",
        name="Executive Digest",
        report_type="EXECUTIVE_DIGEST",
        tone="executive",
        length="brief",
        enabled_sections=["overall_status", "highlights", "risks", "impact", "management_asks"],
        additional_instructions="Keep language non-technical. Focus on business impact.",
        is_system=True,
    ),
    ReportTemplate(
        id="tmpl-release-notes",
        name="Release Notes",
        report_type="RELEASE_NOTES",
        tone="detailed",
        length="standard",
        enabled_sections=["new_functionality", "improvements", "fixes"],
        additional_instructions="Write for end users. Avoid internal jargon.",
        is_system=True,
    ),
]


def _as_uuid(value: str | uuid.UUID | None) -> uuid.UUID | None:
    # Report ids arrive straight off the URL path, so a malformed value has to
    # come back as "not found" rather than blowing up the query with a cast error.
    if value is None:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _json(value: str | None):
    if not value:
        return None
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return None


def _to_stored(report: Report) -> StoredReport:
    return StoredReport(
        id=str(report.id),
        organization_id=str(report.organization_id),
        project_key=report.project_key,
        project_name=report.project_name,
        sprint_name=report.sprint_name,
        sprint_id=report.sprint_id,
        report_type=report.report_type,
        title=report.title,
        status=report.status,
        approval_status=report.approval_status,
        overall_status=report.overall_status,
        generated_content=_json(report.generated_content) or {},
        edited_content=_json(report.edited_content),
        ai_provider=report.ai_provider,
        ai_model=report.ai_model,
        quality_status=report.quality_status,
        quality_details=_json(report.quality_details),
        custom_instructions=report.custom_instructions,
        source_issue_keys=[s.issue_key for s in report.sources],
        generated_by=report.generated_by,
        approved_by=report.approved_by,
        approved_at=report.approved_at.isoformat() if report.approved_at else None,
        generated_at=report.generated_at.isoformat(),
        created_at=report.created_at.isoformat(),
    )


async def _fetch(db: AsyncSession, report_id: str, organization_id: str) -> Report | None:
    report_uuid = _as_uuid(report_id)
    org_uuid = _as_uuid(organization_id)
    if not report_uuid or not org_uuid:
        return None

    result = await db.execute(
        select(Report).where(Report.id == report_uuid, Report.organization_id == org_uuid)
    )
    return result.scalar_one_or_none()


async def save_report(
    db: AsyncSession,
    organization_id: str,
    report_data: dict,
    source_keys: list[str],
    generated_by: str | None = None,
    custom_instructions: str | None = None,
) -> StoredReport:
    quality = report_data.get("quality")

    report = Report(
        organization_id=uuid.UUID(str(organization_id)),
        project_key=report_data.get("project_key", ""),
        project_name=report_data.get("project_name", ""),
        sprint_name=report_data.get("sprint_name"),
        sprint_id=report_data.get("sprint_id"),
        report_type=report_data.get("report_type", ""),
        title=report_data.get("title", ""),
        status="READY",
        approval_status="DRAFT",
        overall_status=report_data.get("overall_status"),
        generated_content=json.dumps(report_data.get("content", {}), default=str),
        edited_content=None,
        ai_provider=report_data.get("ai_provider", ""),
        ai_model=report_data.get("ai_model", ""),
        quality_status=(quality or {}).get("status"),
        quality_details=json.dumps(quality, default=str) if quality is not None else None,
        custom_instructions=custom_instructions,
        generated_by=generated_by,
    )
    report.sources = [ReportSource(issue_key=key) for key in source_keys]

    db.add(report)
    await db.commit()
    await db.refresh(report)
    return _to_stored(report)


async def get_report(db: AsyncSession, report_id: str, organization_id: str) -> StoredReport | None:
    report = await _fetch(db, report_id, organization_id)
    return _to_stored(report) if report else None


async def list_reports(
    db: AsyncSession,
    organization_id: str,
    project_key: str | None = None,
    report_type: str | None = None,
    approval_status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[StoredReport]:
    org_uuid = _as_uuid(organization_id)
    if not org_uuid:
        return []

    stmt = select(Report).where(Report.organization_id == org_uuid)
    if project_key:
        stmt = stmt.where(Report.project_key == project_key)
    if report_type:
        stmt = stmt.where(Report.report_type == report_type)
    if approval_status:
        stmt = stmt.where(Report.approval_status == approval_status)

    stmt = stmt.order_by(Report.generated_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return [_to_stored(r) for r in result.scalars().all()]


async def edit_report(
    db: AsyncSession, report_id: str, organization_id: str, edited_content: dict
) -> StoredReport | None:
    report = await _fetch(db, report_id, organization_id)
    if not report:
        return None

    report.edited_content = json.dumps(edited_content, default=str)
    await db.commit()
    return _to_stored(report)


async def update_approval(
    db: AsyncSession, report_id: str, organization_id: str, new_status: str, actor: str
) -> StoredReport | None:
    valid_transitions = {
        "DRAFT": ["IN_REVIEW"],
        "IN_REVIEW": ["APPROVED", "DRAFT"],
        "APPROVED": ["SENT", "DRAFT"],
        "SENT": [],
    }
    report = await _fetch(db, report_id, organization_id)
    if not report:
        return None
    if new_status not in valid_transitions.get(report.approval_status, []):
        return None

    report.approval_status = new_status
    if new_status == "APPROVED":
        report.approved_by = actor
        report.approved_at = datetime.now(timezone.utc)
    await db.commit()
    return _to_stored(report)


def compare_reports(report_a: StoredReport, report_b: StoredReport) -> ComparisonResult:
    content_a = report_a.edited_content or report_a.generated_content
    content_b = report_b.edited_content or report_b.generated_content

    def extract_keys(content: dict, field: str) -> set[str]:
        items = content.get(field, [])
        if isinstance(items, list):
            return {i.get("key", "") if isinstance(i, dict) else str(i) for i in items}
        return set()

    def extract_strings(content: dict, field: str) -> set[str]:
        items = content.get(field, [])
        return {str(i) for i in items} if isinstance(items, list) else set()

    completed_a = extract_keys(content_a, "completed") | extract_keys(content_a, "completed_work")
    completed_b = extract_keys(content_b, "completed") | extract_keys(content_b, "completed_work")
    newly_completed = sorted(completed_b - completed_a)

    blockers_a = extract_keys(content_a, "blockers")
    blockers_b = extract_keys(content_b, "blockers")
    new_blockers = sorted(blockers_b - blockers_a)
    resolved_blockers = sorted(blockers_a - blockers_b)

    risks_a = extract_strings(content_a, "risks")
    risks_b = extract_strings(content_b, "risks")
    new_risks = sorted(risks_b - risks_a)
    removed_risks = sorted(risks_a - risks_b)

    status_changes: list[str] = []
    if content_a.get("overall_status") != content_b.get("overall_status"):
        status_changes.append(f"Status changed from '{content_a.get('overall_status', 'N/A')}' to '{content_b.get('overall_status', 'N/A')}'")
    if content_a.get("current_state") != content_b.get("current_state"):
        status_changes.append(f"State: {content_a.get('current_state', 'N/A')} → {content_b.get('current_state', 'N/A')}")

    return ComparisonResult(
        newly_completed=newly_completed,
        new_blockers=new_blockers,
        resolved_blockers=resolved_blockers,
        status_changes=status_changes,
        new_risks=new_risks,
        removed_risks=removed_risks,
    )


async def get_templates(db: AsyncSession, organization_id: str | None = None) -> list[ReportTemplate]:
    templates = list(SYSTEM_TEMPLATES)

    org_uuid = _as_uuid(organization_id)
    if not org_uuid:
        return templates

    result = await db.execute(
        select(ReportTemplateRow)
        .where(ReportTemplateRow.organization_id == org_uuid)
        .order_by(ReportTemplateRow.created_at)
    )
    for row in result.scalars().all():
        sections = _json(row.enabled_sections)
        templates.append(
            ReportTemplate(
                id=str(row.id),
                name=row.name,
                report_type=row.report_type,
                tone=row.tone,
                length=row.length,
                enabled_sections=[str(s) for s in sections] if isinstance(sections, list) else None,
                additional_instructions=row.additional_instructions,
                is_system=row.is_system,
            )
        )
    return templates
