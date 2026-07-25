"""Guards against a class of bug that import checks cannot catch.

SQLAlchemy configures mappers lazily, on the first ORM query. A malformed
relationship therefore imports perfectly cleanly and only explodes at runtime -
and because it fires on *any* query, it takes down every authenticated route at
once. `Profile.memberships` shipped in exactly that state.
"""
from __future__ import annotations
from sqlalchemy.orm import configure_mappers
from app.core.database import Base
import app.models.tables as tables


def test_all_mappers_configure():
    # Raises NoForeignKeysError / InvalidRequestError if any relationship on any
    # model is under-specified.
    configure_mappers()


def test_every_migrated_table_has_a_model():
    """The migrations create 17 tables. If a model is missing, that table's data
    silently has no way to be read or written - which is how this codebase ended
    up storing production data in Python dicts."""
    expected = {
        "profiles",
        "organizations",
        "organization_members",
        "jira_connections",
        "jira_projects",
        "sprints",
        "issues",
        "issue_comments",
        "sync_runs",
        "report_templates",
        "reports",
        "report_sources",
        "report_schedules",
        "notification_events",
        "delivery_channels",
        "delivery_logs",
        "audit_logs",
    }
    assert expected.issubset(set(Base.metadata.tables))


def test_reserved_metadata_column_is_remapped():
    """`metadata` is reserved on declarative classes, so the attribute is renamed
    while the column keeps its real name. Getting this wrong fails at import."""
    for model in (tables.AuditLog, tables.NotificationEvent):
        assert model.event_metadata.property.columns[0].name == "metadata"
        assert not hasattr(model, "metadata_")
