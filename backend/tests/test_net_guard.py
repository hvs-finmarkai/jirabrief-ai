"""The SSRF guard is the only thing standing between an authenticated user's
URL and the server's private network, so it gets tested hard."""
from __future__ import annotations
import pytest
from app.core import net
from app.core.config import get_settings
from app.core.net import UnsafeURLError, validate_outbound_url


@pytest.fixture(autouse=True)
def _public_mode(monkeypatch):
    # The guard is a no-op when private targets are allowed (local dev), so the
    # tests below force the production posture.
    settings = get_settings()
    monkeypatch.setattr(settings, "allow_private_network_targets", False, raising=False)
    yield


def _resolves_to(monkeypatch, ip: str):
    monkeypatch.setattr(
        net.socket,
        "getaddrinfo",
        lambda *a, **k: [(2, 1, 6, "", (ip, 443))],
    )


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",       # loopback
        "10.0.0.5",        # private class A
        "172.16.4.9",      # private class B
        "192.168.1.10",    # private class C
        "169.254.169.254", # cloud instance metadata
        "0.0.0.0",         # unspecified
    ],
)
def test_rejects_internal_addresses(monkeypatch, ip):
    _resolves_to(monkeypatch, ip)
    with pytest.raises(UnsafeURLError):
        validate_outbound_url("https://evil.example.com")


def test_rejects_ipv4_mapped_ipv6_loopback(monkeypatch):
    # ::ffff:127.0.0.1 is loopback wearing an IPv6 costume.
    monkeypatch.setattr(
        net.socket,
        "getaddrinfo",
        lambda *a, **k: [(10, 1, 6, "", ("::ffff:127.0.0.1", 443, 0, 0))],
    )
    with pytest.raises(UnsafeURLError):
        validate_outbound_url("https://sneaky.example.com")


def test_rejects_when_any_resolved_address_is_private(monkeypatch):
    # A hostname resolving to both a public and a private address must be
    # rejected — otherwise the check is trivially bypassed.
    monkeypatch.setattr(
        net.socket,
        "getaddrinfo",
        lambda *a, **k: [(2, 1, 6, "", ("93.184.216.34", 443)), (2, 1, 6, "", ("10.1.2.3", 443))],
    )
    with pytest.raises(UnsafeURLError):
        validate_outbound_url("https://split-horizon.example.com")


def test_allows_public_address(monkeypatch):
    _resolves_to(monkeypatch, "93.184.216.34")
    assert validate_outbound_url("https://acme.atlassian.net/") == "https://acme.atlassian.net"


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "gopher://example.com",
        "ftp://example.com",
        "http://example.com",  # plain http is not in the default allowed schemes
    ],
)
def test_rejects_disallowed_schemes(monkeypatch, url):
    _resolves_to(monkeypatch, "93.184.216.34")
    with pytest.raises(UnsafeURLError):
        validate_outbound_url(url)


def test_rejects_embedded_credentials(monkeypatch):
    _resolves_to(monkeypatch, "93.184.216.34")
    with pytest.raises(UnsafeURLError):
        validate_outbound_url("https://user:pass@example.com")


def test_rejects_metadata_hostnames(monkeypatch):
    _resolves_to(monkeypatch, "93.184.216.34")
    with pytest.raises(UnsafeURLError):
        validate_outbound_url("https://metadata.google.internal")


def test_rejects_empty_and_hostless(monkeypatch):
    with pytest.raises(UnsafeURLError):
        validate_outbound_url("")
    with pytest.raises(UnsafeURLError):
        validate_outbound_url("https://")


def test_rejects_unresolvable_host(monkeypatch):
    import socket as _socket

    def _boom(*a, **k):
        raise _socket.gaierror("nope")

    monkeypatch.setattr(net.socket, "getaddrinfo", _boom)
    with pytest.raises(UnsafeURLError):
        validate_outbound_url("https://does-not-exist.example")
