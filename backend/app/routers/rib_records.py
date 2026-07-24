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
from rib_engine import validate_record
from sqlalchemy.orm import Session

from auth import get_db, require_user
from models.base import GameRecord, User
from schemas.rib_schema import (
    GameRecordCreate,
    GameRecordImport,
    GameRecordListResponse,
    GameRecordResponse,
    GameRecordUpdate,
    RecordValidation,
)

router = APIRouter(prefix="/rib/games", tags=["rib-records"])

# The only match_record schema version this site knows how to store and replay.
# The engine promises to bump it on any reader-breaking change, so refusing an
# unknown version is safer than storing something we may render wrongly.
SUPPORTED_RECORD_SCHEMA = 1


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


def _check_record(record: dict) -> dict:
    """Version-gate then engine-validate an incoming record. Returns {errors, warnings}."""
    version = record.get("schema_version")
    if version != SUPPORTED_RECORD_SCHEMA:
        return {
            "errors": [
                f"unsupported schema_version {version!r} "
                f"(this site reads version {SUPPORTED_RECORD_SCHEMA})"
            ],
            "warnings": [],
        }
    return validate_record(record)


def _participants(record: dict) -> dict:
    """Project the record's `players` into the summary shape the site renders.

    The names drive the game lists; the uuids let the replay viewer show the
    competitor and entrance art, since a frame carries only the two open zones
    and never repeats who is playing. The transcriber's `player` name rides
    along so an imported match can say who actually played it.
    """
    out = {}
    for seat, info in (record.get("players") or {}).items():
        entry = {}
        if info.get("player"):
            entry["player"] = info["player"]
        for role in ("competitor", "entrance"):
            ref = info.get(role) or {}
            if ref.get("name"):
                entry[role] = ref["name"]
            if ref.get("card"):
                entry[f"{role}_uuid"] = ref["card"]
        out[seat] = entry
    return out


@router.post("/import/check", response_model=RecordValidation)
def check_import(
    payload: GameRecordImport,
    user: User = Depends(require_user),
):
    """Dry-run an import: validate without storing anything.

    The browser already runs the WASM validator, but only the server has the
    card DB, so this is where 'that uuid is not a real card' is caught.
    """
    return _check_record(payload.record)


@router.post("/import", response_model=GameRecordResponse, status_code=201)
def import_record(
    payload: GameRecordImport,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Store an externally authored match record as a replayable game.

    Every column is derived from the validated record — frames, result, and the
    participant names — so a client cannot claim a result its frames don't show.
    Imports keep their frames as the source of truth: an observed match has no
    seed and is not re-simulatable, and even an imported `full` record arrives
    without the engine snapshot our own games replay from.
    """
    record = payload.record
    validation = _check_record(record)
    if validation["errors"]:
        raise HTTPException(status_code=422, detail=validation)

    stored = GameRecord(
        owner_id=user.id,
        information_view=("full" if record.get("kind") == "full" else "observer"),
        visibility=payload.visibility,
        source="import",
        result=record.get("result"),
        engine_version=record.get("engine"),
        participants=_participants(record),
        seed=str((record.get("replay") or {}).get("seed") or "") or None,
        frames=record.get("frames"),
        meta=record.get("meta"),
    )
    db.add(stored)
    db.commit()
    db.refresh(stored)
    return stored


@router.get("/{record_id}", response_model=GameRecordResponse)
def get_record(
    record_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    return _owned_record(record_id, user, db)


@router.patch("/{record_id}", response_model=GameRecordResponse)
def update_record(
    record_id: str,
    payload: GameRecordUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Change a game's visibility (private <-> public). Owner only."""
    record = _owned_record(record_id, user, db)
    record.visibility = payload.visibility
    db.commit()
    db.refresh(record)
    return record


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
