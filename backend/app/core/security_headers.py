"""Security response headers.

The README claimed these existed; they did not. This middleware adds them for
real. The API serves JSON only, so the CSP can be maximally restrictive - there
is no page to render, no script to run, and nothing that should ever be framed.
"""
from __future__ import annotations
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.core.config import get_settings

_API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

# Swagger UI needs its own CSP; it is only mounted outside production.
_DOCS_CSP = (
    "default-src 'none'; img-src 'self' data: https://fastapi.tiangolo.com; "
    "script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' "
    "https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net; "
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"
)

_BASE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "X-Permitted-Cross-Domain-Policies": "none",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        settings = get_settings()

        for header, value in _BASE_HEADERS.items():
            response.headers.setdefault(header, value)

        path = request.url.path
        is_docs = path.startswith("/api/docs") or path.startswith("/api/openapi")
        response.headers.setdefault("Content-Security-Policy", _DOCS_CSP if is_docs else _API_CSP)

        # HSTS only means anything over TLS, and sending it from a plain-HTTP
        # dev server would pin developers' browsers to https://localhost.
        if settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"
            )

        # Report bodies can contain customer data; keep them out of shared caches.
        if path.startswith("/api/") and not is_docs:
            response.headers.setdefault("Cache-Control", "no-store")

        return response
