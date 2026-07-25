from __future__ import annotations
import json
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from app.core.encryption import encrypt_token, decrypt_token, EncryptionNotConfigured
from app.core.net import UnsafeURLError, validate_outbound_url
from app.models.tables import DeliveryChannel as DeliveryChannelRow, DeliveryLog as DeliveryLogRow

if TYPE_CHECKING:
    from app.reports.storage import StoredReport

logger = logging.getLogger(__name__)

# Config keys whose values are credentials: encrypted at rest, masked in
# responses, and scrubbed out of provider error text before it is stored or
# returned. A Slack webhook URL is itself the credential, hence its presence here.
SECRET_CONFIG_FIELDS = ("api_key", "api_token", "webhook_url", "token", "password", "secret")

# User-supplied URLs the server itself makes requests to; every one must clear
# the SSRF guard before it is used.
CHANNEL_URL_FIELDS = {"slack": "webhook_url", "confluence": "base_url"}


class DeliveryResult(BaseModel):
    success: bool
    error_code: str | None = None
    error_message: str | None = None


def mask_secret(value: str) -> str:
    return f"***{value[-4:]}" if len(value) > 8 else "***"


def redact_secrets(text: str | None, config: dict) -> str | None:
    """Strip any credential from `config` out of provider error text.

    httpx errors and upstream response bodies can echo the request URL, which
    for Slack is the webhook secret itself.
    """
    if not text:
        return text
    for key in SECRET_CONFIG_FIELDS:
        value = config.get(key)
        if isinstance(value, str) and len(value) >= 8 and value in text:
            text = text.replace(value, mask_secret(value))
    return text


def validate_channel_urls(channel_type: str, config: dict) -> None:
    """Raise UnsafeURLError if this channel's outbound URL is not safe to call."""
    field = CHANNEL_URL_FIELDS.get(channel_type)
    if not field:
        return
    raw = config.get(field)
    if isinstance(raw, str) and raw.strip():
        validate_outbound_url(raw)


def encode_channel_config(config: dict) -> str:
    """JSON for the delivery_channels.config TEXT column, credentials encrypted."""
    stored = dict(config)
    for key in SECRET_CONFIG_FIELDS:
        value = stored.get(key)
        if isinstance(value, str) and value:
            stored[key] = encrypt_token(value)
    return json.dumps(stored)


def decode_channel_config(raw: str) -> dict:
    config = _load_config(raw)
    for key in SECRET_CONFIG_FIELDS:
        value = config.get(key)
        if isinstance(value, str) and value:
            config[key] = decrypt_token(value)
    return config


def masked_channel_config(raw: str) -> dict:
    """Stored config with every credential reduced to a trailing fragment."""
    config = _load_config(raw)
    masked = {}
    for key, value in config.items():
        if key in SECRET_CONFIG_FIELDS and isinstance(value, str) and value:
            try:
                masked[key] = mask_secret(decrypt_token(value))
            except EncryptionNotConfigured:
                masked[key] = "***"
        else:
            masked[key] = value
    return masked


def _load_config(raw: str) -> dict:
    try:
        config = json.loads(raw or "{}")
    except ValueError:
        return {}
    return config if isinstance(config, dict) else {}


class DeliveryProvider(ABC):
    @abstractmethod
    async def send(self, content: str, subject: str, config: dict) -> DeliveryResult:
        pass

    @abstractmethod
    async def test_connection(self, config: dict) -> DeliveryResult:
        pass


class EmailProvider(DeliveryProvider):
    async def send(self, content: str, subject: str, config: dict) -> DeliveryResult:
        api_key = config.get("api_key", "")
        recipients = config.get("recipients", [])
        from_email = config.get("from_email", "reports@jirabrief.ai")

        if not api_key or not recipients:
            return DeliveryResult(success=False, error_code="MISSING_CONFIG", error_message="API key and recipients required")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "from": from_email,
                        "to": recipients,
                        "subject": subject,
                        "html": f"<div style='font-family:system-ui;max-width:600px'>{content}</div>",
                        "text": content,
                    },
                )
                if response.status_code in (200, 201):
                    return DeliveryResult(success=True)
                return DeliveryResult(success=False, error_code=str(response.status_code), error_message=response.text[:200])
        except Exception as e:
            return DeliveryResult(success=False, error_code="NETWORK_ERROR", error_message=str(e)[:200])

    async def test_connection(self, config: dict) -> DeliveryResult:
        api_key = config.get("api_key", "")
        if not api_key:
            return DeliveryResult(success=False, error_code="MISSING_KEY", error_message="Resend API key is required")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://api.resend.com/domains",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if response.status_code == 200:
                    return DeliveryResult(success=True)
                return DeliveryResult(success=False, error_code=str(response.status_code), error_message="Invalid API key")
        except Exception as e:
            return DeliveryResult(success=False, error_code="NETWORK_ERROR", error_message=str(e)[:200])


class SlackProvider(DeliveryProvider):
    async def send(self, content: str, subject: str, config: dict) -> DeliveryResult:
        webhook_url = config.get("webhook_url", "")
        channel = config.get("channel", "")

        if not webhook_url:
            return DeliveryResult(success=False, error_code="MISSING_CONFIG", error_message="Webhook URL required")

        try:
            webhook_url = validate_outbound_url(webhook_url)
        except UnsafeURLError as e:
            return DeliveryResult(success=False, error_code="UNSAFE_URL", error_message=str(e))

        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": subject[:150]}},
            {"type": "section", "text": {"type": "mrkdwn", "text": content[:3000]}},
        ]

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    webhook_url,
                    json={"blocks": blocks, "text": subject},
                )
                if response.status_code == 200:
                    return DeliveryResult(success=True)
                return DeliveryResult(success=False, error_code=str(response.status_code), error_message=response.text[:200])
        except Exception as e:
            return DeliveryResult(success=False, error_code="NETWORK_ERROR", error_message=str(e)[:200])

    async def test_connection(self, config: dict) -> DeliveryResult:
        webhook_url = config.get("webhook_url", "")
        if not webhook_url:
            return DeliveryResult(success=False, error_code="MISSING_URL", error_message="Slack webhook URL required")

        try:
            webhook_url = validate_outbound_url(webhook_url)
        except UnsafeURLError as e:
            return DeliveryResult(success=False, error_code="UNSAFE_URL", error_message=str(e))

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    webhook_url,
                    json={"text": "JiraBrief AI connection test ✓"},
                )
                if response.status_code == 200:
                    return DeliveryResult(success=True)
                return DeliveryResult(success=False, error_code=str(response.status_code), error_message="Invalid webhook URL")
        except Exception as e:
            return DeliveryResult(success=False, error_code="NETWORK_ERROR", error_message=str(e)[:200])


class ConfluenceProvider(DeliveryProvider):
    async def send(self, content: str, subject: str, config: dict) -> DeliveryResult:
        base_url = config.get("base_url", "")
        email = config.get("email", "")
        api_token = config.get("api_token", "")
        space_key = config.get("space_key", "")
        parent_page_id = config.get("parent_page_id")

        if not all([base_url, email, api_token, space_key]):
            return DeliveryResult(success=False, error_code="MISSING_CONFIG", error_message="Confluence URL, email, token, and space key required")

        try:
            base_url = validate_outbound_url(base_url)
        except UnsafeURLError as e:
            return DeliveryResult(success=False, error_code="UNSAFE_URL", error_message=str(e))

        body = {
            "type": "page",
            "title": subject,
            "space": {"key": space_key},
            "body": {"storage": {"value": f"<p>{content}</p>", "representation": "storage"}},
        }
        if parent_page_id:
            body["ancestors"] = [{"id": parent_page_id}]

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    f"{base_url.rstrip('/')}/rest/api/content",
                    auth=(email, api_token),
                    json=body,
                    headers={"Accept": "application/json"},
                )
                if response.status_code in (200, 201):
                    return DeliveryResult(success=True)
                return DeliveryResult(success=False, error_code=str(response.status_code), error_message=response.text[:200])
        except Exception as e:
            return DeliveryResult(success=False, error_code="NETWORK_ERROR", error_message=str(e)[:200])

    async def test_connection(self, config: dict) -> DeliveryResult:
        base_url = config.get("base_url", "")
        email = config.get("email", "")
        api_token = config.get("api_token", "")

        if not all([base_url, email, api_token]):
            return DeliveryResult(success=False, error_code="MISSING_CONFIG", error_message="URL, email, and token required")

        try:
            base_url = validate_outbound_url(base_url)
        except UnsafeURLError as e:
            return DeliveryResult(success=False, error_code="UNSAFE_URL", error_message=str(e))

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{base_url.rstrip('/')}/rest/api/space",
                    auth=(email, api_token),
                    headers={"Accept": "application/json"},
                    params={"limit": 1},
                )
                if response.status_code == 200:
                    return DeliveryResult(success=True)
                return DeliveryResult(success=False, error_code=str(response.status_code), error_message="Authentication failed")
        except Exception as e:
            return DeliveryResult(success=False, error_code="NETWORK_ERROR", error_message=str(e)[:200])


def get_provider(channel_type: str) -> DeliveryProvider:
    match channel_type:
        case "email":
            return EmailProvider()
        case "slack":
            return SlackProvider()
        case "confluence":
            return ConfluenceProvider()
        case _:
            raise ValueError(f"Unknown channel type: {channel_type}")


class DeliveryLog(BaseModel):
    id: str
    organization_id: str
    report_id: str | None
    channel_id: str | None
    channel_type: str
    status: str
    attempt_count: int
    error_code: str | None
    error_message: str | None
    sent_at: str | None
    created_at: str


MAX_RETRIES = 3


def _as_uuid(value: str | uuid.UUID | None) -> uuid.UUID | None:
    if not value:
        return None
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(value)


def _new_log_row(
    organization_id: str,
    report_id: str | None,
    channel_id: str | None,
    channel_type: str,
) -> DeliveryLogRow:
    return DeliveryLogRow(
        id=uuid.uuid4(),
        organization_id=_as_uuid(organization_id),
        report_id=_as_uuid(report_id),
        channel_id=_as_uuid(channel_id),
        channel_type=channel_type,
        status="PENDING",
        attempt_count=0,
        created_at=datetime.now(timezone.utc),
    )


def _to_log(row: DeliveryLogRow) -> DeliveryLog:
    return DeliveryLog(
        id=str(row.id),
        organization_id=str(row.organization_id),
        report_id=str(row.report_id) if row.report_id else None,
        channel_id=str(row.channel_id) if row.channel_id else None,
        channel_type=row.channel_type,
        status=row.status,
        attempt_count=row.attempt_count,
        error_code=row.error_code,
        error_message=row.error_message,
        sent_at=row.sent_at.isoformat() if row.sent_at else None,
        created_at=row.created_at.isoformat(),
    )


async def deliver_report(
    db: AsyncSession,
    organization_id: str,
    report_id: str | None,
    channel_type: str,
    channel_config: dict,
    content: str,
    subject: str,
    channel_id: str | None = None,
) -> DeliveryLog:
    provider = get_provider(channel_type)

    # Written as PENDING before the first attempt so an in-flight delivery is
    # still visible if the process dies mid-send.
    row = _new_log_row(organization_id, report_id, channel_id, channel_type)
    db.add(row)
    await db.commit()

    for attempt in range(MAX_RETRIES):
        row.attempt_count = attempt + 1
        result = await provider.send(content, subject, channel_config)

        if result.success:
            row.status = "SENT"
            row.sent_at = datetime.now(timezone.utc)
            break
        else:
            row.error_code = result.error_code
            row.error_message = redact_secrets(result.error_message, channel_config)
            if attempt == MAX_RETRIES - 1:
                row.status = "FAILED"

    await db.commit()
    return _to_log(row)


def render_report_content(content: dict) -> str:
    """Flatten any of the report content shapes into readable plain text."""
    sections = []
    for key, value in (content or {}).items():
        if key in ("type", "title"):
            continue
        label = key.replace("_", " ").title()
        if isinstance(value, str) and value.strip():
            sections.append(f"{label}\n{value.strip()}")
        elif isinstance(value, list) and value:
            lines = []
            for item in value:
                if isinstance(item, dict):
                    parts = [str(item[k]) for k in ("key", "summary", "detail") if item.get(k)]
                    lines.append(f"- {' - '.join(parts)}" if parts else f"- {item}")
                else:
                    lines.append(f"- {item}")
            sections.append(f"{label}\n" + "\n".join(lines))
    return "\n\n".join(sections)


async def deliver_report_to_channels(
    db: AsyncSession,
    organization_id: str,
    report: "StoredReport",
) -> list[DeliveryLog]:
    """Fan a stored report out to every enabled channel for the organization."""
    result = await db.execute(
        select(DeliveryChannelRow)
        .where(
            DeliveryChannelRow.organization_id == _as_uuid(organization_id),
            DeliveryChannelRow.enabled.is_(True),
        )
        .order_by(DeliveryChannelRow.created_at)
    )
    channels = result.scalars().all()

    content = render_report_content(report.edited_content or report.generated_content)
    logs = []

    for channel in channels:
        try:
            config = decode_channel_config(channel.config)
            get_provider(channel.channel_type)
        except (EncryptionNotConfigured, ValueError) as e:
            logger.warning("Skipping channel %s: %s", channel.id, e)
            logs.append(
                await _log_skipped_channel(db, organization_id, report.id, channel, str(e))
            )
            continue

        logs.append(
            await deliver_report(
                db,
                organization_id=organization_id,
                report_id=report.id,
                channel_type=channel.channel_type,
                channel_config=config,
                content=content,
                subject=report.title,
                channel_id=str(channel.id),
            )
        )

    return logs


async def _log_skipped_channel(
    db: AsyncSession,
    organization_id: str,
    report_id: str | None,
    channel: DeliveryChannelRow,
    message: str,
) -> DeliveryLog:
    row = _new_log_row(organization_id, report_id, str(channel.id), channel.channel_type)
    row.status = "FAILED"
    row.error_code = "CONFIG_ERROR"
    row.error_message = message[:500]
    db.add(row)
    await db.commit()
    return _to_log(row)


async def get_delivery_logs(
    db: AsyncSession,
    organization_id: str,
    report_id: str | None = None,
    limit: int = 50,
) -> list[DeliveryLog]:
    stmt = select(DeliveryLogRow).where(DeliveryLogRow.organization_id == _as_uuid(organization_id))
    if report_id:
        stmt = stmt.where(DeliveryLogRow.report_id == _as_uuid(report_id))
    stmt = stmt.order_by(DeliveryLogRow.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return [_to_log(row) for row in result.scalars().all()]
