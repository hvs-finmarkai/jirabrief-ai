from __future__ import annotations
import json
import uuid
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.tables import AuditLog

REDACTED_KEYS = ("token", "password", "secret", "api_token", "api_key")


class AuditEntry(BaseModel):
    id: str
    organization_id: str | None
    actor: str
    event: str
    timestamp: str
    metadata: dict | None


def _as_uuid(value: str | uuid.UUID | None) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _to_entry(row: AuditLog) -> AuditEntry:
    return AuditEntry(
        id=str(row.id),
        organization_id=str(row.organization_id) if row.organization_id else None,
        actor=row.actor,
        event=row.event,
        timestamp=row.created_at.isoformat(),
        metadata=json.loads(row.event_metadata) if row.event_metadata is not None else None,
    )


async def log_event(
    db: AsyncSession,
    event: str,
    actor: str,
    organization_id: str | uuid.UUID | None = None,
    metadata: dict | None = None,
) -> AuditEntry:
    safe_metadata = None
    if metadata:
        safe_metadata = {k: v for k, v in metadata.items() if k not in REDACTED_KEYS}

    row = AuditLog(
        organization_id=_as_uuid(organization_id),
        actor=actor,
        event=event,
        event_metadata=json.dumps(safe_metadata) if safe_metadata is not None else None,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _to_entry(row)


async def get_audit_log(
    db: AsyncSession,
    organization_id: str | uuid.UUID,
    limit: int = 100,
) -> list[AuditEntry]:
    org_id = _as_uuid(organization_id)
    if org_id is None:
        return []

    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.organization_id == org_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return [_to_entry(row) for row in result.scalars().all()]
