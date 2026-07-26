from __future__ import annotations
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.audit import log_event
from app.core.database import get_db
from app.core.security import get_current_user, get_current_org_member, require_role
from app.models.tables import Profile, Organization, OrganizationInvite, OrganizationMember
from app.models.schemas import (
    OrganizationCreateRequest,
    OrganizationResponse,
    OrganizationMemberResponse,
    MemberInviteRequest,
    InviteResponse,
    RoleUpdateRequest,
)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])

# Roles that may only be granted, or altered, by an OWNER. An ADMIN managing
# other admins would let one admin strip another's access, and an ADMIN able to
# grant ADMIN could quietly widen the set of people who can do that.
PRIVILEGED_ROLES = {"OWNER", "ADMIN"}


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


def _require_same_org(member: OrganizationMember, org_id: uuid.UUID) -> None:
    """The org in the path must be the org the caller authenticated against.

    get_current_org_member / require_role authorise against the
    X-Organization-Id header; using the path's id without this check is how the
    members list previously leaked across tenants.
    """
    if member.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Not a member of this organization")


async def _count_owners(db: AsyncSession, org_id: uuid.UUID) -> int:
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.role == "OWNER",
        )
    )
    return len(result.scalars().all())


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
    _require_same_org(member, org_id)

    # Left join so a member who has never logged in still appears, just without
    # a name or address.
    result = await db.execute(
        select(OrganizationMember, Profile)
        .outerjoin(Profile, Profile.user_id == OrganizationMember.user_id)
        .where(OrganizationMember.organization_id == member.organization_id)
        .order_by(OrganizationMember.created_at)
    )
    return [
        OrganizationMemberResponse(
            id=m.id,
            organization_id=m.organization_id,
            user_id=m.user_id,
            role=m.role,
            created_at=m.created_at,
            display_name=profile.display_name if profile else None,
            email=profile.email if profile else None,
        )
        for m, profile in result.all()
    ]


@router.put("/{org_id}/members/{member_id}/role", response_model=OrganizationMemberResponse)
async def update_member_role(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    body: RoleUpdateRequest,
    current_member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    _require_same_org(current_member, org_id)

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.id == member_id,
            OrganizationMember.organization_id == current_member.organization_id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    # Changing your own role is how people accidentally lock themselves out, and
    # it is the obvious self-escalation route for an admin.
    if target.id == current_member.id:
        raise HTTPException(status_code=403, detail="You cannot change your own role")

    if current_member.role != "OWNER" and (
        body.role in PRIVILEGED_ROLES or target.role in PRIVILEGED_ROLES
    ):
        raise HTTPException(
            status_code=403, detail="Only an owner can grant or change owner and admin roles"
        )

    # An organization with no owner cannot be administered by anyone again.
    if target.role == "OWNER" and body.role != "OWNER" and await _count_owners(db, current_member.organization_id) <= 1:
        raise HTTPException(
            status_code=409, detail="Cannot change the role of the only owner. Promote another owner first."
        )

    previous = target.role
    target.role = body.role
    await db.commit()
    await db.refresh(target)

    await log_event(
        db,
        event="member.role_changed",
        actor=current_member.user_id,
        organization_id=str(current_member.organization_id),
        metadata={"member_id": str(target.id), "from": previous, "to": target.role},
    )

    profile = (
        await db.execute(select(Profile).where(Profile.user_id == target.user_id))
    ).scalar_one_or_none()

    return OrganizationMemberResponse(
        id=target.id,
        organization_id=target.organization_id,
        user_id=target.user_id,
        role=target.role,
        created_at=target.created_at,
        display_name=profile.display_name if profile else None,
        email=profile.email if profile else None,
    )


@router.get("/{org_id}/invites", response_model=list[InviteResponse])
async def list_invites(
    org_id: uuid.UUID,
    current_member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    _require_same_org(current_member, org_id)

    result = await db.execute(
        select(OrganizationInvite)
        .where(
            OrganizationInvite.organization_id == current_member.organization_id,
            OrganizationInvite.accepted_at.is_(None),
        )
        .order_by(OrganizationInvite.created_at.desc())
    )
    return [
        InviteResponse(
            id=i.id,
            organization_id=i.organization_id,
            email=i.email,
            role=i.role,
            invited_by=i.invited_by,
            created_at=i.created_at,
        )
        for i in result.scalars().all()
    ]


@router.post("/{org_id}/invites", response_model=InviteResponse)
async def create_invite(
    org_id: uuid.UUID,
    body: MemberInviteRequest,
    current_member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    _require_same_org(current_member, org_id)

    if body.role in PRIVILEGED_ROLES and current_member.role != "OWNER":
        raise HTTPException(status_code=403, detail="Only an owner can invite an admin")

    email = body.email.strip().lower()

    # Someone already in the organization does not need an invite, and saying so
    # is clearer than silently creating one that can never be claimed.
    already_member = await db.execute(
        select(OrganizationMember)
        .join(Profile, Profile.user_id == OrganizationMember.user_id)
        .where(
            OrganizationMember.organization_id == current_member.organization_id,
            Profile.email == email,
        )
    )
    if already_member.scalars().first() is not None:
        raise HTTPException(status_code=409, detail="That person is already a member")

    existing = await db.execute(
        select(OrganizationInvite).where(
            OrganizationInvite.organization_id == current_member.organization_id,
            OrganizationInvite.email == email,
        )
    )
    invite = existing.scalar_one_or_none()

    if invite is not None:
        # Re-inviting updates the pending row (and reopens a claimed one) rather
        # than colliding with the unique constraint.
        invite.role = body.role
        invite.invited_by = current_member.user_id
        invite.accepted_at = None
        invite.accepted_by = None
    else:
        invite = OrganizationInvite(
            organization_id=current_member.organization_id,
            email=email,
            role=body.role,
            invited_by=current_member.user_id,
        )
        db.add(invite)

    await db.commit()
    await db.refresh(invite)

    await log_event(
        db,
        event="member.invited",
        actor=current_member.user_id,
        organization_id=str(current_member.organization_id),
        metadata={"email": email, "role": body.role},
    )

    return InviteResponse(
        id=invite.id,
        organization_id=invite.organization_id,
        email=invite.email,
        role=invite.role,
        invited_by=invite.invited_by,
        created_at=invite.created_at,
    )


@router.delete("/{org_id}/invites/{invite_id}")
async def revoke_invite(
    org_id: uuid.UUID,
    invite_id: uuid.UUID,
    current_member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    _require_same_org(current_member, org_id)

    result = await db.execute(
        select(OrganizationInvite).where(
            OrganizationInvite.id == invite_id,
            OrganizationInvite.organization_id == current_member.organization_id,
        )
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    await db.delete(invite)
    await db.commit()

    await log_event(
        db,
        event="member.invite_revoked",
        actor=current_member.user_id,
        organization_id=str(current_member.organization_id),
        metadata={"email": invite.email},
    )
    return {"revoked": True}


@router.delete("/{org_id}/members/{member_id}")
async def remove_member(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    current_member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    _require_same_org(current_member, org_id)

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.id == member_id,
            OrganizationMember.organization_id == current_member.organization_id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    if target.id == current_member.id:
        raise HTTPException(status_code=403, detail="You cannot remove yourself")

    if current_member.role != "OWNER" and target.role in PRIVILEGED_ROLES:
        raise HTTPException(status_code=403, detail="Only an owner can remove an owner or admin")

    # Removing the last owner would leave the organization unadministrable.
    # Removing one of several is fine.
    if target.role == "OWNER" and await _count_owners(db, current_member.organization_id) <= 1:
        raise HTTPException(
            status_code=409, detail="Cannot remove the only owner. Promote another owner first."
        )

    await db.delete(target)
    await db.commit()

    await log_event(
        db,
        event="member.removed",
        actor=current_member.user_id,
        organization_id=str(current_member.organization_id),
        metadata={"member_id": str(member_id), "role": target.role},
    )
    return {"removed": True}
