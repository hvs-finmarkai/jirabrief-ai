from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.audit import log_event
from app.core.database import get_db
from app.core.security import get_current_org_member, require_role
from app.core.encryption import encrypt_token, decrypt_token, EncryptionNotConfigured
from app.core.net import validate_outbound_url, UnsafeURLError
from app.jira.client import JiraClient, JiraClientError
from app.models.tables import OrganizationMember, JiraConnection

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


@router.post("/connect", response_model=JiraConnectionResponse)
async def connect_jira(
    body: JiraConnectRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    # The site URL is attacker-controllable input that the backend then fetches,
    # so it has to clear the SSRF guard before any request is made with it.
    try:
        site_url = validate_outbound_url(body.jira_site_url)
    except UnsafeURLError as e:
        raise HTTPException(status_code=400, detail=str(e))

    client = JiraClient(base_url=site_url, email=body.email, api_token=body.api_token)

    try:
        await client.verify()
    except JiraClientError as e:
        raise HTTPException(status_code=401, detail=f"Failed to connect: {str(e)}")

    try:
        encrypted_token = encrypt_token(body.api_token)
    except EncryptionNotConfigured as e:
        raise HTTPException(status_code=500, detail=str(e))

    now = datetime.now(timezone.utc)
    conn = await _load_connection(db, member.organization_id)

    if conn:
        conn.connection_name = body.connection_name
        conn.jira_site_url = site_url
        conn.jira_email = body.email
        conn.encrypted_api_token = encrypted_token
        conn.status = "active"
        conn.last_connected_at = now
    else:
        conn = JiraConnection(
            organization_id=member.organization_id,
            connection_name=body.connection_name,
            jira_site_url=site_url,
            jira_email=body.email,
            encrypted_api_token=encrypted_token,
            status="active",
            last_connected_at=now,
        )
        db.add(conn)

    await db.commit()

    return JiraConnectionResponse(
        id=str(conn.id),
        connection_name=conn.connection_name,
        jira_site_url=conn.jira_site_url,
        jira_email=conn.jira_email,
        status=conn.status,
        last_connected_at=now.isoformat(),
    )


@router.delete("/disconnect")
async def disconnect_jira(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(JiraConnection).where(JiraConnection.organization_id == member.organization_id)
    )
    await db.commit()
    return {"disconnected": True}


@router.get("/connection", response_model=JiraConnectionResponse | None)
async def get_connection(
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    conn = await _load_connection(db, member.organization_id)
    if not conn:
        return None
    return JiraConnectionResponse(
        id=str(conn.id),
        connection_name=conn.connection_name,
        jira_site_url=conn.jira_site_url,
        jira_email=conn.jira_email,
        status=conn.status,
        last_connected_at=conn.last_connected_at.isoformat() if conn.last_connected_at else None,
    )


@router.get("/projects", response_model=list[JiraProjectResponse])
async def get_projects(
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(db, member.organization_id)
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
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(db, member.organization_id)
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
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(db, member.organization_id)
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
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(db, member.organization_id)
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
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(db, member.organization_id)
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

    # Persist it, otherwise the report exists only in this response and
    # /api/reports stays permanently empty.
    from app.reports.storage import save_report

    stored = await save_report(
        db,
        organization_id=str(member.organization_id),
        report_data=report.model_dump(),
        source_keys=report.source_issue_keys,
        generated_by=member.user_id,
    )

    await log_event(
        db,
        event="report.generated",
        actor=member.user_id,
        organization_id=str(member.organization_id),
        metadata={"report_id": stored.id, "project_key": project_key, "report_type": report_type},
    )

    # Return the stored id so the client can immediately link to the saved report.
    payload = report.model_dump()
    payload["id"] = stored.id
    return payload


async def _load_connection(db: AsyncSession, org_id: uuid.UUID) -> JiraConnection | None:
    # One connection per org, but nothing at the DB level enforces that, so take
    # the first row rather than blowing up on a duplicate.
    result = await db.execute(
        select(JiraConnection).where(JiraConnection.organization_id == org_id).limit(1)
    )
    return result.scalars().first()


async def _get_client(db: AsyncSession, org_id: uuid.UUID) -> JiraClient:
    conn = await _load_connection(db, org_id)
    if not conn:
        raise HTTPException(status_code=400, detail="No Jira connection. Connect Jira first.")
    try:
        token = decrypt_token(conn.encrypted_api_token)
    except EncryptionNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    return JiraClient(base_url=conn.jira_site_url, email=conn.jira_email, api_token=token)
