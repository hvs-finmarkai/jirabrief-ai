"""organization invites, and an email on profiles

Two related additions:

* `profiles.email` - the address is already in the Supabase JWT but was never
  stored, so the members list could only ever show raw user ids. It is also what
  a pending invite is matched against when someone logs in.
* `organization_invites` - an admin records an address and a role; the person is
  added to the organization the next time they log in with that address.

Revision ID: 008
Revises: 007
Create Date: 2026-07-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("email", sa.String(255), nullable=True))
    op.create_index("ix_profiles_email", "profiles", ["email"])

    op.create_table(
        "organization_invites",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="MEMBER"),
        sa.Column("invited_by", sa.String(255), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        # One live invite per address per org. Re-inviting updates the existing
        # row rather than stacking duplicates that would each be claimed.
        sa.UniqueConstraint("organization_id", "email", name="uq_org_invite_email"),
    )
    op.create_index("ix_org_invites_org", "organization_invites", ["organization_id"])
    # Login looks up pending invites by address, so this is the hot path.
    op.create_index("ix_org_invites_email", "organization_invites", ["email"])


def downgrade() -> None:
    op.drop_table("organization_invites")
    op.drop_index("ix_profiles_email", table_name="profiles")
    op.drop_column("profiles", "email")
