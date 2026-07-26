from __future__ import annotations
import uuid
from datetime import date, datetime
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

# Index names below are declared explicitly so they match the names the Alembic
# migrations created. Relying on `index=True` would make SQLAlchemy invent its
# own names, and every future `alembic revision --autogenerate` would emit a
# spurious drop/create-index migration.


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (
        UniqueConstraint("user_id"),
        Index("ix_profiles_user_id", "user_id"),
        Index("ix_profiles_email", "email"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String)
    # Captured from the Supabase JWT on login. Nullable because rows created
    # before this column existed have no address until their owner next logs in.
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # profiles.user_id and organization_members.user_id hold the same Supabase
    # user id but have no FK between them, so both sides of this relationship
    # must spell out the join. Without it SQLAlchemy raises NoForeignKeysError
    # on the first ORM query of any kind, which takes down every authenticated
    # route. viewonly because the link is by value, not by a real foreign key.
    memberships: Mapped[list[OrganizationMember]] = relationship(
        back_populates="profile",
        primaryjoin="Profile.user_id == OrganizationMember.user_id",
        foreign_keys="OrganizationMember.user_id",
        viewonly=True,
    )


class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = (
        UniqueConstraint("slug"),
        Index("ix_organizations_slug", "slug"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members: Mapped[list[OrganizationMember]] = relationship(back_populates="organization")


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    role: Mapped[str] = mapped_column(String(20), default="MEMBER")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped[Organization] = relationship(back_populates="members")
    profile: Mapped[Profile] = relationship(
        back_populates="memberships",
        foreign_keys=[user_id],
        primaryjoin="OrganizationMember.user_id == Profile.user_id",
        viewonly=True,
    )


class OrganizationInvite(Base):
    __tablename__ = "organization_invites"
    __table_args__ = (
        UniqueConstraint("organization_id", "email", name="uq_org_invite_email"),
        Index("ix_org_invites_org", "organization_id"),
        Index("ix_org_invites_email", "email"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    email: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), server_default="MEMBER")
    invited_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


def _created() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


def _updated() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


def _org_fk() -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))


class JiraConnection(Base):
    __tablename__ = "jira_connections"
    __table_args__ = (
        UniqueConstraint("organization_id", name="uq_jira_connection_org"),
        Index("ix_jira_connections_org", "organization_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    connection_name: Mapped[str] = mapped_column(String(255))
    jira_site_url: Mapped[str] = mapped_column(String(500))
    jira_email: Mapped[str] = mapped_column(String(255))
    encrypted_api_token: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default="active")
    last_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()


class JiraProject(Base):
    __tablename__ = "jira_projects"
    __table_args__ = (
        UniqueConstraint("organization_id", "jira_project_id", name="uq_org_jira_project"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    jira_connection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jira_connections.id", ondelete="CASCADE"))
    jira_project_id: Mapped[str] = mapped_column(String(50))
    project_key: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(255))
    enabled: Mapped[bool] = mapped_column(Boolean, server_default="true")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()


class Sprint(Base):
    __tablename__ = "sprints"
    __table_args__ = (
        UniqueConstraint("organization_id", "jira_sprint_id", name="uq_org_jira_sprint"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    jira_project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jira_projects.id", ondelete="CASCADE"))
    jira_sprint_id: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(255))
    state: Mapped[str] = mapped_column(String(20))
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()


class Issue(Base):
    __tablename__ = "issues"
    __table_args__ = (
        UniqueConstraint("organization_id", "jira_issue_id", name="uq_org_jira_issue"),
        Index("ix_issues_sprint", "sprint_id"),
        Index("ix_issues_project", "jira_project_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    jira_project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jira_projects.id", ondelete="CASCADE"))
    sprint_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True)
    jira_issue_id: Mapped[str] = mapped_column(String(50))
    issue_key: Mapped[str] = mapped_column(String(30))
    summary: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50))
    priority: Mapped[str] = mapped_column(String(30))
    issue_type: Mapped[str] = mapped_column(String(50))
    assignee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reporter_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    labels: Mapped[str | None] = mapped_column(Text, nullable=True)
    blocked_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at_jira: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at_jira: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()


class IssueComment(Base):
    __tablename__ = "issue_comments"
    __table_args__ = (
        UniqueConstraint("organization_id", "jira_comment_id", name="uq_org_jira_comment"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    issue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"))
    jira_comment_id: Mapped[str] = mapped_column(String(50))
    author_name: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    created_at_jira: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at_jira: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = _created()


class SyncRun(Base):
    __tablename__ = "sync_runs"
    __table_args__ = (Index("ix_sync_runs_org", "organization_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    jira_connection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jira_connections.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), server_default="STARTED")
    started_at: Mapped[datetime] = _created()
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    issues_created: Mapped[int] = mapped_column(Integer, server_default="0")
    issues_updated: Mapped[int] = mapped_column(Integer, server_default="0")
    comments_synced: Mapped[int] = mapped_column(Integer, server_default="0")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class ReportTemplateRow(Base):
    __tablename__ = "report_templates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255))
    report_type: Mapped[str] = mapped_column(String(30))
    tone: Mapped[str] = mapped_column(String(20), server_default="concise")
    length: Mapped[str] = mapped_column(String(20), server_default="standard")
    enabled_sections: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        Index("ix_reports_org", "organization_id"),
        Index("ix_reports_project", "project_key"),
        Index("ix_reports_type", "report_type"),
        Index("ix_reports_status", "approval_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    project_key: Mapped[str] = mapped_column(String(20))
    project_name: Mapped[str] = mapped_column(String(255))
    sprint_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sprint_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("report_templates.id", ondelete="SET NULL"), nullable=True
    )
    report_type: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), server_default="DRAFT")
    approval_status: Mapped[str] = mapped_column(String(20), server_default="DRAFT")
    overall_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_content: Mapped[str] = mapped_column(Text)
    edited_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_provider: Mapped[str] = mapped_column(String(50))
    ai_model: Mapped[str] = mapped_column(String(100))
    quality_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    quality_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generated_at: Mapped[datetime] = _created()
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()

    sources: Mapped[list[ReportSource]] = relationship(
        back_populates="report", cascade="all, delete-orphan", lazy="selectin"
    )


class ReportSource(Base):
    __tablename__ = "report_sources"
    __table_args__ = (Index("ix_report_sources_report", "report_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"))
    issue_key: Mapped[str] = mapped_column(String(30))
    issue_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    report: Mapped[Report] = relationship(back_populates="sources")


class ReportSchedule(Base):
    __tablename__ = "report_schedules"
    __table_args__ = (
        Index("ix_schedules_org", "organization_id"),
        Index("ix_schedules_next_run", "next_run_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    project_key: Mapped[str] = mapped_column(String(20))
    project_name: Mapped[str] = mapped_column(String(255))
    sprint_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    report_type: Mapped[str] = mapped_column(String(30))
    template_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    frequency: Mapped[str] = mapped_column(String(20))
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_of_day: Mapped[str] = mapped_column(String(5))
    timezone: Mapped[str] = mapped_column(String(50), server_default="UTC")
    require_approval: Mapped[bool] = mapped_column(Boolean, server_default="false")
    enabled: Mapped[bool] = mapped_column(Boolean, server_default="true")
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    failure_count: Mapped[int] = mapped_column(Integer, server_default="0")
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()


class NotificationEvent(Base):
    __tablename__ = "notification_events"
    __table_args__ = (
        Index("ix_notifications_user", "user_id"),
        Index("ix_notifications_org", "organization_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    user_id: Mapped[str] = mapped_column(String)
    event_type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, server_default="false")
    # "metadata" is reserved on SQLAlchemy declarative classes, so the attribute
    # is renamed while the underlying column keeps its real name.
    event_metadata: Mapped[str | None] = mapped_column("metadata", Text, nullable=True)
    created_at: Mapped[datetime] = _created()


class DeliveryChannel(Base):
    __tablename__ = "delivery_channels"
    __table_args__ = (Index("ix_delivery_channels_org", "organization_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    channel_type: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(255))
    config: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, server_default="true")
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_test_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()


class DeliveryLog(Base):
    __tablename__ = "delivery_logs"
    __table_args__ = (
        Index("ix_delivery_logs_org", "organization_id"),
        Index("ix_delivery_logs_report", "report_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_fk()
    report_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("delivery_channels.id", ondelete="SET NULL"), nullable=True
    )
    channel_type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), server_default="PENDING")
    attempt_count: Mapped[int] = mapped_column(Integer, server_default="0")
    error_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = _created()


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_org", "organization_id"),
        Index("ix_audit_logs_event", "event"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    actor: Mapped[str] = mapped_column(String(255))
    event: Mapped[str] = mapped_column(String(100))
    # See NotificationEvent.event_metadata for why this is renamed.
    event_metadata: Mapped[str | None] = mapped_column("metadata", Text, nullable=True)
    created_at: Mapped[datetime] = _created()
