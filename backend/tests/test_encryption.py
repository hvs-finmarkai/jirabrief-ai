from __future__ import annotations
import pytest
from app.core import encryption
from app.core.config import get_settings
from app.core.encryption import EncryptionNotConfigured, decrypt_token, encrypt_token


@pytest.fixture(autouse=True)
def _reset_fernet():
    encryption._get_fernet.cache_clear()
    yield
    encryption._get_fernet.cache_clear()


def test_round_trip(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "token_encryption_key", "a" * 64, raising=False)
    token = "jira-api-token-value"
    assert decrypt_token(encrypt_token(token)) == token


def test_ciphertext_is_not_plaintext(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "token_encryption_key", "a" * 64, raising=False)
    assert "jira-api-token-value" not in encrypt_token("jira-api-token-value")


def test_production_without_key_raises(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "token_encryption_key", "", raising=False)
    monkeypatch.setattr(settings, "app_env", "production", raising=False)
    with pytest.raises(EncryptionNotConfigured):
        encrypt_token("anything")


def test_development_without_key_warns_but_works(monkeypatch, caplog):
    settings = get_settings()
    monkeypatch.setattr(settings, "token_encryption_key", "", raising=False)
    monkeypatch.setattr(settings, "app_env", "development", raising=False)
    with caplog.at_level("WARNING"):
        assert decrypt_token(encrypt_token("dev")) == "dev"
    assert any("TOKEN_ENCRYPTION_KEY" in r.message for r in caplog.records)


def test_key_is_independent_of_jwt_secret(monkeypatch):
    """The whole point of the change: rotating the login secret must not affect
    stored Jira tokens, and vice versa."""
    settings = get_settings()
    monkeypatch.setattr(settings, "token_encryption_key", "a" * 64, raising=False)
    monkeypatch.setattr(settings, "supabase_jwt_secret", "original-jwt", raising=False)
    ciphertext = encrypt_token("secret-token")

    monkeypatch.setattr(settings, "supabase_jwt_secret", "rotated-jwt", raising=False)
    encryption._get_fernet.cache_clear()
    assert decrypt_token(ciphertext) == "secret-token"


def test_wrong_key_raises_clear_error(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "token_encryption_key", "a" * 64, raising=False)
    ciphertext = encrypt_token("secret-token")

    monkeypatch.setattr(settings, "token_encryption_key", "b" * 64, raising=False)
    encryption._get_fernet.cache_clear()
    with pytest.raises(EncryptionNotConfigured):
        decrypt_token(ciphertext)
