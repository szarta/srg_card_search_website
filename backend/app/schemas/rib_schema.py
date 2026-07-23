"""
Run It Back API schemas (auth + decks).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# Reuse the deck slot structure already defined for shared lists so user decks
# and shared-list decks share one on-disk shape.
from schemas.shared_list_schema import DeckData  # noqa: F401


class LoginRequest(BaseModel):
    key: str = Field(..., description="Hand-minted access key")


class UserResponse(BaseModel):
    id: str
    email: str

    class Config:
        from_attributes = True


# --- Decks (used by rib_decks router, task 5/6) ---------------------------


class DeckCreate(BaseModel):
    name: str = Field(..., max_length=255)
    deck_data: DeckData


class DeckUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    deck_data: Optional[DeckData] = None


class DeckResponse(BaseModel):
    id: str
    name: str
    deck_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeckListResponse(BaseModel):
    decks: List[DeckResponse]


# --- Game records (used by rib_records router, task 13) -------------------


class GameResult(BaseModel):
    winner: str  # 'A' | 'B' | 'draw'
    reason: str  # finish | count_out | disqualification | pinfall | turn_cap
    turns: int


class GameRecordCreate(BaseModel):
    """Persist a finished game. Site games send `snapshot` (+ seed/decisions);
    observer imports send `frames`. Defaults describe a private, site-run,
    full-information game."""

    information_view: str = Field("full", pattern="^(full|observer)$")
    visibility: str = Field("private", pattern="^(private|public)$")
    source: str = Field("site", pattern="^(site|import)$")
    result: GameResult
    engine_version: Optional[Dict[str, Any]] = None
    participants: Optional[Dict[str, Any]] = None
    seed: Optional[str] = Field(None, max_length=32)
    decisions: Optional[List[int]] = None
    snapshot: Optional[str] = None
    frames: Optional[List[Dict[str, Any]]] = None


# Light row for lists — omits the bulky snapshot/frames/decisions payloads.
class GameRecordSummary(BaseModel):
    id: str
    created_at: datetime
    information_view: str
    visibility: str
    source: str
    result: Dict[str, Any]
    participants: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


# Full record for GET /{id} — carries the replay payload.
class GameRecordResponse(GameRecordSummary):
    engine_version: Optional[Dict[str, Any]] = None
    seed: Optional[str] = None
    decisions: Optional[List[int]] = None
    snapshot: Optional[str] = None
    frames: Optional[List[Dict[str, Any]]] = None


class GameRecordListResponse(BaseModel):
    records: List[GameRecordSummary]
