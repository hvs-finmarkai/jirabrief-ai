"""one jira connection per organization

The app treats a Jira connection as one-per-org (connect replaces, disconnect
removes), but nothing at the database level enforced it. Two concurrent
/api/jira/connect calls could insert two rows for the same org, after which
every Jira route for that org reads an arbitrary one of them.

Revision ID: 007
Revises: 006
Create Date: 2026-07-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Collapse any pre-existing duplicates to the newest row per org, otherwise
    # the constraint cannot be created.
    op.execute(
        """
        DELETE FROM jira_connections a
        USING jira_connections b
        WHERE a.organization_id = b.organization_id
          AND a.created_at < b.created_at
        """
    )
    op.create_unique_constraint(
        "uq_jira_connection_org", "jira_connections", ["organization_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_jira_connection_org", "jira_connections", type_="unique")
