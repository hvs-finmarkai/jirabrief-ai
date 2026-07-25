from __future__ import annotations
from fastapi import APIRouter, HTTPException
from app.demo.data import get_demo_projects, get_demo_sprints, get_demo_issues, DEMO_ORG_NAME
from app.metrics.engine import calculate_sprint_health
from app.reports.schemas import ReportGenerateRequest, ReportResponse
from app.reports.generator import generate_report

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.get("/projects")
async def demo_projects():
    return get_demo_projects()


@router.get("/projects/{project_key}/sprints")
async def demo_sprints(project_key: str):
    sprints = get_demo_sprints(project_key)
    if not sprints:
        raise HTTPException(status_code=404, detail="Project not found")
    return sprints


@router.get("/sprints/{sprint_id}/issues")
async def demo_issues(sprint_id: str):
    issues = get_demo_issues(sprint_id)
    return issues


@router.get("/sprints/{sprint_id}/health")
async def demo_sprint_health(sprint_id: str):
    issues = get_demo_issues(sprint_id)
    if not issues:
        raise HTTPException(status_code=404, detail="Sprint not found or has no issues")

    sprints_data = None
    from app.demo.data import DEMO_SPRINTS
    for project_sprints in DEMO_SPRINTS.values():
        for s in project_sprints:
            if s["id"] == sprint_id:
                sprints_data = s
                break

    sprint_end = sprints_data.get("end_date") if sprints_data else None
    health = calculate_sprint_health(issues, sprint_end)
    return health.model_dump()


@router.post("/reports/generate", response_model=ReportResponse)
async def demo_generate_report(body: ReportGenerateRequest):
    issues = get_demo_issues(body.sprint_id)
    if not issues:
        raise HTTPException(status_code=404, detail="No issues found for the selected sprint")

    project_name = body.project_key
    sprint_name = "Sprint"
    sprint_end_date = None

    from app.demo.data import DEMO_PROJECTS, DEMO_SPRINTS
    for p in DEMO_PROJECTS:
        if p["key"] == body.project_key:
            project_name = p["name"]
            break

    for project_sprints in DEMO_SPRINTS.values():
        for s in project_sprints:
            if s["id"] == body.sprint_id:
                sprint_name = s["name"]
                sprint_end_date = s.get("end_date")
                break

    report = await generate_report(
        report_type=body.report_type,
        issues=issues,
        project_key=body.project_key,
        project_name=project_name,
        sprint_name=sprint_name,
        sprint_end_date=sprint_end_date,
        custom_instructions=body.custom_instructions,
    )
    return report


@router.get("/ai/health")
async def demo_ai_health():
    from app.ai.provider import get_ai_provider
    provider = get_ai_provider()
    available = await provider.health_check()
    return {"available": available, "provider": "ollama", "model": get_ai_provider()._model}
