from __future__ import annotations
import json
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pydantic import BaseModel
import httpx
from app.core.config import get_settings


class DeliveryResult(BaseModel):
    success: bool
    error_code: str | None = None
    error_message: str | None = None


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


_log_store: list[DeliveryLog] = []
MAX_RETRIES = 3


async def deliver_report(
    organization_id: str,
    report_id: str | None,
    channel_type: str,
    channel_config: dict,
    content: str,
    subject: str,
    channel_id: str | None = None,
) -> DeliveryLog:
    provider = get_provider(channel_type)
    log = DeliveryLog(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        report_id=report_id,
        channel_id=channel_id,
        channel_type=channel_type,
        status="PENDING",
        attempt_count=0,
        error_code=None,
        error_message=None,
        sent_at=None,
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    for attempt in range(MAX_RETRIES):
        log.attempt_count = attempt + 1
        result = await provider.send(content, subject, channel_config)

        if result.success:
            log.status = "SENT"
            log.sent_at = datetime.now(timezone.utc).isoformat()
            break
        else:
            log.error_code = result.error_code
            log.error_message = result.error_message
            if attempt == MAX_RETRIES - 1:
                log.status = "FAILED"

    _log_store.append(log)
    return log


def get_delivery_logs(organization_id: str, report_id: str | None = None, limit: int = 50) -> list[DeliveryLog]:
    results = [l for l in _log_store if l.organization_id == organization_id]
    if report_id:
        results = [l for l in results if l.report_id == report_id]
    results.sort(key=lambda l: l.created_at, reverse=True)
    return results[:limit]
