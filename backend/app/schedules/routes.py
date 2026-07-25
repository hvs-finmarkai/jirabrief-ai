from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_org_member, require_role
from app.models.tables import OrganizationMember
from app.schedules.service import (
    Schedule,
    ScheduleCreateRequest,
    ScheduleUpdateRequest,
    create_schedule,
    list_schedules,
    get_schedule,
    update_schedule,
    delete_schedule,
)

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.get("", response_model=list[Schedule])
async def get_schedules(
    member: OrganizationMember = Depends(get_current_org_member),
):
    return list_schedules(str(member.organization_id))


@router.post("", response_model=Schedule)
async def create_new_schedule(
    body: ScheduleCreateRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN", "MEMBER")),
):
    return create_schedule(
        org_id=str(member.organization_id),
        body=body,
        created_by=member.user_id,
    )


@router.get("/{schedule_id}", response_model=Schedule)
async def get_single_schedule(
    schedule_id: str,
    member: OrganizationMember = Depends(get_current_org_member),
):
    s = get_schedule(schedule_id, str(member.organization_id))
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return s


@router.put("/{schedule_id}", response_model=Schedule)
async def update_existing_schedule(
    schedule_id: str,
    body: ScheduleUpdateRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN", "MEMBER")),
):
    s = update_schedule(schedule_id, str(member.organization_id), body)
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return s


@router.delete("/{schedule_id}")
async def delete_existing_schedule(
    schedule_id: str,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    if not delete_schedule(schedule_id, str(member.organization_id)):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"deleted": True}
