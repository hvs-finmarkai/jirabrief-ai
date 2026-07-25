"""reports and templates

Revision ID: 003
Revises: 002
Create Date: 2026-07-25
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("report_type", sa.String(30), nullable=False),
        sa.Column("tone", sa.String(20), server_default="concise", nullable=False),
        sa.Column("length", sa.String(20), server_default="standard", nullable=False),
        sa.Column("enabled_sections", sa.Text(), nullable=True),
        sa.Column("additional_instructions", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_key", sa.String(20), nullable=False),
        sa.Column("project_name", sa.String(255), nullable=False),
        sa.Column("sprint_name", sa.String(255), nullable=True),
        sa.Column("sprint_id", sa.String(50), nullable=True),
        sa.Column("template_id", sa.Uuid(), sa.ForeignKey("report_templates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("report_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), server_default="DRAFT", nullable=False),
        sa.Column("approval_status", sa.String(20), server_default="DRAFT", nullable=False),
        sa.Column("overall_status", sa.Text(), nullable=True),
        sa.Column("generated_content", sa.Text(), nullable=False),
        sa.Column("edited_content", sa.Text(), nullable=True),
        sa.Column("ai_provider", sa.String(50), nullable=False),
        sa.Column("ai_model", sa.String(100), nullable=False),
        sa.Column("quality_status", sa.String(30), nullable=True),
        sa.Column("quality_details", sa.Text(), nullable=True),
        sa.Column("custom_instructions", sa.Text(), nullable=True),
        sa.Column("generated_by", sa.String(255), nullable=True),
        sa.Column("approved_by", sa.String(255), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_org", "reports", ["organization_id"])
    op.create_index("ix_reports_project", "reports", ["project_key"])
    op.create_index("ix_reports_type", "reports", ["report_type"])
    op.create_index("ix_reports_status", "reports", ["approval_status"])

    op.create_table(
        "report_sources",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("report_id", sa.Uuid(), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("issue_key", sa.String(30), nullable=False),
        sa.Column("issue_summary", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_sources_report", "report_sources", ["report_id"])


def downgrade() -> None:
    op.drop_table("report_sources")
    op.drop_table("reports")
    op.drop_table("report_templates")
