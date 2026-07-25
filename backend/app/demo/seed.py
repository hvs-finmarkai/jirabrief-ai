"""Demo mode stores its reports in the same tables as everything else, which
means the demo organization has to exist as a real row - `reports.organization_id`
is a foreign key. Seeded idempotently at startup so demo mode works on a fresh
database with no setup.
"""
from __future__ import annotations
import logging
import uuid
from sqlalchemy import select
from app.core.database import async_session
from app.demo.data import DEMO_ORG_ID, DEMO_ORG_NAME
from app.models.tables import Organization

logger = logging.getLogger(__name__)


async def ensure_demo_organization() -> None:
    org_id = uuid.UUID(DEMO_ORG_ID)
    async with async_session() as db:
        existing = await db.execute(select(Organization).where(Organization.id == org_id))
        if existing.scalar_one_or_none() is not None:
            return

        db.add(Organization(id=org_id, name=DEMO_ORG_NAME, slug="demo-workspace"))
        await db.commit()
        logger.info("Seeded demo organization %s", DEMO_ORG_ID)
