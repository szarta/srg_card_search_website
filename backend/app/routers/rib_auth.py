"""
Run It Back auth router: exchange an access key for a session cookie.

Mounted under /api, so routes are /api/rib/auth/*.
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from auth import (
    clear_session,
    get_db,
    issue_session,
    require_user,
)
from models.base import User
from rib_security import hash_key
from schemas.rib_schema import LoginRequest, UserResponse

router = APIRouter(prefix="/rib/auth", tags=["rib-auth"])


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    key = (payload.key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Access key is required")

    user = (
        db.query(User)
        .filter(User.key_hash == hash_key(key), User.active.is_(True))
        .one_or_none()
    )
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid access key")

    issue_session(response, user)
    return user


@router.post("/logout")
def logout(response: Response):
    clear_session(response)
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(require_user)):
    return user
