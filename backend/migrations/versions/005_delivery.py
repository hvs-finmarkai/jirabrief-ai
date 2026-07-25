"""delivery channels and logs

Revision ID: 005
Revises: 004
Create Date: 2026-07-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "delivery_channels",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel_type", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("config", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_test_status", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_delivery_channels_org", "delivery_channels", ["organization_id"])

    op.create_table(
        "delivery_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_id", sa.Uuid(), nullable=True),
        sa.Column("channel_id", sa.Uuid(), sa.ForeignKey("delivery_channels.id", ondelete="SET NULL"), nullable=True),
        sa.Column("channel_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_code", sa.String(50), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_delivery_logs_org", "delivery_logs", ["organization_id"])
    op.create_index("ix_delivery_logs_report", "delivery_logs", ["report_id"])


def downgrade() -> None:
    op.drop_table("delivery_logs")
    op.drop_table("delivery_channels")
