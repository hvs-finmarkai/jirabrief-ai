from __future__ import annotations
from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.models.tables import Profile
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
    profile: Profile = Depends(get_current_user),
):
    return get_notifications(profile.user_id, unread_only=unread_only)


@router.put("/{notification_id}/read")
async def read_notification(
    notification_id: str,
    profile: Profile = Depends(get_current_user),
):
    mark_read(notification_id, profile.user_id)
    return {"read": True}


@router.put("/read-all")
async def read_all_notifications(
    profile: Profile = Depends(get_current_user),
):
    count = mark_all_read(profile.user_id)
    return {"marked_read": count}
