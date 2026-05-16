"""
Credential encryption/decryption for broker_connections.credentials_enc.

Uses Fernet (AES-128-CBC + HMAC-SHA256). Key stored in BROKER_ENCRYPTION_KEY
env var as a URL-safe base64-encoded 32-byte key.

Generate a key:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from markets_worker.config import get_settings


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet | None:
    key = get_settings().broker_encryption_key.strip()
    if not key:
        return None
    return Fernet(key.encode())


def encrypt_credentials(creds: dict[str, Any]) -> str:
    """Encrypt a credentials dict to a base64 string for DB storage."""
    f = _get_fernet()
    if not f:
        raise RuntimeError(
            "BROKER_ENCRYPTION_KEY is not set. "
            "Run: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return f.encrypt(json.dumps(creds).encode()).decode()


def decrypt_credentials(enc: str) -> dict[str, Any]:
    """Decrypt a previously encrypted credentials string."""
    f = _get_fernet()
    if not f:
        raise RuntimeError("BROKER_ENCRYPTION_KEY is not set.")
    try:
        return json.loads(f.decrypt(enc.encode()).decode())
    except InvalidToken as exc:
        raise ValueError("Credentials decryption failed — key mismatch or tampered data") from exc
