from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import Literal


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


_report_store: dict[str, StoredReport] = {}


def save_report(
    organization_id: str,
    report_data: dict,
    source_keys: list[str],
    generated_by: str | None = None,
    custom_instructions: str | None = None,
) -> StoredReport:
    report_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    stored = StoredReport(
        id=report_id,
        organization_id=organization_id,
        project_key=report_data.get("project_key", ""),
        project_name=report_data.get("project_name", ""),
        sprint_name=report_data.get("sprint_name"),
        sprint_id=report_data.get("sprint_id"),
        report_type=report_data.get("report_type", ""),
        title=report_data.get("title", ""),
        status="READY",
        approval_status="DRAFT",
        overall_status=report_data.get("overall_status"),
        generated_content=report_data.get("content", {}),
        edited_content=None,
        ai_provider=report_data.get("ai_provider", ""),
        ai_model=report_data.get("ai_model", ""),
        quality_status=report_data.get("quality", {}).get("status"),
        quality_details=report_data.get("quality"),
        custom_instructions=custom_instructions,
        source_issue_keys=source_keys,
        generated_by=generated_by,
        approved_by=None,
        approved_at=None,
        generated_at=now,
        created_at=now,
    )

    _report_store[report_id] = stored
    return stored


def get_report(report_id: str, organization_id: str) -> StoredReport | None:
    report = _report_store.get(report_id)
    if report and report.organization_id == organization_id:
        return report
    return None


def list_reports(
    organization_id: str,
    project_key: str | None = None,
    report_type: str | None = None,
    approval_status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[StoredReport]:
    results = [r for r in _report_store.values() if r.organization_id == organization_id]

    if project_key:
        results = [r for r in results if r.project_key == project_key]
    if report_type:
        results = [r for r in results if r.report_type == report_type]
    if approval_status:
        results = [r for r in results if r.approval_status == approval_status]

    results.sort(key=lambda r: r.generated_at, reverse=True)
    return results[offset:offset + limit]


def edit_report(report_id: str, organization_id: str, edited_content: dict) -> StoredReport | None:
    report = get_report(report_id, organization_id)
    if not report:
        return None
    report.edited_content = edited_content
    return report


def update_approval(report_id: str, organization_id: str, new_status: str, actor: str) -> StoredReport | None:
    valid_transitions = {
        "DRAFT": ["IN_REVIEW"],
        "IN_REVIEW": ["APPROVED", "DRAFT"],
        "APPROVED": ["SENT", "DRAFT"],
        "SENT": [],
    }
    report = get_report(report_id, organization_id)
    if not report:
        return None
    if new_status not in valid_transitions.get(report.approval_status, []):
        return None

    report.approval_status = new_status
    if new_status == "APPROVED":
        report.approved_by = actor
        report.approved_at = datetime.now(timezone.utc).isoformat()
    return report


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


def get_templates(organization_id: str | None = None) -> list[ReportTemplate]:
    return list(SYSTEM_TEMPLATES)
