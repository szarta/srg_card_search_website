"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.

Seat tokens for the Run It Back PvP match-server (``srg-match-server``).

FastAPI is the identity + seat-binding authority; the Rust match-server holds no
user table and only VERIFIES a token's signature before trusting its claims. We
mint a standard **JWT (HS256)** so the Rust verifier
(``srg_sim`` ``match-server/src/auth.rs``) accepts it. Claims:

  ``sub``   — the ``rib_users.id`` (always present)
  ``match`` — the match id      (per-match tokens only: state / submit)
  ``seat``  — ``"A"`` | ``"B"``  (per-match tokens only)
  ``exp``   — expiry, unix seconds (always present)

A **create/join** token carries only ``sub`` + ``exp`` (there is no match/seat
yet); the match-server reads ``sub`` to bind the seat. A **per-match** token adds
``match`` + ``seat``; the match-server checks the token is scoped to the path's
match and reads the seat from it.

Hand-rolled with the stdlib (``hmac`` / ``hashlib`` / ``base64``) rather than a
JWT library — the backend has no JWT dependency and already hand-rolls its
crypto (see ``rib_security.hash_key``). The signing secret is SHARED with the
Rust service: both must read the same ``SRG_MATCH_TOKEN_SECRET``.
"""

import base64
import hashlib
import hmac
import json
import os
import time

# Shared HMAC secret. MUST be set (and identical) on both FastAPI and the
# match-server in production; the dev fallback only works when neither is
# configured. Mirrors auth.py's RIB_SECRET_KEY handling.
_SECRET = os.environ.get(
    "SRG_MATCH_TOKEN_SECRET", "dev-insecure-match-token-secret-change-me"
).encode("utf-8")

# Seat tokens are short-lived: the client re-mints one when it opens a game.
DEFAULT_TTL_SECONDS = 15 * 60

# Where the client should send the token (the match-server's base URL). Returned
# alongside the token so clients need not hardcode it.
MATCH_SERVER_URL = os.environ.get("SRG_MATCH_SERVER_URL", "http://localhost:8080")

_HEADER = {"alg": "HS256", "typ": "JWT"}


def _b64url(raw: bytes) -> str:
    """base64url WITHOUT padding — the JWT/JOSE encoding the Rust side decodes."""
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _json_bytes(obj: dict) -> bytes:
    """Compact, deterministic JSON (no incidental whitespace) for a JWT segment."""
    return json.dumps(obj, separators=(",", ":")).encode("utf-8")


def mint_seat_token(
    *,
    user_id: str,
    match_id: str | None = None,
    seat: str | None = None,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> str:
    """Mint a signed seat token. Include ``match_id`` + ``seat`` for a per-match
    token (state/submit); omit both for a create/join token."""
    claims: dict = {"sub": user_id, "exp": int(time.time()) + ttl_seconds}
    if match_id is not None:
        claims["match"] = match_id
    if seat is not None:
        claims["seat"] = seat

    signing_input = f"{_b64url(_json_bytes(_HEADER))}.{_b64url(_json_bytes(claims))}"
    sig = hmac.new(_SECRET, signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url(sig)}"
