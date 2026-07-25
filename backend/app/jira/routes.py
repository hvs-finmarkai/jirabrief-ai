from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_org_member, require_role
from app.core.encryption import encrypt_token, decrypt_token
from app.jira.client import JiraClient, JiraClientError
from app.models.tables import OrganizationMember

router = APIRouter(prefix="/api/jira", tags=["jira"])


class JiraConnectRequest(BaseModel):
    connection_name: str = Field(min_length=1, max_length=255)
    jira_site_url: str = Field(min_length=10)
    email: str = Field(min_length=3)
    api_token: str = Field(min_length=10)


class JiraConnectionResponse(BaseModel):
    id: str
    connection_name: str
    jira_site_url: str
    jira_email: str
    status: str
    last_connected_at: str | None


class JiraProjectResponse(BaseModel):
    id: str
    key: str
    name: str
    lead: str


class JiraSprintResponse(BaseModel):
    id: int
    name: str
    state: str
    start_date: str | None
    end_date: str | None


class SyncStatusResponse(BaseModel):
    status: str
    last_sync: str | None
    issues_synced: int
    message: str | None


_connections: dict[str, dict] = {}


@router.post("/connect", response_model=JiraConnectionResponse)
async def connect_jira(
    body: JiraConnectRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    site_url = body.jira_site_url.rstrip("/")
    client = JiraClient(base_url=site_url, email=body.email, api_token=body.api_token)

    try:
        await client.verify()
    except JiraClientError as e:
        raise HTTPException(status_code=401, detail=f"Failed to connect: {str(e)}")

    conn_id = str(uuid.uuid4())
    org_id = str(member.organization_id)

    _connections[org_id] = {
        "id": conn_id,
        "connection_name": body.connection_name,
        "jira_site_url": site_url,
        "jira_email": body.email,
        "encrypted_api_token": encrypt_token(body.api_token),
        "status": "active",
        "last_connected_at": datetime.now(timezone.utc).isoformat(),
        "org_id": org_id,
    }

    return JiraConnectionResponse(
        id=conn_id,
        connection_name=body.connection_name,
        jira_site_url=site_url,
        jira_email=body.email,
        status="active",
        last_connected_at=datetime.now(timezone.utc).isoformat(),
    )


@router.delete("/disconnect")
async def disconnect_jira(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    org_id = str(member.organization_id)
    if org_id in _connections:
        del _connections[org_id]
    return {"disconnected": True}


@router.get("/connection", response_model=JiraConnectionResponse | None)
async def get_connection(
    member: OrganizationMember = Depends(get_current_org_member),
):
    org_id = str(member.organization_id)
    conn = _connections.get(org_id)
    if not conn:
        return None
    return JiraConnectionResponse(
        id=conn["id"],
        connection_name=conn["connection_name"],
        jira_site_url=conn["jira_site_url"],
        jira_email=conn["jira_email"],
        status=conn["status"],
        last_connected_at=conn["last_connected_at"],
    )


@router.get("/projects", response_model=list[JiraProjectResponse])
async def get_projects(
    member: OrganizationMember = Depends(get_current_org_member),
):
    client = _get_client(str(member.organization_id))
    try:
        projects = await client.get_projects()
        return [
            JiraProjectResponse(id=p["id"], key=p["key"], name=p["name"], lead=p.get("lead", ""))
            for p in projects
        ]
    except JiraClientError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/projects/{project_key}/sprints", response_model=list[JiraSprintResponse])
async def get_sprints(
    project_key: str,
    member: OrganizationMember = Depends(get_current_org_member),
):
    client = _get_client(str(member.organization_id))
    try:
        sprints = await client.get_sprints(project_key)
        return [
            JiraSprintResponse(
                id=s["id"],
                name=s["name"],
                state=s["state"],
                start_date=s.get("start_date"),
                end_date=s.get("end_date"),
            )
            for s in sprints
        ]
    except JiraClientError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/issues")
async def get_issues(
    project_key: str,
    sprint_id: int | None = None,
    member: OrganizationMember = Depends(get_current_org_member),
):
    client = _get_client(str(member.organization_id))
    try:
        issues = await client.get_issues(project_key, sprint_id)
        return issues
    except JiraClientError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/sync")
async def trigger_sync(
    project_key: str,
    sprint_id: int | None = None,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN", "MEMBER")),
):
    client = _get_client(str(member.organization_id))
    try:
        issues = await client.get_issues(project_key, sprint_id)
        return SyncStatusResponse(
            status="SUCCESS",
            last_sync=datetime.now(timezone.utc).isoformat(),
            issues_synced=len(issues),
            message=f"Synced {len(issues)} issues",
        )
    except JiraClientError as e:
        return SyncStatusResponse(
            status="FAILED",
            last_sync=None,
            issues_synced=0,
            message=str(e),
        )


@router.post("/reports/generate")
async def generate_from_jira(
    project_key: str,
    sprint_id: int | None = None,
    report_type: str = "SPRINT_SUMMARY",
    member: OrganizationMember = Depends(get_current_org_member),
):
    client = _get_client(str(member.organization_id))
    try:
        issues = await client.get_issues(project_key, sprint_id)
    except JiraClientError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not issues:
        raise HTTPException(status_code=404, detail="No issues found")

    from app.reports.generator import generate_report
    sprints = await client.get_sprints(project_key)
    sprint_name = "Current Sprint"
    sprint_end_date = None
    for s in sprints:
        if s["id"] == sprint_id:
            sprint_name = s["name"]
            sprint_end_date = s.get("end_date")
            break

    normalized = []
    for issue in issues:
        normalized.append({
            "key": issue["key"],
            "summary": issue["summary"],
            "status": issue["status"],
            "priority": issue["priority"],
            "assignee": issue.get("assignee"),
            "issue_type": issue.get("issue_type", "Task"),
            "labels": issue.get("labels", []),
            "due_date": issue.get("due_date"),
            "blocked_by": issue.get("blocked_by"),
            "comments": issue.get("comments", []),
        })

    report = await generate_report(
        report_type=report_type,
        issues=normalized,
        project_key=project_key,
        project_name=project_key,
        sprint_name=sprint_name,
        sprint_end_date=sprint_end_date,
    )
    return report


def _get_client(org_id: str) -> JiraClient:
    conn = _connections.get(org_id)
    if not conn:
        raise HTTPException(status_code=400, detail="No Jira connection. Connect Jira first.")
    token = decrypt_token(conn["encrypted_api_token"])
    return JiraClient(base_url=conn["jira_site_url"], email=conn["jira_email"], api_token=token)
