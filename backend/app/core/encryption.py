from __future__ import annotations
import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.core.config import get_settings


def _get_fernet() -> Fernet:
    secret = get_settings().supabase_jwt_secret.encode()
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b"jirabrief-token-enc", iterations=100_000)
    key = base64.urlsafe_b64encode(kdf.derive(secret))
    return Fernet(key)


def encrypt_token(plaintext: str) -> str:
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    f = _get_fernet()
    return f.decrypt(ciphertext.encode()).decode()
