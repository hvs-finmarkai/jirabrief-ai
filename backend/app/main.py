from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.schemas import (
    JiraConnectRequest,
    JiraConnectResponse,
    JiraProject,
    JiraSprint,
    JiraIssue,
    ReportGenerateRequest,
    HealthResponse,
)
from app.jira.client import JiraClient
from app.demo.data import DEMO_PROJECTS, DEMO_SPRINTS, DEMO_ISSUES
from app.reports.generator import generate_report


class SessionState:
    def __init__(self):
        self.jira_client: JiraClient | None = None
        self.is_demo: bool = False
        self.project_cache: dict[str, JiraProject] = {}


state = SessionState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    if state.jira_client:
        await state.jira_client.close()


app = FastAPI(title="JiraBrief AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse()


@app.post("/api/jira/connect", response_model=JiraConnectResponse)
async def connect_jira(request: JiraConnectRequest):
    if request.demo:
        state.is_demo = True
        state.jira_client = None
        return JiraConnectResponse(connected=True)

    if not request.url or not request.email or not request.token:
        raise HTTPException(status_code=400, detail="Jira URL, email, and API token are required")

    client = JiraClient(base_url=request.url, email=request.email, token=request.token)

    try:
        await client.verify_connection()
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Failed to connect to Jira. Please check your credentials. ({type(e).__name__})",
        )

    if state.jira_client:
        await state.jira_client.close()

    state.jira_client = client
    state.is_demo = False
    return JiraConnectResponse(connected=True)


@app.get("/api/jira/projects", response_model=list[JiraProject])
async def get_projects():
    if state.is_demo:
        return DEMO_PROJECTS

    if not state.jira_client:
        raise HTTPException(status_code=401, detail="Not connected to Jira. Please connect first.")

    try:
        projects = await state.jira_client.get_projects()
        state.project_cache = {p.key: p for p in projects}
        return projects
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch projects from Jira: {str(e)}")


@app.get("/api/jira/projects/{project_key}/sprints", response_model=list[JiraSprint])
async def get_sprints(project_key: str):
    if state.is_demo:
        sprints = DEMO_SPRINTS.get(project_key, [])
        return sprints

    if not state.jira_client:
        raise HTTPException(status_code=401, detail="Not connected to Jira. Please connect first.")

    try:
        return await state.jira_client.get_sprints(project_key)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch sprints: {str(e)}")


@app.get("/api/jira/issues", response_model=list[JiraIssue])
async def get_issues(project_key: str, sprint_id: int | None = None):
    if state.is_demo:
        if sprint_id and sprint_id in DEMO_ISSUES:
            return DEMO_ISSUES[sprint_id]
        return []

    if not state.jira_client:
        raise HTTPException(status_code=401, detail="Not connected to Jira. Please connect first.")

    try:
        return await state.jira_client.get_issues(project_key, sprint_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch issues: {str(e)}")


@app.post("/api/reports/generate")
async def generate_report_endpoint(request: ReportGenerateRequest):
    if state.is_demo:
        issues = DEMO_ISSUES.get(request.sprintId, []) if request.sprintId else []
        sprint_name = "Unknown Sprint"
        sprint_state = "active"
        for sprint_list in DEMO_SPRINTS.values():
            for s in sprint_list:
                if s.id == request.sprintId:
                    sprint_name = s.name
                    sprint_state = s.state
                    break

        project_name = request.projectKey
        for p in DEMO_PROJECTS:
            if p.key == request.projectKey:
                project_name = p.name
                break
    else:
        if not state.jira_client:
            raise HTTPException(status_code=401, detail="Not connected to Jira. Please connect first.")

        try:
            issues = await state.jira_client.get_issues(request.projectKey, request.sprintId)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch issues: {str(e)}")

        project_name = state.project_cache.get(request.projectKey, JiraProject(key=request.projectKey, name=request.projectKey, lead="")).name
        sprint_name = f"Sprint {request.sprintId}"
        sprint_state = "active"

    if not issues:
        raise HTTPException(status_code=404, detail="No issues found for the selected project and sprint.")

    try:
        report = await generate_report(
            report_type=request.reportType,
            issues=issues,
            project_key=request.projectKey,
            project_name=project_name,
            sprint_name=sprint_name,
            sprint_state=sprint_state,
        )
        return report.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
