from __future__ import annotations
from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.models.tables import Profile
from app.models.schemas import ProfileResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=ProfileResponse)
async def get_me(profile: Profile = Depends(get_current_user)):
    return ProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        display_name=profile.display_name,
        email=profile.email,
        avatar_url=profile.avatar_url,
        created_at=profile.created_at,
    )
