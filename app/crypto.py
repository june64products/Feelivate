"""
Application-level encryption for credentials held in the database.

A Google refresh token is a long-lived key to someone's calendar. Stored in
clear text it means a database dump — a leaked backup, an over-broad support
query, a compromised read replica — hands out live access to every connected
account. GDPR Art 32(1)(a) names encryption as an expected measure; this is the
narrow, targeted version of it for the fields that are actually credentials.

Key management
--------------
Set TOKEN_ENCRYPTION_KEY to a urlsafe base64 32-byte Fernet key:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Rotation: put the new key first in a comma-separated list and keep the old one
so existing values still decrypt, e.g. TOKEN_ENCRYPTION_KEY="new_key,old_key".
New writes always use the first key.

If no key is configured the helpers pass values through unchanged and log a
warning, so an existing deployment keeps working while the key is being set up.
Values are tagged with a version prefix, which is what makes a mixed database of
encrypted and plaintext rows safe to read during that transition.
"""

import os
from typing import List, Optional

from loguru import logger

_PREFIX = "enc:v1:"

_fernets: Optional[List] = None
_warned = False


def _load_keys() -> List:
    """Build the Fernet instances once, newest key first."""
    global _fernets, _warned
    if _fernets is not None:
        return _fernets

    raw = os.getenv("TOKEN_ENCRYPTION_KEY", "").strip()
    if not raw:
        if not _warned:
            logger.warning(
                "TOKEN_ENCRYPTION_KEY is not set — OAuth refresh tokens will be stored "
                "unencrypted. Generate one with "
                "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"`"
            )
            _warned = True
        _fernets = []
        return _fernets

    try:
        from cryptography.fernet import Fernet

        _fernets = [Fernet(k.strip()) for k in raw.split(",") if k.strip()]
    except Exception as e:
        logger.error(f"TOKEN_ENCRYPTION_KEY is invalid, falling back to plaintext storage: {e}")
        _fernets = []

    return _fernets


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    """Encrypt a credential for storage. Returns the input if no key is set."""
    if not value:
        return value
    if value.startswith(_PREFIX):
        return value  # already encrypted — don't double-wrap

    keys = _load_keys()
    if not keys:
        return value

    try:
        return _PREFIX + keys[0].encrypt(value.encode()).decode()
    except Exception as e:
        logger.error(f"Token encryption failed, storing as-is: {type(e).__name__}")
        return value


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    """Decrypt a stored credential.

    Untagged values are returned unchanged — those are rows written before
    encryption was switched on, and they re-encrypt on next write.
    """
    if not value or not value.startswith(_PREFIX):
        return value

    payload = value[len(_PREFIX):].encode()
    for fernet in _load_keys():
        try:
            return fernet.decrypt(payload).decode()
        except Exception:
            continue  # try the next key in the rotation window

    logger.error("Could not decrypt stored token with any configured key.")
    return None
