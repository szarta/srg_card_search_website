"""
Run It Back game-records router: persist and manage a user's saved games.

Mounted under /api, so routes are /api/rib/games*. Every route requires an
authenticated user and is scoped to records that user owns. A record is a
finished game in one of two shapes (see models.base.GameRecord):

- 'full'     — a site-run game, saved with the engine `snapshot` (+ seed and
               the ordered human decisions) so it can be replayed exactly.
- 'observer' — an imported archive, saved as observable `frames` for playback.

Public browsing of records with visibility='public' (no login) is a separate,
later surface (task 19); this router is the owner's private management API.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_db, require_user
from models.base import GameRecord, User
from schemas.rib_schema import (
    GameRecordCreate,
    GameRecordListResponse,
    GameRecordResponse,
)

router = APIRouter(prefix="/rib/games", tags=["rib-records"])


def _owned_record(record_id: str, user: User, db: Session) -> GameRecord:
    record = (
        db.query(GameRecord)
        .filter(GameRecord.id == record_id, GameRecord.owner_id == user.id)
        .one_or_none()
    )
    if record is None:
        # 404 (not 403) so we don't reveal that another user's record exists.
        raise HTTPException(status_code=404, detail="Game not found")
    return record


@router.get("", response_model=GameRecordListResponse)
def list_records(user: User = Depends(require_user), db: Session = Depends(get_db)):
    records = (
        db.query(GameRecord)
        .filter(GameRecord.owner_id == user.id)
        .order_by(GameRecord.created_at.desc())
        .all()
    )
    return GameRecordListResponse(records=records)


@router.post("", response_model=GameRecordResponse, status_code=201)
def create_record(
    payload: GameRecordCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    record = GameRecord(
        owner_id=user.id,
        information_view=payload.information_view,
        visibility=payload.visibility,
        source=payload.source,
        result=payload.result.model_dump(),
        engine_version=payload.engine_version,
        participants=payload.participants,
        seed=payload.seed,
        decisions=payload.decisions,
        snapshot=payload.snapshot,
        frames=payload.frames,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=GameRecordResponse)
def get_record(
    record_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    return _owned_record(record_id, user, db)


@router.delete("/{record_id}", status_code=204)
def delete_record(
    record_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    record = _owned_record(record_id, user, db)
    db.delete(record)
    db.commit()
    return None
