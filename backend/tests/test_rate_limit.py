from __future__ import annotations
import pytest
from app.core import rate_limit
from app.core.config import get_settings
from app.core.rate_limit import _client_key, _evict_expired


class _FakeClient:
    def __init__(self, host: str):
        self.host = host


class _FakeRequest:
    def __init__(self, peer: str | None, forwarded: str | None = None):
        self.client = _FakeClient(peer) if peer else None
        self.headers = {"X-Forwarded-For": forwarded} if forwarded else {}


@pytest.fixture(autouse=True)
def _clear_counts():
    rate_limit._request_counts.clear()
    yield
    rate_limit._request_counts.clear()


def test_uses_peer_address_when_no_proxy_configured(monkeypatch):
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 0, raising=False)
    req = _FakeRequest("203.0.113.9", forwarded="1.2.3.4")
    # The header must be ignored entirely - trusting it unconditionally would
    # let any client evade the limit by inventing an address.
    assert _client_key(req) == "203.0.113.9"


def test_uses_forwarded_address_behind_one_proxy(monkeypatch):
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 1, raising=False)
    req = _FakeRequest("10.0.0.1", forwarded="203.0.113.9")
    assert _client_key(req) == "203.0.113.9"


def test_spoofed_forwarded_entry_is_ignored(monkeypatch):
    """A client that forges X-Forwarded-For gets its value pushed left when the
    real proxy appends the address it actually saw. With one trusted hop we read
    the rightmost entry, so the forgery is discarded."""
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 1, raising=False)
    req = _FakeRequest("10.0.0.1", forwarded="1.2.3.4, 203.0.113.9")
    assert _client_key(req) == "203.0.113.9"


def test_falls_back_when_header_has_too_few_entries(monkeypatch):
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", 2, raising=False)
    req = _FakeRequest("10.0.0.1", forwarded="203.0.113.9")
    assert _client_key(req) == "10.0.0.1"


def test_expired_buckets_are_evicted():
    """Without eviction the dict grows one entry per client address forever."""
    for i in range(1200):
        rate_limit._request_counts[f"ip-{i}:/api/auth"] = [0.0]  # long expired
    _evict_expired(now=10_000.0)
    assert len(rate_limit._request_counts) == 0


def test_eviction_keeps_live_buckets():
    now = 10_000.0
    for i in range(1200):
        rate_limit._request_counts[f"old-{i}:/api/auth"] = [0.0]
    rate_limit._request_counts["live:/api/auth"] = [now - 1]
    _evict_expired(now=now)
    assert "live:/api/auth" in rate_limit._request_counts
