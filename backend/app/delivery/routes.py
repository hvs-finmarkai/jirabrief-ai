from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import get_current_org_member, require_role
from app.models.tables import OrganizationMember
from app.delivery.providers import (
    get_provider,
    deliver_report,
    get_delivery_logs,
    DeliveryLog,
    DeliveryResult,
)

router = APIRouter(prefix="/api/delivery", tags=["delivery"])


class ChannelConfig(BaseModel):
    channel_type: str
    name: str
    config: dict


class SendRequest(BaseModel):
    channel_type: str
    config: dict
    report_id: str | None = None
    subject: str
    content: str


class TestRequest(BaseModel):
    channel_type: str
    config: dict


_channel_store: dict[str, dict] = {}


@router.post("/channels", response_model=dict)
async def create_channel(
    body: ChannelConfig,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    org_id = str(member.organization_id)
    channel_id = str(uuid.uuid4())
    _channel_store[channel_id] = {
        "id": channel_id,
        "organization_id": org_id,
        "channel_type": body.channel_type,
        "name": body.name,
        "config": body.config,
        "enabled": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return {"id": channel_id, "name": body.name, "channel_type": body.channel_type}


@router.get("/channels")
async def list_channels(
    member: OrganizationMember = Depends(get_current_org_member),
):
    org_id = str(member.organization_id)
    return [
        {"id": c["id"], "name": c["name"], "channel_type": c["channel_type"], "enabled": c["enabled"]}
        for c in _channel_store.values()
        if c["organization_id"] == org_id
    ]


@router.delete("/channels/{channel_id}")
async def delete_channel(
    channel_id: str,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    org_id = str(member.organization_id)
    ch = _channel_store.get(channel_id)
    if not ch or ch["organization_id"] != org_id:
        raise HTTPException(status_code=404, detail="Channel not found")
    del _channel_store[channel_id]
    return {"deleted": True}


@router.post("/test", response_model=DeliveryResult)
async def test_connection(
    body: TestRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    provider = get_provider(body.channel_type)
    return await provider.test_connection(body.config)


@router.post("/send", response_model=DeliveryLog)
async def send_delivery(
    body: SendRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN", "MEMBER")),
):
    org_id = str(member.organization_id)
    return await deliver_report(
        organization_id=org_id,
        report_id=body.report_id,
        channel_type=body.channel_type,
        channel_config=body.config,
        content=body.content,
        subject=body.subject,
    )


@router.get("/logs", response_model=list[DeliveryLog])
async def list_logs(
    report_id: str | None = None,
    member: OrganizationMember = Depends(get_current_org_member),
):
    return get_delivery_logs(str(member.organization_id), report_id=report_id)
