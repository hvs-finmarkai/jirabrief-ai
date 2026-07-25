from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.net import UnsafeURLError
from app.core.security import get_current_org_member, require_role
from app.models.tables import DeliveryChannel, OrganizationMember
from app.delivery.providers import (
    get_provider,
    deliver_report,
    get_delivery_logs,
    redact_secrets,
    validate_channel_urls,
    encode_channel_config,
    masked_channel_config,
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


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


async def _get_channel(db: AsyncSession, channel_id: str, org_id: uuid.UUID) -> DeliveryChannel | None:
    try:
        parsed = uuid.UUID(channel_id)
    except ValueError:
        return None
    result = await db.execute(
        select(DeliveryChannel).where(
            DeliveryChannel.id == parsed,
            DeliveryChannel.organization_id == org_id,
        )
    )
    return result.scalar_one_or_none()


def _guard_urls(channel_type: str, config: dict) -> None:
    try:
        validate_channel_urls(channel_type, config)
    except UnsafeURLError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/channels", response_model=dict)
async def create_channel(
    body: ChannelConfig,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    try:
        get_provider(body.channel_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    _guard_urls(body.channel_type, body.config)

    now = datetime.now(timezone.utc)
    channel = DeliveryChannel(
        id=uuid.uuid4(),
        organization_id=member.organization_id,
        channel_type=body.channel_type,
        name=body.name,
        config=encode_channel_config(body.config),
        enabled=True,
        created_at=now,
        updated_at=now,
    )
    db.add(channel)
    await db.commit()

    return {"id": str(channel.id), "name": body.name, "channel_type": body.channel_type}


@router.get("/channels")
async def list_channels(
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DeliveryChannel)
        .where(DeliveryChannel.organization_id == member.organization_id)
        .order_by(DeliveryChannel.created_at)
    )
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "channel_type": c.channel_type,
            "enabled": c.enabled,
            "config": masked_channel_config(c.config),
        }
        for c in result.scalars().all()
    ]


@router.delete("/channels/{channel_id}")
async def delete_channel(
    channel_id: str,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    channel = await _get_channel(db, channel_id, member.organization_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    await db.delete(channel)
    await db.commit()
    return {"deleted": True}


@router.post("/test", response_model=DeliveryResult)
async def test_connection(
    body: TestRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
):
    _guard_urls(body.channel_type, body.config)

    provider = get_provider(body.channel_type)
    result = await provider.test_connection(body.config)
    result.error_message = redact_secrets(result.error_message, body.config)
    return result


@router.post("/send", response_model=DeliveryLog)
async def send_delivery(
    body: SendRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN", "MEMBER")),
    db: AsyncSession = Depends(get_db),
):
    _guard_urls(body.channel_type, body.config)

    if body.report_id and not _is_uuid(body.report_id):
        raise HTTPException(status_code=400, detail="report_id must be a valid UUID")

    org_id = str(member.organization_id)
    return await deliver_report(
        db,
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
    db: AsyncSession = Depends(get_db),
):
    if report_id and not _is_uuid(report_id):
        return []
    return await get_delivery_logs(db, str(member.organization_id), report_id=report_id)
