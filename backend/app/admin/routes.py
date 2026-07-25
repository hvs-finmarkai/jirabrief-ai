from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import require_role, get_current_org_member
from app.core.audit import log_event, get_audit_log, AuditEntry
from app.models.tables import OrganizationMember
from app.ai.provider import get_ai_provider
from app.demo.data import DEMO_PROJECTS, DEMO_SPRINTS, DEMO_ISSUES

router = APIRouter(prefix="/api/admin", tags=["admin"])


class InviteRequest(BaseModel):
    email: str
    role: str = "MEMBER"


class RoleChangeRequest(BaseModel):
    role: str


@router.get("/dashboard")
async def admin_dashboard(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    from app.reports.storage import list_reports
    from app.schedules.service import list_schedules
    from app.delivery.providers import get_delivery_logs

    org_id = str(member.organization_id)
    reports = list_reports(org_id)
    schedules = list_schedules(org_id)
    logs = get_delivery_logs(org_id)

    failed_reports = [r for r in reports if r.status == "FAILED"]
    pending_approvals = [r for r in reports if r.approval_status == "IN_REVIEW"]
    failed_deliveries = [l for l in logs if l.status == "FAILED"]

    return {
        "organization_id": org_id,
        "active_members": 1,
        "connected_projects": 3,
        "jira_status": "demo",
        "last_sync": "Demo mode - always current",
        "reports_generated": len(reports),
        "active_schedules": len([s for s in schedules if s.enabled]),
        "failed_reports": len(failed_reports),
        "failed_deliveries": len(failed_deliveries),
        "pending_approvals": len(pending_approvals),
        "attention": _build_attention(failed_reports, failed_deliveries, pending_approvals),
    }


def _build_attention(failed_reports, failed_deliveries, pending_approvals) -> list[dict]:
    items = []
    if failed_reports:
        items.append({"type": "error", "message": f"{len(failed_reports)} failed report(s)"})
    if failed_deliveries:
        items.append({"type": "error", "message": f"{len(failed_deliveries)} failed delivery(ies)"})
    if pending_approvals:
        items.append({"type": "warning", "message": f"{len(pending_approvals)} report(s) awaiting approval"})
    return items


@router.get("/members")
async def list_members(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    return [
        {"user_id": member.user_id, "role": member.role, "email": "current-user", "joined": str(member.created_at)},
    ]


@router.post("/members/invite")
async def invite_member(
    body: InviteRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    if body.role == "OWNER" and member.role != "OWNER":
        raise HTTPException(status_code=403, detail="Only OWNER can assign OWNER role")
    log_event("MEMBER_INVITED", actor=member.user_id, organization_id=str(member.organization_id), metadata={"email": body.email, "role": body.role})
    return {"invited": True, "email": body.email, "role": body.role}


@router.put("/members/{target_user_id}/role")
async def change_role(
    target_user_id: str,
    body: RoleChangeRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    if body.role == "OWNER" and member.role != "OWNER":
        raise HTTPException(status_code=403, detail="Only OWNER can assign OWNER role")
    if member.role == "ADMIN" and body.role in ("OWNER", "ADMIN"):
        raise HTTPException(status_code=403, detail="ADMIN cannot escalate to OWNER or ADMIN")
    log_event("ROLE_CHANGED", actor=member.user_id, organization_id=str(member.organization_id), metadata={"target": target_user_id, "new_role": body.role})
    return {"changed": True, "user_id": target_user_id, "new_role": body.role}


@router.delete("/members/{target_user_id}")
async def remove_member(
    target_user_id: str,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    if target_user_id == member.user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    log_event("MEMBER_REMOVED", actor=member.user_id, organization_id=str(member.organization_id), metadata={"target": target_user_id})
    return {"removed": True}


@router.get("/ai")
async def ai_status(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    from app.core.config import get_settings
    settings = get_settings()
    provider = get_ai_provider()
    healthy = await provider.health_check()
    return {
        "provider": settings.ai_provider,
        "model": settings.groq_model if settings.ai_provider == "groq" else settings.ollama_model,
        "status": "Healthy" if healthy else "Unavailable",
    }


@router.post("/ai/test")
async def test_ai(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    provider = get_ai_provider()
    try:
        result = await provider.generate("You are a test. Reply with JSON: {\"status\": \"ok\"}", "Test connection.")
        return {"success": True, "response_preview": result[:100]}
    except Exception as e:
        return {"success": False, "error": str(e)[:200]}


@router.get("/health")
async def system_health(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    from app.core.config import get_settings
    settings = get_settings()
    provider = get_ai_provider()
    ai_healthy = await provider.health_check()

    return {
        "database": "Healthy",
        "api": "Healthy",
        "jira": "Demo Mode",
        "ai": "Healthy" if ai_healthy else "Unavailable",
        "email": "Not Configured" if not settings.resend_api_key else "Configured",
        "slack": "Not Configured",
        "confluence": "Not Configured",
        "scheduler": "Healthy",
    }


@router.get("/audit", response_model=list[AuditEntry])
async def get_audit(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    return get_audit_log(str(member.organization_id))


@router.post("/demo/reset")
async def reset_demo(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    from app.reports.storage import _report_store
    org_id = str(member.organization_id)
    keys_to_remove = [k for k, v in _report_store.items() if v.organization_id == org_id]
    for k in keys_to_remove:
        del _report_store[k]
    log_event("DEMO_RESET", actor=member.user_id, organization_id=org_id)
    return {"reset": True, "reports_cleared": len(keys_to_remove)}


@router.get("/report-settings")
async def get_report_settings(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    return {
        "default_tone": "concise",
        "default_length": "standard",
        "require_quality_validation": True,
        "require_approval": False,
        "organization_instructions": None,
    }


@router.put("/report-settings")
async def update_report_settings(
    body: dict,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    log_event("REPORT_SETTINGS_UPDATED", actor=member.user_id, organization_id=str(member.organization_id))
    return {"updated": True}
