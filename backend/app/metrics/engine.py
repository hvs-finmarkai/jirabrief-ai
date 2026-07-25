from __future__ import annotations
from datetime import date, datetime
from pydantic import BaseModel

DONE_STATUSES = {"done", "closed", "resolved", "complete", "completed"}
IN_PROGRESS_STATUSES = {"in progress", "in review", "in development", "review"}
BLOCKED_STATUSES = {"blocked", "impediment", "on hold"}
HIGH_PRIORITIES = {"critical", "high", "highest"}


class SprintMetrics(BaseModel):
    total_issues: int = 0
    completed: int = 0
    in_progress: int = 0
    to_do: int = 0
    blocked: int = 0
    overdue: int = 0
    high_priority: int = 0
    unassigned_high_priority: int = 0
    completion_percentage: float = 0.0


class Signal(BaseModel):
    type: str
    severity: str
    issue_key: str | None = None
    description: str


class SprintHealth(BaseModel):
    status: str
    metrics: SprintMetrics
    signals: list[Signal]


def calculate_metrics(issues: list[dict], sprint_end_date: str | None = None) -> SprintMetrics:
    metrics = SprintMetrics()
    metrics.total_issues = len(issues)

    for issue in issues:
        status = issue.get("status", "").lower()
        priority = issue.get("priority", "").lower()
        assignee = issue.get("assignee")
        due_date = issue.get("due_date")

        if status in DONE_STATUSES:
            metrics.completed += 1
        elif status in BLOCKED_STATUSES or issue.get("blocked_by"):
            metrics.blocked += 1
        elif status in IN_PROGRESS_STATUSES:
            metrics.in_progress += 1
        else:
            metrics.to_do += 1

        if priority in HIGH_PRIORITIES:
            metrics.high_priority += 1
            if not assignee:
                metrics.unassigned_high_priority += 1

        if due_date and status not in DONE_STATUSES:
            try:
                due = date.fromisoformat(due_date[:10])
                if due < date.today():
                    metrics.overdue += 1
            except ValueError:
                pass

    if metrics.total_issues > 0:
        metrics.completion_percentage = round((metrics.completed / metrics.total_issues) * 100, 1)

    return metrics


def detect_signals(issues: list[dict], sprint_end_date: str | None = None) -> list[Signal]:
    signals: list[Signal] = []

    for issue in issues:
        key = issue.get("key", "")
        status = issue.get("status", "").lower()
        priority = issue.get("priority", "").lower()
        assignee = issue.get("assignee")
        blocked_by = issue.get("blocked_by")
        due_date = issue.get("due_date")

        if status in BLOCKED_STATUSES or blocked_by:
            signals.append(Signal(
                type="BLOCKED",
                severity="high",
                issue_key=key,
                description=blocked_by or f"{key} is blocked",
            ))

        if due_date and status not in DONE_STATUSES:
            try:
                due = date.fromisoformat(due_date[:10])
                if due < date.today():
                    signals.append(Signal(
                        type="OVERDUE",
                        severity="high",
                        issue_key=key,
                        description=f"{key} is overdue (due {due_date})",
                    ))
            except ValueError:
                pass

        if priority in HIGH_PRIORITIES and status not in DONE_STATUSES:
            signals.append(Signal(
                type="HIGH_PRIORITY",
                severity="medium",
                issue_key=key,
                description=f"{key} is {issue.get('priority', 'High')} priority and unresolved",
            ))

        if priority in HIGH_PRIORITIES and not assignee and status not in DONE_STATUSES:
            signals.append(Signal(
                type="UNASSIGNED_HIGH_PRIORITY",
                severity="high",
                issue_key=key,
                description=f"{key} is high priority but has no assignee",
            ))

    if sprint_end_date:
        try:
            end = date.fromisoformat(sprint_end_date[:10])
            days_remaining = (end - date.today()).days
            unresolved = sum(
                1 for i in issues
                if i.get("status", "").lower() not in DONE_STATUSES
            )
            total = len(issues)
            if total > 0 and days_remaining <= 3 and unresolved / total > 0.4:
                signals.append(Signal(
                    type="SPRINT_END_RISK",
                    severity="high",
                    issue_key=None,
                    description=f"Sprint ends in {days_remaining} days with {unresolved}/{total} issues unresolved",
                ))
        except ValueError:
            pass

    return signals


def calculate_sprint_health(issues: list[dict], sprint_end_date: str | None = None) -> SprintHealth:
    metrics = calculate_metrics(issues, sprint_end_date)
    signals = detect_signals(issues, sprint_end_date)

    high_severity_count = sum(1 for s in signals if s.severity == "high")

    if metrics.completion_percentage >= 80 and high_severity_count == 0:
        status = "Healthy"
    elif metrics.completion_percentage >= 60 and high_severity_count <= 1:
        status = "On Track"
    elif metrics.blocked > 0 or high_severity_count >= 2:
        status = "Needs Attention"
    else:
        status = "At Risk"

    return SprintHealth(status=status, metrics=metrics, signals=signals)
