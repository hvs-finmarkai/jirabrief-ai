from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal


class JiraConnectRequest(BaseModel):
    url: str | None = None
    email: str | None = None
    token: str | None = None
    demo: bool = False


class JiraConnectResponse(BaseModel):
    connected: bool


class JiraProject(BaseModel):
    key: str
    name: str
    lead: str


class JiraSprint(BaseModel):
    id: int
    name: str
    state: Literal["active", "closed", "future"]
    startDate: str | None = None
    endDate: str | None = None


class JiraComment(BaseModel):
    author: str
    body: str
    created: str


class JiraIssue(BaseModel):
    key: str
    summary: str
    status: str
    priority: str
    assignee: str | None = None
    issueType: str
    created: str
    updated: str
    labels: list[str] = []
    comments: list[JiraComment] = []
    blockedBy: str | None = None


class ReportItem(BaseModel):
    key: str
    summary: str
    detail: str | None = None


class SprintSummaryReport(BaseModel):
    type: Literal["sprint-summary"] = "sprint-summary"
    title: str
    sprintName: str
    completed: list[ReportItem] = []
    inProgress: list[ReportItem] = []
    blockers: list[ReportItem] = []
    slipped: list[ReportItem] = []
    nextWork: list[str] = []


class StatusReport(BaseModel):
    type: Literal["status-report"] = "status-report"
    title: str
    currentState: str
    progress: str
    completedWork: list[ReportItem] = []
    currentWork: list[ReportItem] = []
    blockers: list[ReportItem] = []
    risks: list[str] = []
    nextActions: list[str] = []


class ExecutiveDigest(BaseModel):
    type: Literal["executive-digest"] = "executive-digest"
    title: str
    overallStatus: str
    highlights: list[str] = []
    risks: list[str] = []
    impact: str
    managementAsks: list[str] = []


class ReleaseNotes(BaseModel):
    type: Literal["release-notes"] = "release-notes"
    title: str
    newFunctionality: list[ReportItem] = []
    improvements: list[ReportItem] = []
    fixes: list[ReportItem] = []


ReportData = SprintSummaryReport | StatusReport | ExecutiveDigest | ReleaseNotes


class ReportGenerateRequest(BaseModel):
    projectKey: str
    sprintId: int | None = None
    reportType: Literal["sprint-summary", "status-report", "executive-digest", "release-notes"]


class HealthResponse(BaseModel):
    status: str = "ok"


class NormalizedIssue(BaseModel):
    key: str
    summary: str
    status: str
    priority: str
    assignee: str | None = None
    issue_type: str
    labels: list[str] = []
    comments: list[str] = []
    blocked_by: str | None = None


class NormalizedSprintData(BaseModel):
    project_key: str
    project_name: str
    sprint_name: str
    sprint_state: str
    issues: list[NormalizedIssue]
    total_issues: int = Field(default=0)
    completed_count: int = Field(default=0)
    in_progress_count: int = Field(default=0)
    todo_count: int = Field(default=0)
    blocked_count: int = Field(default=0)
