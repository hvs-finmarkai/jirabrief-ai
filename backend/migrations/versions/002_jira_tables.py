"""jira tables

Revision ID: 002
Revises: 001
Create Date: 2026-07-25
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "jira_connections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("connection_name", sa.String(255), nullable=False),
        sa.Column("jira_site_url", sa.String(500), nullable=False),
        sa.Column("jira_email", sa.String(255), nullable=False),
        sa.Column("encrypted_api_token", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("last_connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_jira_connections_org", "jira_connections", ["organization_id"])

    op.create_table(
        "jira_projects",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jira_connection_id", sa.Uuid(), sa.ForeignKey("jira_connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jira_project_id", sa.String(50), nullable=False),
        sa.Column("project_key", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "jira_project_id", name="uq_org_jira_project"),
    )

    op.create_table(
        "sprints",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jira_project_id", sa.Uuid(), sa.ForeignKey("jira_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jira_sprint_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "jira_sprint_id", name="uq_org_jira_sprint"),
    )

    op.create_table(
        "issues",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jira_project_id", sa.Uuid(), sa.ForeignKey("jira_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sprint_id", sa.Uuid(), sa.ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True),
        sa.Column("jira_issue_id", sa.String(50), nullable=False),
        sa.Column("issue_key", sa.String(30), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("priority", sa.String(30), nullable=False),
        sa.Column("issue_type", sa.String(50), nullable=False),
        sa.Column("assignee_name", sa.String(255), nullable=True),
        sa.Column("reporter_name", sa.String(255), nullable=True),
        sa.Column("labels", sa.Text(), nullable=True),
        sa.Column("blocked_by", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at_jira", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at_jira", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "jira_issue_id", name="uq_org_jira_issue"),
    )
    op.create_index("ix_issues_sprint", "issues", ["sprint_id"])
    op.create_index("ix_issues_project", "issues", ["jira_project_id"])

    op.create_table(
        "issue_comments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("issue_id", sa.Uuid(), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jira_comment_id", sa.String(50), nullable=False),
        sa.Column("author_name", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at_jira", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at_jira", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "jira_comment_id", name="uq_org_jira_comment"),
    )

    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jira_connection_id", sa.Uuid(), sa.ForeignKey("jira_connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="STARTED"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("issues_created", sa.Integer(), server_default="0", nullable=False),
        sa.Column("issues_updated", sa.Integer(), server_default="0", nullable=False),
        sa.Column("comments_synced", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sync_runs_org", "sync_runs", ["organization_id"])


def downgrade() -> None:
    op.drop_table("sync_runs")
    op.drop_table("issue_comments")
    op.drop_table("issues")
    op.drop_table("sprints")
    op.drop_table("jira_projects")
    op.drop_table("jira_connections")
