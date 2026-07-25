from __future__ import annotations
import json
import uuid
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.tables import NotificationEvent as NotificationEventRow


class NotificationEvent(BaseModel):
    id: str
    organization_id: str
    user_id: str
    event_type: str
    title: str
    body: str | None
    read: bool
    created_at: str


def _as_uuid(value: str | uuid.UUID) -> uuid.UUID | None:
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _to_event(row: NotificationEventRow) -> NotificationEvent:
    return NotificationEvent(
        id=str(row.id),
        organization_id=str(row.organization_id),
        user_id=row.user_id,
        event_type=row.event_type,
        title=row.title,
        body=row.body,
        read=row.read,
        created_at=row.created_at.isoformat(),
    )


async def create_notification(
    db: AsyncSession,
    organization_id: str | uuid.UUID,
    user_id: str,
    event_type: str,
    title: str,
    body: str | None = None,
    metadata: dict | None = None,
) -> NotificationEvent:
    row = NotificationEventRow(
        organization_id=_as_uuid(organization_id),
        user_id=user_id,
        event_type=event_type,
        title=title,
        body=body,
        read=False,
        event_metadata=json.dumps(metadata) if metadata is not None else None,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _to_event(row)


async def get_notifications(
    db: AsyncSession,
    organization_id: str | uuid.UUID,
    user_id: str,
    unread_only: bool = False,
    limit: int = 20,
) -> list[NotificationEvent]:
    org_id = _as_uuid(organization_id)
    if org_id is None:
        return []

    stmt = select(NotificationEventRow).where(
        NotificationEventRow.organization_id == org_id,
        NotificationEventRow.user_id == user_id,
    )
    if unread_only:
        stmt = stmt.where(NotificationEventRow.read.is_(False))

    result = await db.execute(
        stmt.order_by(NotificationEventRow.created_at.desc()).limit(limit)
    )
    return [_to_event(row) for row in result.scalars().all()]


async def mark_read(
    db: AsyncSession,
    notification_id: str | uuid.UUID,
    organization_id: str | uuid.UUID,
    user_id: str,
) -> bool:
    notif_id = _as_uuid(notification_id)
    org_id = _as_uuid(organization_id)
    if notif_id is None or org_id is None:
        return False

    result = await db.execute(
        update(NotificationEventRow)
        .where(
            NotificationEventRow.id == notif_id,
            NotificationEventRow.organization_id == org_id,
            NotificationEventRow.user_id == user_id,
        )
        .values(read=True)
    )
    await db.commit()
    return result.rowcount > 0


async def mark_all_read(
    db: AsyncSession,
    organization_id: str | uuid.UUID,
    user_id: str,
) -> int:
    org_id = _as_uuid(organization_id)
    if org_id is None:
        return 0

    result = await db.execute(
        update(NotificationEventRow)
        .where(
            NotificationEventRow.organization_id == org_id,
            NotificationEventRow.user_id == user_id,
            NotificationEventRow.read.is_(False),
        )
        .values(read=True)
    )
    await db.commit()
    return result.rowcount
