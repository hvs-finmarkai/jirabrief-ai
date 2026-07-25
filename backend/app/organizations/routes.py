from __future__ import annotations
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user, get_current_org_member, require_role
from app.models.tables import Profile, Organization, OrganizationMember
from app.models.schemas import (
    OrganizationCreateRequest,
    OrganizationResponse,
    OrganizationMemberResponse,
)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


@router.post("", response_model=OrganizationResponse)
async def create_organization(
    body: OrganizationCreateRequest,
    profile: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = Organization(name=body.name, slug=slugify(body.name))
    db.add(org)
    await db.flush()

    member = OrganizationMember(
        organization_id=org.id,
        user_id=profile.user_id,
        role="OWNER",
    )
    db.add(member)
    await db.commit()
    await db.refresh(org)

    return OrganizationResponse(
        id=org.id, name=org.name, slug=org.slug, created_at=org.created_at
    )


@router.get("", response_model=list[OrganizationResponse])
async def list_organizations(
    profile: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .where(OrganizationMember.user_id == profile.user_id)
    )
    orgs = result.scalars().all()
    return [
        OrganizationResponse(id=o.id, name=o.name, slug=o.slug, created_at=o.created_at)
        for o in orgs
    ]


@router.get("/{org_id}/members", response_model=list[OrganizationMemberResponse])
async def list_members(
    org_id: uuid.UUID,
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrganizationMember).where(OrganizationMember.organization_id == org_id)
    )
    members = result.scalars().all()
    return [
        OrganizationMemberResponse(
            id=m.id,
            organization_id=m.organization_id,
            user_id=m.user_id,
            role=m.role,
            created_at=m.created_at,
        )
        for m in members
    ]


@router.delete("/{org_id}/members/{member_id}")
async def remove_member(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    current_member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.id == member_id,
            OrganizationMember.organization_id == org_id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.role == "OWNER":
        raise HTTPException(status_code=403, detail="Cannot remove the organization owner")

    await db.delete(target)
    await db.commit()
    return {"removed": True}
