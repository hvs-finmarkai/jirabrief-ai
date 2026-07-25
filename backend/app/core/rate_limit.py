from __future__ import annotations
import time
from collections import defaultdict
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from app.core.config import get_settings

RATE_LIMITS: dict[str, tuple[int, int]] = {
    "/api/jira/connect": (5, 60),
    "/api/auth": (20, 60),
    "/api/reports/generate": (10, 60),
    "/api/demo/reports/generate": (20, 60),
    "/api/delivery/send": (10, 60),
    "/api/delivery/test": (10, 60),
}

# Counters are per-process and in-memory: they reset on restart and are not
# shared between instances. That is proportionate for a single instance; a
# multi-instance deployment needing strict limits wants a shared store.
_request_counts: dict[str, list[float]] = defaultdict(list)


def _client_key(request: Request) -> str:
    """Identify the caller.

    Behind a load balancer `request.client.host` is the balancer, so every user
    would share one bucket and a single busy client could rate-limit everyone.
    X-Forwarded-For fixes that but is client-spoofable, so it is only consulted
    when the deployment declares how many proxy hops it actually sits behind.
    Each trusted proxy appends the address it saw, so counting back from the
    right yields the entry the nearest trusted proxy wrote.
    """
    hops = get_settings().trusted_proxy_hops
    if hops > 0:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            parts = [p.strip() for p in forwarded.split(",") if p.strip()]
            if len(parts) >= hops:
                return parts[-hops]

    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path

        for prefix, (max_requests, window_seconds) in RATE_LIMITS.items():
            if path.startswith(prefix) and request.method in ("POST", "PUT", "DELETE"):
                key = f"{_client_key(request)}:{prefix}"
                now = time.time()

                recent = [t for t in _request_counts[key] if now - t < window_seconds]

                if len(recent) >= max_requests:
                    _request_counts[key] = recent
                    return Response(
                        content='{"detail":"Too many requests. Please try again later."}',
                        status_code=429,
                        headers={"Retry-After": str(window_seconds), "Content-Type": "application/json"},
                    )

                recent.append(now)
                _request_counts[key] = recent
                _evict_expired(now)
                break

        return await call_next(request)


def _evict_expired(now: float) -> None:
    """Drop buckets whose entries have all aged out.

    Without this the dict grows one entry per distinct client address forever,
    which is a slow memory leak an attacker can accelerate by rotating IPs.
    """
    if len(_request_counts) < 1000:
        return
    longest_window = max(window for _, window in RATE_LIMITS.values())
    for key in [k for k, times in _request_counts.items() if not times or now - times[-1] > longest_window]:
        del _request_counts[key]
