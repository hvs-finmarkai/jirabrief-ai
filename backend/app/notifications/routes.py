from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_org_member
from app.models.tables import OrganizationMember
from app.notifications.service import (
    NotificationEvent,
    get_notifications,
    mark_read,
    mark_all_read,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationEvent])
async def list_notifications(
    unread_only: bool = False,
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    return await get_notifications(
        db,
        str(member.organization_id),
        member.user_id,
        unread_only=unread_only,
    )


@router.put("/{notification_id}/read")
async def read_notification(
    notification_id: str,
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    await mark_read(db, notification_id, str(member.organization_id), member.user_id)
    return {"read": True}


@router.put("/read-all")
async def read_all_notifications(
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    count = await mark_all_read(db, str(member.organization_id), member.user_id)
    return {"marked_read": count}
