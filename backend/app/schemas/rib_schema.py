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
