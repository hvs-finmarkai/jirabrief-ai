from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    environment: str = "development"


class ProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: str
    display_name: str
    email: str | None = None
    avatar_url: str | None = None
    created_at: datetime


class ProfileCreateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)


class OrganizationCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    created_at: datetime


class OrganizationMemberResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: str
    role: str
    created_at: datetime
    # Filled from the member's profile so the UI can show a person rather than
    # a raw user id. Null until that person has logged in at least once.
    display_name: str | None = None
    email: str | None = None


class MemberInviteRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="MEMBER", pattern="^(ADMIN|MEMBER|VIEWER)$")


class InviteResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    email: str
    role: str
    invited_by: str | None
    created_at: datetime


class RoleUpdateRequest(BaseModel):
    role: str = Field(pattern="^(OWNER|ADMIN|MEMBER|VIEWER)$")
