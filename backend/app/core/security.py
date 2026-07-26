from __future__ import annotations
from datetime import datetime, timezone
from typing import Annotated
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tables import Profile, OrganizationInvite, OrganizationMember


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> Profile:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.split(" ", 1)[1]
    settings = get_settings()

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user_meta = payload.get("user_metadata", {}) or {}
    email = _normalize_email(payload.get("email"))

    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()

    if not profile:
        display_name = user_meta.get("display_name") or user_meta.get("full_name") or payload.get("email", "User")
        avatar_url = user_meta.get("avatar_url")

        profile = Profile(user_id=user_id, display_name=display_name, avatar_url=avatar_url, email=email)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    elif email and profile.email != email:
        # Backfills rows created before profiles stored an address, and keeps up
        # with a changed one.
        profile.email = email
        await db.commit()

    if email and _email_is_verified(payload, user_meta):
        await _accept_pending_invites(db, user_id=user_id, email=email)

    return profile


def _normalize_email(value: str | None) -> str | None:
    return value.strip().lower() if value else None


def _email_is_verified(payload: dict, user_meta: dict) -> bool:
    """Pending invites are matched on email address, so an unverified address
    would let someone claim an invite meant for a mailbox they don't own. Treat
    the address as verified unless a claim explicitly says otherwise - some
    providers omit the claim entirely."""
    for source in (payload, user_meta, payload.get("app_metadata") or {}):
        if source.get("email_verified") is False:
            return False
    return True


async def _accept_pending_invites(db: AsyncSession, user_id: str, email: str) -> None:
    result = await db.execute(
        select(OrganizationInvite).where(
            OrganizationInvite.email == email,
            OrganizationInvite.accepted_at.is_(None),
        )
    )
    invites = result.scalars().all()
    if not invites:
        return

    for invite in invites:
        existing = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == invite.organization_id,
                OrganizationMember.user_id == user_id,
            )
        )
        # Already a member (invited twice, or added directly) - close the invite
        # without touching the role they already hold.
        if existing.scalar_one_or_none() is None:
            db.add(
                OrganizationMember(
                    organization_id=invite.organization_id,
                    user_id=user_id,
                    role=invite.role,
                )
            )

        invite.accepted_at = datetime.now(timezone.utc)
        invite.accepted_by = user_id

    await db.commit()


async def get_current_org_member(
    request: Request,
    profile: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OrganizationMember:
    org_id = request.headers.get("X-Organization-Id")
    if not org_id:
        raise HTTPException(status_code=400, detail="X-Organization-Id header is required")

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.user_id == profile.user_id,
            OrganizationMember.organization_id == org_id,
        )
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    return member


def require_role(*allowed_roles: str):
    async def role_checker(member: OrganizationMember = Depends(get_current_org_member)):
        if member.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return member
    return role_checker


CurrentUser = Annotated[Profile, Depends(get_current_user)]
CurrentMember = Annotated[OrganizationMember, Depends(get_current_org_member)]
