from __future__ import annotations
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import require_role
from app.core.audit import log_event
from app.models.tables import OrganizationMember

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


class PendingUser(BaseModel):
    id: str
    email: str
    display_name: str
    requested_at: str
    status: str


class UserApprovalRequest(BaseModel):
    role: str = "MEMBER"


_pending_users: list[PendingUser] = []
_approved_users: list[dict] = []


def add_pending_user(email: str, display_name: str) -> PendingUser:
    user = PendingUser(
        id=str(uuid.uuid4()),
        email=email,
        display_name=display_name,
        requested_at=datetime.now(timezone.utc).isoformat(),
        status="PENDING",
    )
    _pending_users.append(user)
    return user


@router.get("/pending", response_model=list[PendingUser])
async def list_pending_users(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    return [u for u in _pending_users if u.status == "PENDING"]


@router.post("/{user_id}/approve")
async def approve_user(
    user_id: str,
    body: UserApprovalRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    if body.role == "OWNER" and member.role != "OWNER":
        raise HTTPException(status_code=403, detail="Only OWNER can assign OWNER role")
    if body.role == "ADMIN" and member.role != "OWNER":
        raise HTTPException(status_code=403, detail="Only OWNER can assign ADMIN role")

    target = None
    for u in _pending_users:
        if u.id == user_id:
            target = u
            break

    if not target:
        raise HTTPException(status_code=404, detail="Pending user not found")

    target.status = "APPROVED"
    _approved_users.append({
        "id": target.id,
        "email": target.email,
        "display_name": target.display_name,
        "role": body.role,
        "approved_by": member.user_id,
        "approved_at": datetime.now(timezone.utc).isoformat(),
    })

    log_event("USER_APPROVED", actor=member.user_id, organization_id=str(member.organization_id), metadata={"email": target.email, "role": body.role})
    return {"approved": True, "email": target.email, "role": body.role}


@router.post("/{user_id}/reject")
async def reject_user(
    user_id: str,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    target = None
    for u in _pending_users:
        if u.id == user_id:
            target = u
            break

    if not target:
        raise HTTPException(status_code=404, detail="Pending user not found")

    target.status = "REJECTED"
    log_event("USER_REJECTED", actor=member.user_id, organization_id=str(member.organization_id), metadata={"email": target.email})
    return {"rejected": True, "email": target.email}


@router.get("/all")
async def list_all_users(
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    return _approved_users


@router.delete("/{user_id}")
async def remove_user(
    user_id: str,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    global _approved_users
    _approved_users = [u for u in _approved_users if u["id"] != user_id]
    log_event("USER_REMOVED", actor=member.user_id, organization_id=str(member.organization_id), metadata={"target_id": user_id})
    return {"removed": True}


@router.put("/{user_id}/role")
async def change_user_role(
    user_id: str,
    body: UserApprovalRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    if body.role in ("OWNER", "ADMIN") and member.role != "OWNER":
        raise HTTPException(status_code=403, detail="Only OWNER can assign OWNER/ADMIN roles")

    for u in _approved_users:
        if u["id"] == user_id:
            u["role"] = body.role
            log_event("ROLE_CHANGED", actor=member.user_id, organization_id=str(member.organization_id), metadata={"target_id": user_id, "new_role": body.role})
            return {"changed": True, "role": body.role}

    raise HTTPException(status_code=404, detail="User not found")
