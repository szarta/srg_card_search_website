"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.

Run It Back authentication.

Login exchanges a hand-minted access key for a signed, timestamped session
cookie (itsdangerous). The cookie carries only the user id — never the raw key
— and expires after SESSION_MAX_AGE. All RIB routes depend on require_user;
the public card-search API is unaffected.

Both dev (Vite proxy) and prod (nginx) serve /api same-origin as the frontend,
so SameSite=Lax cookies are set and returned correctly. In production, set
RIB_COOKIE_SECURE=1 so the cookie is only sent over HTTPS.
"""

import os

from fastapi import Depends, HTTPException, Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from database import SessionLocal
from models.base import User
from rib_security import hash_key

COOKIE_NAME = "rib_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 days, in seconds
_SALT = "rib-session-v1"

# Signing secret. A stable secret MUST be set in production (otherwise every
# process restart / new deploy invalidates all sessions). The dev fallback is
# fine locally but logs everyone out on restart.
_SECRET = os.environ.get("RIB_SECRET_KEY", "dev-insecure-rib-secret-change-me")
_serializer = URLSafeTimedSerializer(_SECRET, salt=_SALT)

# Set RIB_COOKIE_SECURE=1 in production (HTTPS). Default off for local http dev.
_COOKIE_SECURE = os.environ.get("RIB_COOKIE_SECURE", "").lower() in ("1", "true", "yes")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def issue_session(response: Response, user: User) -> None:
    """Sign the user's id into the session cookie on `response`."""
    token = _serializer.dumps(user.id)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=_COOKIE_SECURE,
        path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


def _user_id_from_cookie(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        return _serializer.loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


def get_optional_user(request: Request, db: Session = Depends(get_db)):
    """Resolve the current user from the session cookie, or a Bearer access key.

    Returns None when unauthenticated (does not raise). Use for endpoints that
    behave differently for logged-in vs anonymous callers.
    """
    user_id = _user_id_from_cookie(request)
    if user_id is not None:
        user = db.query(User).filter(User.id == user_id).one_or_none()
        if user is not None and user.active:
            return user

    # Fallback: `Authorization: Bearer <raw_access_key>` (handy for scripts /
    # first login without a cookie). The login endpoint is the normal path.
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        raw_key = auth_header[len("Bearer ") :].strip()
        if raw_key:
            user = (
                db.query(User)
                .filter(User.key_hash == hash_key(raw_key), User.active.is_(True))
                .one_or_none()
            )
            if user is not None:
                return user

    return None


def require_user(user=Depends(get_optional_user)) -> User:
    """FastAPI dependency: the authenticated user, or 401."""
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
