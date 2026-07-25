from __future__ import annotations
import httpx
from app.models.schemas import JiraProject, JiraSprint, JiraIssue, JiraComment


class JiraClient:
    def __init__(self, base_url: str, email: str, token: str):
        self._base_url = base_url.rstrip("/")
        self._auth = (email, token)
        self._client = httpx.AsyncClient(
            base_url=f"{self._base_url}/rest",
            auth=self._auth,
            timeout=30.0,
            headers={"Accept": "application/json"},
        )

    async def verify_connection(self) -> bool:
        response = await self._client.get("/api/2/myself")
        response.raise_for_status()
        return True

    async def get_projects(self) -> list[JiraProject]:
        response = await self._client.get("/api/2/project", params={"recent": 20})
        response.raise_for_status()
        projects = []
        for p in response.json():
            lead_name = ""
            if p.get("lead"):
                lead_name = p["lead"].get("displayName", "")
            projects.append(JiraProject(key=p["key"], name=p["name"], lead=lead_name))
        return projects

    async def get_sprints(self, project_key: str) -> list[JiraSprint]:
        board_id = await self._find_board(project_key)
        if not board_id:
            return []

        sprints: list[JiraSprint] = []
        start_at = 0
        while True:
            response = await self._client.get(
                f"/agile/1.0/board/{board_id}/sprint",
                params={"startAt": start_at, "maxResults": 50, "state": "active,closed,future"},
            )
            response.raise_for_status()
            data = response.json()
            for s in data.get("values", []):
                sprints.append(
                    JiraSprint(
                        id=s["id"],
                        name=s["name"],
                        state=s["state"],
                        startDate=s.get("startDate"),
                        endDate=s.get("endDate"),
                    )
                )
            if data.get("isLast", True):
                break
            start_at += len(data.get("values", []))

        return sorted(sprints, key=lambda s: s.id, reverse=True)[:10]

    async def get_issues(self, project_key: str, sprint_id: int | None = None) -> list[JiraIssue]:
        jql_parts = [f"project = {project_key}"]
        if sprint_id:
            jql_parts.append(f"sprint = {sprint_id}")

        jql = " AND ".join(jql_parts) + " ORDER BY priority DESC, updated DESC"

        issues: list[JiraIssue] = []
        start_at = 0
        fields = "summary,status,priority,assignee,issuetype,created,updated,labels,comment"

        while True:
            response = await self._client.get(
                "/api/2/search",
                params={
                    "jql": jql,
                    "startAt": start_at,
                    "maxResults": 50,
                    "fields": fields,
                },
            )
            response.raise_for_status()
            data = response.json()

            for raw in data.get("issues", []):
                f = raw["fields"]
                comments = []
                comment_data = f.get("comment", {})
                for c in (comment_data.get("comments", []) if isinstance(comment_data, dict) else []):
                    comments.append(
                        JiraComment(
                            author=c.get("author", {}).get("displayName", "Unknown"),
                            body=c.get("body", "")[:500],
                            created=c.get("created", ""),
                        )
                    )

                blocked_by = None
                if any(label.lower() in ("blocked", "impediment") for label in f.get("labels", [])):
                    blocked_by = "See comments for blocker details"

                issues.append(
                    JiraIssue(
                        key=raw["key"],
                        summary=f.get("summary", ""),
                        status=f.get("status", {}).get("name", "Unknown"),
                        priority=f.get("priority", {}).get("name", "Medium"),
                        assignee=f.get("assignee", {}).get("displayName") if f.get("assignee") else None,
                        issueType=f.get("issuetype", {}).get("name", "Task"),
                        created=f.get("created", ""),
                        updated=f.get("updated", ""),
                        labels=f.get("labels", []),
                        comments=comments[-5:],
                        blockedBy=blocked_by,
                    )
                )

            if start_at + len(data.get("issues", [])) >= data.get("total", 0):
                break
            start_at += len(data.get("issues", []))

        return issues

    async def _find_board(self, project_key: str) -> int | None:
        response = await self._client.get(
            "/agile/1.0/board",
            params={"projectKeyOrId": project_key, "maxResults": 1},
        )
        if response.status_code != 200:
            return None
        data = response.json()
        values = data.get("values", [])
        return values[0]["id"] if values else None

    async def close(self):
        await self._client.aclose()
