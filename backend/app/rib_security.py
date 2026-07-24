"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.

Shared helpers for Run It Back access keys.

Access keys are hand-minted, high-entropy (256-bit) URL-safe tokens. Because
they are not user-chosen and not low-entropy, a plain SHA-256 (no bcrypt/salt)
is sufficient to store them: brute-forcing a 256-bit random token from its hash
is infeasible. The raw key is only ever shown once, at mint time.
"""

import hashlib
import secrets

KEY_PREFIX = "srg_"
# 32 bytes -> 256 bits of entropy (token_urlsafe returns ~43 chars).
_KEY_BYTES = 32


def generate_key() -> str:
    """Return a fresh raw access key (show once, never stored)."""
    return KEY_PREFIX + secrets.token_urlsafe(_KEY_BYTES)


def hash_key(raw_key: str) -> str:
    """SHA-256 hex digest of a raw access key. Stored in rib_users.key_hash."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()
