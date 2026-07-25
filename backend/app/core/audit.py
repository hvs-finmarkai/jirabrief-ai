from __future__ import annotations
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel


class AuditEntry(BaseModel):
    id: str
    organization_id: str | None
    actor: str
    event: str
    timestamp: str
    metadata: dict | None


_audit_store: list[AuditEntry] = []


def log_event(
    event: str,
    actor: str,
    organization_id: str | None = None,
    metadata: dict | None = None,
) -> AuditEntry:
    safe_metadata = None
    if metadata:
        safe_metadata = {k: v for k, v in metadata.items() if k not in ("token", "password", "secret", "api_token", "api_key")}

    entry = AuditEntry(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        actor=actor,
        event=event,
        timestamp=datetime.now(timezone.utc).isoformat(),
        metadata=safe_metadata,
    )
    _audit_store.append(entry)
    return entry


def get_audit_log(organization_id: str, limit: int = 100) -> list[AuditEntry]:
    results = [e for e in _audit_store if e.organization_id == organization_id]
    results.sort(key=lambda e: e.timestamp, reverse=True)
    return results[:limit]
