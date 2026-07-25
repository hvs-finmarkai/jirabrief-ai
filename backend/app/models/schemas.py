from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    environment: str = "development"


class ProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: str
    display_name: str
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


class MemberInviteRequest(BaseModel):
    email: str
    role: str = Field(default="MEMBER", pattern="^(ADMIN|MEMBER|VIEWER)$")


class RoleUpdateRequest(BaseModel):
    role: str = Field(pattern="^(OWNER|ADMIN|MEMBER|VIEWER)$")
