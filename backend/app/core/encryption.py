from __future__ import annotations
import base64
import logging
from functools import lru_cache
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Only ever used when running outside production without a configured key, so a
# developer can boot the app without generating one. Never reached in prod:
# _resolve_secret() raises instead.
_DEV_FALLBACK_SECRET = "jirabrief-insecure-development-key"


class EncryptionNotConfigured(RuntimeError):
    pass


def _resolve_secret() -> str:
    settings = get_settings()
    key = settings.token_encryption_key.strip()
    if key:
        return key

    if settings.is_production:
        raise EncryptionNotConfigured(
            "TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32`. "
            "It must be distinct from SUPABASE_JWT_SECRET so that a leaked login "
            "secret cannot also decrypt stored Jira tokens."
        )

    logger.warning(
        "TOKEN_ENCRYPTION_KEY is not set - using an insecure development key. "
        "Stored Jira tokens are NOT meaningfully protected. Set TOKEN_ENCRYPTION_KEY "
        "before deploying."
    )
    return _DEV_FALLBACK_SECRET


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"jirabrief-token-enc",
        iterations=600_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(_resolve_secret().encode()))
    return Fernet(key)


def encrypt_token(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        # Usually means TOKEN_ENCRYPTION_KEY changed after the token was stored.
        raise EncryptionNotConfigured(
            "Stored credential could not be decrypted. This normally means "
            "TOKEN_ENCRYPTION_KEY changed since it was saved - reconnect the "
            "integration to store it again under the current key."
        ) from exc
