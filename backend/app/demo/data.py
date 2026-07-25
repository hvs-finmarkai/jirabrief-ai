from __future__ import annotations
from datetime import date, datetime, timedelta

DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"
DEMO_ORG_NAME = "Acme Digital"
DEMO_ORG_SLUG = "acme-digital-demo"

DEMO_PROJECTS = [
    {"id": "p1", "key": "CRM", "name": "CRM Migration", "jira_project_id": "10001"},
    {"id": "p2", "key": "PORTAL", "name": "Customer Portal", "jira_project_id": "10002"},
    {"id": "p3", "key": "MOBILE", "name": "Mobile Application", "jira_project_id": "10003"},
]

today = date.today()
sprint_start = today - timedelta(days=10)
sprint_end = today + timedelta(days=4)

DEMO_SPRINTS = {
    "CRM": [
        {
            "id": "s1",
            "jira_sprint_id": 101,
            "name": "Sprint 24 - Data Migration",
            "state": "active",
            "start_date": sprint_start.isoformat(),
            "end_date": sprint_end.isoformat(),
        },
        {
            "id": "s2",
            "jira_sprint_id": 100,
            "name": "Sprint 23 - API Integration",
            "state": "closed",
            "start_date": (sprint_start - timedelta(days=14)).isoformat(),
            "end_date": (sprint_start - timedelta(days=1)).isoformat(),
        },
    ],
    "PORTAL": [
        {
            "id": "s3",
            "jira_sprint_id": 201,
            "name": "Sprint 12 - User Dashboard",
            "state": "active",
            "start_date": sprint_start.isoformat(),
            "end_date": sprint_end.isoformat(),
        },
    ],
    "MOBILE": [
        {
            "id": "s4",
            "jira_sprint_id": 301,
            "name": "Sprint 8 - Push Notifications",
            "state": "active",
            "start_date": sprint_start.isoformat(),
            "end_date": sprint_end.isoformat(),
        },
    ],
}

DEMO_ISSUES = {
    "s1": [
        {
            "key": "CRM-142",
            "summary": "Migrate customer contact records to new schema",
            "status": "Done",
            "priority": "High",
            "assignee": "Sarah Chen",
            "issue_type": "Story",
            "labels": ["migration", "data"],
            "created": (sprint_start).isoformat(),
            "updated": (today - timedelta(days=2)).isoformat(),
            "resolved_at": (today - timedelta(days=2)).isoformat(),
            "comments": [
                {"author": "Sarah Chen", "body": "Migration script completed. 45,000 records migrated with zero data loss.", "created": (today - timedelta(days=2)).isoformat()},
                {"author": "David Park", "body": "Validation passed. All foreign key relationships intact.", "created": (today - timedelta(days=2)).isoformat()},
            ],
        },
        {
            "key": "CRM-143",
            "summary": "Build ETL pipeline for opportunity data",
            "status": "Done",
            "priority": "High",
            "assignee": "David Park",
            "issue_type": "Story",
            "labels": ["migration", "etl"],
            "created": sprint_start.isoformat(),
            "updated": (today - timedelta(days=3)).isoformat(),
            "resolved_at": (today - timedelta(days=3)).isoformat(),
            "comments": [
                {"author": "David Park", "body": "ETL pipeline handles incremental updates. Backfill complete.", "created": (today - timedelta(days=3)).isoformat()},
            ],
        },
        {
            "key": "CRM-144",
            "summary": "Implement field mapping for custom properties",
            "status": "Done",
            "priority": "Medium",
            "assignee": "Alex Rivera",
            "issue_type": "Task",
            "labels": ["migration"],
            "created": sprint_start.isoformat(),
            "updated": (today - timedelta(days=4)).isoformat(),
            "resolved_at": (today - timedelta(days=4)).isoformat(),
            "comments": [],
        },
        {
            "key": "CRM-145",
            "summary": "Data validation framework for migrated records",
            "status": "Done",
            "priority": "Medium",
            "assignee": "Sarah Chen",
            "issue_type": "Task",
            "labels": ["migration", "quality"],
            "created": sprint_start.isoformat(),
            "updated": (today - timedelta(days=1)).isoformat(),
            "resolved_at": (today - timedelta(days=1)).isoformat(),
            "comments": [],
        },
        {
            "key": "CRM-146",
            "summary": "Fix duplicate detection in contact merge logic",
            "status": "Done",
            "priority": "Critical",
            "assignee": "Alex Rivera",
            "issue_type": "Bug",
            "labels": ["migration", "bugfix"],
            "created": (sprint_start + timedelta(days=2)).isoformat(),
            "updated": (today - timedelta(days=1)).isoformat(),
            "resolved_at": (today - timedelta(days=1)).isoformat(),
            "comments": [
                {"author": "Alex Rivera", "body": "Root cause was case-sensitive email matching. Now normalized before comparison.", "created": (today - timedelta(days=1)).isoformat()},
            ],
        },
        {
            "key": "CRM-147",
            "summary": "Migrate activity history and interaction logs",
            "status": "In Progress",
            "priority": "High",
            "assignee": "David Park",
            "issue_type": "Story",
            "labels": ["migration", "data"],
            "created": sprint_start.isoformat(),
            "updated": today.isoformat(),
            "comments": [
                {"author": "David Park", "body": "70% complete. Handling timezone conversion for historical timestamps.", "created": today.isoformat()},
            ],
        },
        {
            "key": "CRM-148",
            "summary": "Implement rollback mechanism for failed migrations",
            "status": "In Progress",
            "priority": "High",
            "assignee": "Sarah Chen",
            "issue_type": "Story",
            "labels": ["migration", "reliability"],
            "created": (sprint_start + timedelta(days=1)).isoformat(),
            "updated": today.isoformat(),
            "comments": [
                {"author": "Sarah Chen", "body": "Checkpoint-based rollback working for single-table migrations. Multi-table transactions next.", "created": today.isoformat()},
            ],
        },
        {
            "key": "CRM-149",
            "summary": "Performance optimization for bulk insert operations",
            "status": "In Progress",
            "priority": "Medium",
            "assignee": "Alex Rivera",
            "issue_type": "Task",
            "labels": ["performance", "migration"],
            "created": (sprint_start + timedelta(days=3)).isoformat(),
            "updated": today.isoformat(),
            "comments": [],
        },
        {
            "key": "CRM-150",
            "summary": "Legacy API integration blocked by vendor authentication change",
            "status": "Blocked",
            "priority": "Critical",
            "assignee": "David Park",
            "issue_type": "Story",
            "labels": ["migration", "blocked", "external"],
            "created": (sprint_start + timedelta(days=2)).isoformat(),
            "updated": (today - timedelta(days=1)).isoformat(),
            "blocked_by": "Vendor (Salesforce) changed OAuth flow. Awaiting new API credentials from their team.",
            "comments": [
                {"author": "David Park", "body": "Salesforce changed their OAuth flow without notice. New credentials requested.", "created": (today - timedelta(days=3)).isoformat()},
                {"author": "Sarah Chen", "body": "Escalated to account manager. Expected resolution: 2 business days.", "created": (today - timedelta(days=1)).isoformat()},
            ],
        },
        {
            "key": "CRM-151",
            "summary": "Database connection pool exhaustion during bulk migration",
            "status": "Blocked",
            "priority": "High",
            "assignee": "Alex Rivera",
            "issue_type": "Bug",
            "labels": ["infrastructure", "blocked"],
            "created": (today - timedelta(days=2)).isoformat(),
            "updated": today.isoformat(),
            "blocked_by": "Requires infrastructure team to increase connection pool limits on production DB.",
            "comments": [
                {"author": "Alex Rivera", "body": "Pool maxes out at 50 connections during peak migration. Need infrastructure change.", "created": today.isoformat()},
            ],
        },
        {
            "key": "CRM-152",
            "summary": "Migrate email template configurations",
            "status": "To Do",
            "priority": "Medium",
            "assignee": "Maria Lopez",
            "issue_type": "Task",
            "labels": ["migration"],
            "created": (sprint_start + timedelta(days=4)).isoformat(),
            "updated": (sprint_start + timedelta(days=4)).isoformat(),
            "comments": [],
        },
        {
            "key": "CRM-153",
            "summary": "Write runbook for production migration execution",
            "status": "To Do",
            "priority": "Low",
            "assignee": None,
            "issue_type": "Task",
            "labels": ["documentation"],
            "created": (sprint_start + timedelta(days=5)).isoformat(),
            "updated": (sprint_start + timedelta(days=5)).isoformat(),
            "comments": [],
        },
        {
            "key": "CRM-154",
            "summary": "Audit trail implementation for data compliance",
            "status": "To Do",
            "priority": "High",
            "assignee": None,
            "issue_type": "Story",
            "labels": ["compliance", "high-priority"],
            "created": (sprint_start + timedelta(days=3)).isoformat(),
            "updated": (sprint_start + timedelta(days=3)).isoformat(),
            "due_date": (today - timedelta(days=1)).isoformat(),
            "comments": [],
        },
        {
            "key": "CRM-155",
            "summary": "Improve error reporting in migration dashboard",
            "status": "Done",
            "priority": "Low",
            "assignee": "Maria Lopez",
            "issue_type": "Improvement",
            "labels": ["ux"],
            "created": (sprint_start + timedelta(days=2)).isoformat(),
            "updated": (today - timedelta(days=3)).isoformat(),
            "resolved_at": (today - timedelta(days=3)).isoformat(),
            "comments": [],
        },
    ],
    "s3": [
        {
            "key": "PORTAL-45",
            "summary": "Implement user dashboard with account overview",
            "status": "Done",
            "priority": "High",
            "assignee": "Lisa Wang",
            "issue_type": "Story",
            "labels": ["dashboard", "feature"],
            "created": sprint_start.isoformat(),
            "updated": (today - timedelta(days=2)).isoformat(),
            "resolved_at": (today - timedelta(days=2)).isoformat(),
            "comments": [],
        },
        {
            "key": "PORTAL-46",
            "summary": "Build notification center with real-time updates",
            "status": "In Progress",
            "priority": "Medium",
            "assignee": "Lisa Wang",
            "issue_type": "Story",
            "labels": ["notifications"],
            "created": sprint_start.isoformat(),
            "updated": today.isoformat(),
            "comments": [
                {"author": "Lisa Wang", "body": "WebSocket connection established. Working on notification grouping.", "created": today.isoformat()},
            ],
        },
        {
            "key": "PORTAL-47",
            "summary": "Add two-factor authentication to portal login",
            "status": "To Do",
            "priority": "High",
            "assignee": "Marcus Johnson",
            "issue_type": "Story",
            "labels": ["security"],
            "created": (sprint_start + timedelta(days=2)).isoformat(),
            "updated": (sprint_start + timedelta(days=2)).isoformat(),
            "comments": [],
        },
    ],
    "s4": [
        {
            "key": "MOBILE-89",
            "summary": "Implement push notification service with FCM and APNs",
            "status": "In Progress",
            "priority": "High",
            "assignee": "Marcus Johnson",
            "issue_type": "Story",
            "labels": ["notifications", "feature"],
            "created": sprint_start.isoformat(),
            "updated": today.isoformat(),
            "comments": [
                {"author": "Marcus Johnson", "body": "FCM integration complete. APNs certificate configuration in progress.", "created": today.isoformat()},
            ],
        },
        {
            "key": "MOBILE-90",
            "summary": "Design notification preferences screen",
            "status": "Done",
            "priority": "Medium",
            "assignee": "Lisa Wang",
            "issue_type": "Task",
            "labels": ["design", "notifications"],
            "created": sprint_start.isoformat(),
            "updated": (today - timedelta(days=4)).isoformat(),
            "resolved_at": (today - timedelta(days=4)).isoformat(),
            "comments": [],
        },
        {
            "key": "MOBILE-91",
            "summary": "Notification batching and quiet hours logic",
            "status": "To Do",
            "priority": "Medium",
            "assignee": "Marcus Johnson",
            "issue_type": "Story",
            "labels": ["notifications"],
            "created": (sprint_start + timedelta(days=3)).isoformat(),
            "updated": (sprint_start + timedelta(days=3)).isoformat(),
            "comments": [],
        },
    ],
}


def get_demo_projects():
    return DEMO_PROJECTS


def get_demo_sprints(project_key: str):
    return DEMO_SPRINTS.get(project_key, [])


def get_demo_issues(sprint_id: str):
    return DEMO_ISSUES.get(sprint_id, [])
