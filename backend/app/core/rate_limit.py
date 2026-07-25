from __future__ import annotations
import time
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

RATE_LIMITS: dict[str, tuple[int, int]] = {
    "/api/jira/connect": (5, 60),
    "/api/auth": (20, 60),
    "/api/reports/generate": (10, 60),
    "/api/demo/reports/generate": (20, 60),
    "/api/delivery/send": (10, 60),
    "/api/delivery/test": (10, 60),
}

_request_counts: dict[str, list[float]] = defaultdict(list)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"

        for prefix, (max_requests, window_seconds) in RATE_LIMITS.items():
            if path.startswith(prefix) and request.method in ("POST", "PUT", "DELETE"):
                key = f"{client_ip}:{prefix}"
                now = time.time()

                _request_counts[key] = [t for t in _request_counts[key] if now - t < window_seconds]

                if len(_request_counts[key]) >= max_requests:
                    return Response(
                        content='{"detail":"Too many requests. Please try again later."}',
                        status_code=429,
                        headers={"Retry-After": str(window_seconds), "Content-Type": "application/json"},
                    )

                _request_counts[key].append(now)
                break

        return await call_next(request)
