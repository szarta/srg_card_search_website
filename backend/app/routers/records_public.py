"""
Public (no-login) games archive.

Records whose visibility is 'public' are browsable and replayable by anyone —
login only gates a player's own decks and private history. A public site game
carries full data (the website observer sees everything, by design), so the
replay reconstructs exactly like the owner's; imported observer games (task 18)
expose only their observable frames. No owner identity is returned.

Mounted under /api -> /api/games/public*.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_db
from models.base import GameRecord
from schemas.rib_schema import GameRecordListResponse, GameRecordResponse

router = APIRouter(prefix="/games/public", tags=["games-public"])

# A sane cap so the public list can't be walked into a huge response.
_LIST_LIMIT = 200


@router.get("", response_model=GameRecordListResponse)
def list_public(db: Session = Depends(get_db)):
    records = (
        db.query(GameRecord)
        .filter(GameRecord.visibility == "public")
        .order_by(GameRecord.created_at.desc())
        .limit(_LIST_LIMIT)
        .all()
    )
    return GameRecordListResponse(records=records)


@router.get("/{record_id}", response_model=GameRecordResponse)
def get_public(record_id: str, db: Session = Depends(get_db)):
    record = (
        db.query(GameRecord)
        .filter(GameRecord.id == record_id, GameRecord.visibility == "public")
        .one_or_none()
    )
    if record is None:
        # 404 whether it's private or absent — don't reveal private records exist.
        raise HTTPException(status_code=404, detail="Game not found")
    return record
