"""Guards for outbound requests to user-supplied URLs.

Jira site URLs, Slack webhooks and Confluence base URLs are all supplied by
authenticated users. Without a check, someone could point them at internal
infrastructure (cloud metadata endpoints, internal admin panels, databases) and
use the backend as a proxy into the private network - server-side request
forgery. Every outbound call to a user-supplied host goes through
`validate_outbound_url` first.
"""
from __future__ import annotations
import ipaddress
import socket
from urllib.parse import urlparse
from app.core.config import get_settings


class UnsafeURLError(ValueError):
    """Raised when a user-supplied URL must not be requested."""


# Hostnames that resolve to infrastructure rather than a real service.
_BLOCKED_HOSTNAMES = {
    "metadata.google.internal",
    "metadata.goog",
    "instance-data",
}


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
        return True
    if ip.is_multicast or ip.is_unspecified:
        return True
    # AWS/GCP/Azure instance metadata.
    if isinstance(ip, ipaddress.IPv4Address) and ip in ipaddress.ip_network("169.254.0.0/16"):
        return True
    # IPv4-mapped IPv6 (::ffff:127.0.0.1) would otherwise slip past the checks.
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return _is_blocked_ip(ip.ipv4_mapped)
    return False


def validate_outbound_url(raw_url: str, *, allowed_schemes: tuple[str, ...] = ("https",)) -> str:
    """Return the normalised URL, or raise UnsafeURLError.

    Resolves the hostname and rejects the URL if *any* resolved address is
    private, loopback, link-local or otherwise internal. Checking every address
    matters: a hostname can resolve to both a public and a private address.
    """
    settings = get_settings()
    url = (raw_url or "").strip()
    if not url:
        raise UnsafeURLError("URL is required")

    parsed = urlparse(url)
    scheme = parsed.scheme.lower()

    # http is permitted only when private targets are explicitly allowed, which
    # is the local-development configuration.
    effective_schemes = allowed_schemes
    if settings.allow_private_network_targets and "http" not in effective_schemes:
        effective_schemes = effective_schemes + ("http",)

    if scheme not in effective_schemes:
        raise UnsafeURLError(
            f"URL scheme '{parsed.scheme or 'none'}' is not allowed. Use "
            + " or ".join(effective_schemes)
            + "."
        )

    if parsed.username or parsed.password:
        raise UnsafeURLError("URL must not embed credentials")

    hostname = parsed.hostname
    if not hostname:
        raise UnsafeURLError("URL has no hostname")

    if settings.allow_private_network_targets:
        return url.rstrip("/")

    if hostname.lower() in _BLOCKED_HOSTNAMES:
        raise UnsafeURLError("This host is not permitted")

    try:
        resolved = socket.getaddrinfo(hostname, parsed.port or (443 if scheme == "https" else 80))
    except socket.gaierror as exc:
        raise UnsafeURLError(f"Could not resolve host '{hostname}'") from exc

    for family, _type, _proto, _canon, sockaddr in resolved:
        addr = sockaddr[0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if _is_blocked_ip(ip):
            raise UnsafeURLError(
                f"'{hostname}' resolves to a private or internal address "
                "and cannot be used."
            )

    return url.rstrip("/")
