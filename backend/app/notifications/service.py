from __future__ import annotations
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel


class NotificationEvent(BaseModel):
    id: str
    organization_id: str
    user_id: str
    event_type: str
    title: str
    body: str | None
    read: bool
    created_at: str


_notification_store: list[NotificationEvent] = []


def create_notification(
    organization_id: str,
    user_id: str,
    event_type: str,
    title: str,
    body: str | None = None,
) -> NotificationEvent:
    event = NotificationEvent(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        user_id=user_id,
        event_type=event_type,
        title=title,
        body=body,
        read=False,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    _notification_store.append(event)
    return event


def get_notifications(user_id: str, unread_only: bool = False, limit: int = 20) -> list[NotificationEvent]:
    results = [n for n in _notification_store if n.user_id == user_id]
    if unread_only:
        results = [n for n in results if not n.read]
    results.sort(key=lambda n: n.created_at, reverse=True)
    return results[:limit]


def mark_read(notification_id: str, user_id: str) -> bool:
    for n in _notification_store:
        if n.id == notification_id and n.user_id == user_id:
            n.read = True
            return True
    return False


def mark_all_read(user_id: str) -> int:
    count = 0
    for n in _notification_store:
        if n.user_id == user_id and not n.read:
            n.read = True
            count += 1
    return count
