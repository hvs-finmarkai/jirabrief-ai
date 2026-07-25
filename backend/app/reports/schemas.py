from __future__ import annotations
import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class ReportItem(BaseModel):
    key: str
    summary: str
    detail: str | None = None


class SprintSummaryContent(BaseModel):
    type: Literal["SPRINT_SUMMARY"] = "SPRINT_SUMMARY"
    title: str
    sprint_name: str
    completed: list[ReportItem] = []
    in_progress: list[ReportItem] = []
    blockers: list[ReportItem] = []
    slipped: list[ReportItem] = []
    next_work: list[str] = []


class StatusReportContent(BaseModel):
    type: Literal["STATUS_REPORT"] = "STATUS_REPORT"
    title: str
    current_state: str
    progress: str
    completed_work: list[ReportItem] = []
    current_work: list[ReportItem] = []
    blockers: list[ReportItem] = []
    risks: list[str] = []
    next_actions: list[str] = []


class ExecutiveDigestContent(BaseModel):
    type: Literal["EXECUTIVE_DIGEST"] = "EXECUTIVE_DIGEST"
    title: str
    overall_status: str
    highlights: list[str] = []
    risks: list[str] = []
    impact: str
    management_asks: list[str] = []


class ReleaseNotesContent(BaseModel):
    type: Literal["RELEASE_NOTES"] = "RELEASE_NOTES"
    title: str
    new_functionality: list[ReportItem] = []
    improvements: list[ReportItem] = []
    fixes: list[ReportItem] = []


ReportContent = SprintSummaryContent | StatusReportContent | ExecutiveDigestContent | ReleaseNotesContent


class QualityResult(BaseModel):
    status: Literal["PASSED", "PASSED_WITH_WARNINGS", "FAILED_VALIDATION"]
    verified_sources: int = 0
    total_references: int = 0
    warnings: list[str] = []
    errors: list[str] = []


class ReportGenerateRequest(BaseModel):
    project_key: str
    sprint_id: str
    report_type: Literal["SPRINT_SUMMARY", "STATUS_REPORT", "EXECUTIVE_DIGEST", "RELEASE_NOTES"]
    template_id: str | None = None
    custom_instructions: str | None = None


class ReportResponse(BaseModel):
    id: str
    report_type: str
    title: str
    status: str
    overall_status: str | None = None
    content: ReportContent
    quality: QualityResult
    source_issue_keys: list[str] = []
    ai_provider: str
    ai_model: str
    generated_at: str
    sprint_name: str
    project_name: str
    project_key: str


class ReportListItem(BaseModel):
    id: str
    report_type: str
    title: str
    status: str
    project_key: str
    project_name: str
    sprint_name: str
    generated_at: str
