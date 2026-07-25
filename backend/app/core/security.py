from __future__ import annotations
from typing import Annotated
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tables import Profile, OrganizationMember


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

    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()

    if not profile:
        user_meta = payload.get("user_metadata", {})
        display_name = user_meta.get("display_name") or user_meta.get("full_name") or payload.get("email", "User")
        avatar_url = user_meta.get("avatar_url")

        profile = Profile(user_id=user_id, display_name=display_name, avatar_url=avatar_url)
        db.add(profile)
        await db.flush()

        demo_org_id = "00000000-0000-0000-0000-000000000001"
        existing_membership = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.organization_id == demo_org_id,
            )
        )
        if not existing_membership.scalar_one_or_none():
            any_member = await db.execute(
                select(OrganizationMember).where(OrganizationMember.organization_id == demo_org_id).limit(1)
            )
            is_first_user = any_member.scalar_one_or_none() is None
            role = "OWNER" if is_first_user else "MEMBER"

            member = OrganizationMember(
                organization_id=demo_org_id,
                user_id=user_id,
                role=role,
            )
            db.add(member)

            if not is_first_user:
                from app.admin.users import add_pending_user
                email = payload.get("email", "unknown")
                add_pending_user(email=email, display_name=display_name)

        await db.commit()
        await db.refresh(profile)

    return profile


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
