from __future__ import annotations
import asyncio
from datetime import datetime
import httpx


class JiraClientError(Exception):
    def __init__(self, message: str, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code


class JiraClient:
    def __init__(self, base_url: str, email: str, api_token: str):
        self._base_url = base_url.rstrip("/")
        self._auth = (email, api_token)
        self._max_retries = 3

    async def verify(self) -> dict:
        data = await self._get("/rest/api/2/myself")
        return data

    async def get_projects(self) -> list[dict]:
        data = await self._get("/rest/api/2/project", params={"recent": 50})
        return [
            {
                "id": p["id"],
                "key": p["key"],
                "name": p["name"],
                "lead": p.get("lead", {}).get("displayName", ""),
            }
            for p in data
        ]

    async def get_sprints(self, project_key: str) -> list[dict]:
        board_id = await self._find_board(project_key)
        if not board_id:
            return []

        sprints: list[dict] = []
        start_at = 0
        while True:
            data = await self._get(
                f"/rest/agile/1.0/board/{board_id}/sprint",
                params={"startAt": start_at, "maxResults": 50, "state": "active,closed,future"},
            )
            for s in data.get("values", []):
                sprints.append({
                    "id": s["id"],
                    "name": s["name"],
                    "state": s["state"],
                    "start_date": s.get("startDate"),
                    "end_date": s.get("endDate"),
                })
            if data.get("isLast", True):
                break
            start_at += len(data.get("values", []))

        return sorted(sprints, key=lambda s: s["id"], reverse=True)[:20]

    async def get_issues(self, project_key: str, sprint_id: int | None = None, updated_since: str | None = None) -> list[dict]:
        jql_parts = [f"project = {project_key}"]
        if sprint_id:
            jql_parts.append(f"sprint = {sprint_id}")
        if updated_since:
            jql_parts.append(f'updated >= "{updated_since}"')

        jql = " AND ".join(jql_parts) + " ORDER BY updated DESC"
        fields = "summary,status,priority,assignee,issuetype,created,updated,labels,comment,duedate,resolution,resolutiondate,reporter"

        issues: list[dict] = []
        start_at = 0
        while True:
            data = await self._get(
                "/rest/api/2/search",
                params={"jql": jql, "startAt": start_at, "maxResults": 100, "fields": fields},
            )
            for raw in data.get("issues", []):
                issues.append(self._normalize_issue(raw))
            total = data.get("total", 0)
            start_at += len(data.get("issues", []))
            if start_at >= total:
                break

        return issues

    def _normalize_issue(self, raw: dict) -> dict:
        f = raw.get("fields", {})
        comments = []
        comment_data = f.get("comment", {})
        if isinstance(comment_data, dict):
            for c in comment_data.get("comments", [])[-5:]:
                comments.append({
                    "id": c.get("id", ""),
                    "author": c.get("author", {}).get("displayName", "Unknown"),
                    "body": c.get("body", "")[:1000],
                    "created": c.get("created", ""),
                    "updated": c.get("updated"),
                })

        labels = f.get("labels", [])
        blocked_by = None
        if any(l.lower() in ("blocked", "impediment") for l in labels):
            blocked_by = "See comments for blocker details"

        return {
            "jira_issue_id": raw["id"],
            "key": raw["key"],
            "summary": f.get("summary", ""),
            "status": f.get("status", {}).get("name", "Unknown"),
            "priority": f.get("priority", {}).get("name", "Medium"),
            "issue_type": f.get("issuetype", {}).get("name", "Task"),
            "assignee": f.get("assignee", {}).get("displayName") if f.get("assignee") else None,
            "reporter": f.get("reporter", {}).get("displayName") if f.get("reporter") else None,
            "labels": labels,
            "due_date": f.get("duedate"),
            "resolved_at": f.get("resolutiondate"),
            "created": f.get("created", ""),
            "updated": f.get("updated", ""),
            "blocked_by": blocked_by,
            "comments": comments,
        }

    async def _find_board(self, project_key: str) -> int | None:
        try:
            data = await self._get("/rest/agile/1.0/board", params={"projectKeyOrId": project_key, "maxResults": 1})
            values = data.get("values", [])
            return values[0]["id"] if values else None
        except JiraClientError:
            return None

    async def _get(self, path: str, params: dict | None = None) -> dict | list:
        for attempt in range(self._max_retries):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        f"{self._base_url}{path}",
                        params=params,
                        auth=self._auth,
                        headers={"Accept": "application/json"},
                    )

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", "5"))
                    await asyncio.sleep(min(retry_after, 30))
                    continue

                if response.status_code >= 400:
                    raise JiraClientError(
                        f"Jira API error: {response.status_code}",
                        status_code=response.status_code,
                    )

                return response.json()

            except httpx.TimeoutException:
                if attempt == self._max_retries - 1:
                    raise JiraClientError("Jira request timed out after retries")
                await asyncio.sleep(2 ** attempt)

            except httpx.ConnectError:
                raise JiraClientError("Cannot connect to Jira. Check the URL.")

        raise JiraClientError("Jira request failed after retries")
