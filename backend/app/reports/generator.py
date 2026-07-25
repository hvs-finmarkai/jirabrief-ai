from __future__ import annotations
from app.models.schemas import (
    JiraIssue,
    NormalizedIssue,
    NormalizedSprintData,
    ReportData,
    SprintSummaryReport,
    StatusReport,
    ExecutiveDigest,
    ReleaseNotes,
    ReportItem,
)
from app.ai.provider import get_ai_provider


DONE_STATUSES = {"done", "closed", "resolved", "complete", "completed"}
IN_PROGRESS_STATUSES = {"in progress", "in review", "in development", "review"}
BLOCKED_STATUSES = {"blocked", "impediment", "on hold"}


def normalize_issues(
    issues: list[JiraIssue],
    project_key: str,
    project_name: str,
    sprint_name: str,
    sprint_state: str,
) -> NormalizedSprintData:
    normalized: list[NormalizedIssue] = []
    completed = 0
    in_progress = 0
    todo = 0
    blocked = 0

    for issue in issues:
        status_lower = issue.status.lower()
        if status_lower in DONE_STATUSES:
            completed += 1
        elif status_lower in BLOCKED_STATUSES or issue.blockedBy:
            blocked += 1
        elif status_lower in IN_PROGRESS_STATUSES:
            in_progress += 1
        else:
            todo += 1

        comments_text = [f"{c.author}: {c.body}" for c in issue.comments[-3:]]

        normalized.append(
            NormalizedIssue(
                key=issue.key,
                summary=issue.summary,
                status=issue.status,
                priority=issue.priority,
                assignee=issue.assignee,
                issue_type=issue.issueType,
                labels=issue.labels,
                comments=comments_text,
                blocked_by=issue.blockedBy,
            )
        )

    return NormalizedSprintData(
        project_key=project_key,
        project_name=project_name,
        sprint_name=sprint_name,
        sprint_state=sprint_state,
        issues=normalized,
        total_issues=len(issues),
        completed_count=completed,
        in_progress_count=in_progress,
        todo_count=todo,
        blocked_count=blocked,
    )


PROMPTS = {
    "sprint-summary": """Generate a Sprint Summary report as JSON. Use ONLY the provided Jira data.

Required JSON structure:
{
  "title": "Sprint Summary - [sprint name]",
  "sprintName": "[sprint name]",
  "completed": [{"key": "TICKET-1", "summary": "...", "detail": "optional context"}],
  "inProgress": [{"key": "TICKET-2", "summary": "...", "detail": "optional context"}],
  "blockers": [{"key": "TICKET-3", "summary": "...", "detail": "what is blocking it"}],
  "slipped": [{"key": "TICKET-4", "summary": "...", "detail": "why it slipped"}],
  "nextWork": ["description of upcoming work items"]
}

Rules:
- Only include categories that have items in the data
- Never invent tickets, statuses, dates, or owners not in the data
- Use empty arrays for categories with no items
- Keep detail fields concise (one sentence max)""",

    "status-report": """Generate a Status Report as JSON. Use ONLY the provided Jira data.

Required JSON structure:
{
  "title": "Status Report - [project name]",
  "currentState": "one sentence overall state",
  "progress": "brief progress summary with counts",
  "completedWork": [{"key": "TICKET-1", "summary": "...", "detail": "optional"}],
  "currentWork": [{"key": "TICKET-2", "summary": "...", "detail": "optional"}],
  "blockers": [{"key": "TICKET-3", "summary": "...", "detail": "what is blocking"}],
  "risks": ["risk description based on data"],
  "nextActions": ["action based on current state"]
}

Rules:
- Derive currentState and progress from the actual ticket counts
- Only list risks visible from the data (blocked items, high priority unassigned)
- Never invent deadlines, dates, or owners not present
- Use empty arrays for empty categories""",

    "executive-digest": """Generate an Executive Digest as JSON. Use ONLY the provided Jira data.

Required JSON structure:
{
  "title": "Executive Digest - [project name]",
  "overallStatus": "On Track / At Risk / Off Track with brief reason",
  "highlights": ["key achievement or progress point"],
  "risks": ["risk visible from the data"],
  "impact": "one paragraph on business impact based on what is being delivered",
  "managementAsks": ["specific ask if supported by blockers or data"]
}

Rules:
- Keep language non-technical and concise
- overallStatus must reflect actual data (blocked items = At Risk)
- Never invent business context not visible in ticket data
- managementAsks should only reference actionable items from blockers
- Use empty arrays for categories without supporting data""",

    "release-notes": """Generate Release Notes as JSON. Use ONLY the provided Jira data.

Required JSON structure:
{
  "title": "Release Notes - [sprint name]",
  "newFunctionality": [{"key": "TICKET-1", "summary": "user-facing description", "detail": "optional"}],
  "improvements": [{"key": "TICKET-2", "summary": "user-facing description", "detail": "optional"}],
  "fixes": [{"key": "TICKET-3", "summary": "user-facing description", "detail": "optional"}]
}

Rules:
- Only include completed/done tickets
- Categorize Stories as newFunctionality or improvements based on summary
- Categorize Bugs as fixes
- Rewrite summaries to be user-friendly (not internal jargon)
- Never include in-progress or to-do items
- Use empty arrays for categories without items""",
}


async def generate_report(
    report_type: str,
    issues: list[JiraIssue],
    project_key: str,
    project_name: str,
    sprint_name: str,
    sprint_state: str,
) -> ReportData:
    normalized = normalize_issues(issues, project_key, project_name, sprint_name, sprint_state)
    prompt = PROMPTS[report_type]
    provider = get_ai_provider()

    try:
        raw = await provider.generate_report(prompt, normalized)
    except Exception:
        raw = build_fallback_report(report_type, normalized)

    return validate_report(report_type, raw)


def validate_report(report_type: str, data: dict) -> ReportData:
    match report_type:
        case "sprint-summary":
            return SprintSummaryReport(**data)
        case "status-report":
            return StatusReport(**data)
        case "executive-digest":
            return ExecutiveDigest(**data)
        case "release-notes":
            return ReleaseNotes(**data)
        case _:
            raise ValueError(f"Unknown report type: {report_type}")


def build_fallback_report(report_type: str, data: NormalizedSprintData) -> dict:
    completed = [i for i in data.issues if i.status.lower() in DONE_STATUSES]
    in_progress = [i for i in data.issues if i.status.lower() in IN_PROGRESS_STATUSES]
    blocked = [i for i in data.issues if i.status.lower() in BLOCKED_STATUSES or i.blocked_by]
    todo = [i for i in data.issues if i not in completed and i not in in_progress and i not in blocked]

    def to_items(issues: list[NormalizedIssue]) -> list[dict]:
        return [{"key": i.key, "summary": i.summary, "detail": i.blocked_by} for i in issues]

    match report_type:
        case "sprint-summary":
            return {
                "title": f"Sprint Summary - {data.sprint_name}",
                "sprintName": data.sprint_name,
                "completed": to_items(completed),
                "inProgress": to_items(in_progress),
                "blockers": to_items(blocked),
                "slipped": [],
                "nextWork": [i.summary for i in todo[:3]],
            }
        case "status-report":
            return {
                "title": f"Status Report - {data.project_name}",
                "currentState": f"{data.completed_count}/{data.total_issues} issues completed",
                "progress": f"{data.completed_count} done, {data.in_progress_count} in progress, {data.blocked_count} blocked",
                "completedWork": to_items(completed),
                "currentWork": to_items(in_progress),
                "blockers": to_items(blocked),
                "risks": [f"Blocked: {i.summary}" for i in blocked],
                "nextActions": [i.summary for i in todo[:3]],
            }
        case "executive-digest":
            status = "On Track" if data.blocked_count == 0 else "At Risk"
            return {
                "title": f"Executive Digest - {data.project_name}",
                "overallStatus": f"{status} - {data.completed_count}/{data.total_issues} complete",
                "highlights": [f"Completed: {i.summary}" for i in completed[:3]],
                "risks": [f"Blocked: {i.summary}" for i in blocked],
                "impact": f"Team is delivering on {data.sprint_name} with {data.completed_count} items completed out of {data.total_issues} total.",
                "managementAsks": [f"Unblock: {i.summary}" for i in blocked[:2]] if blocked else [],
            }
        case "release-notes":
            stories = [i for i in completed if i.issue_type.lower() in ("story", "feature")]
            bugs = [i for i in completed if i.issue_type.lower() == "bug"]
            tasks = [i for i in completed if i not in stories and i not in bugs]
            return {
                "title": f"Release Notes - {data.sprint_name}",
                "newFunctionality": to_items(stories),
                "improvements": to_items(tasks),
                "fixes": to_items(bugs),
            }
        case _:
            raise ValueError(f"Unknown report type: {report_type}")
