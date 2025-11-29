"""
Shared List schemas for API requests/responses
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class SharedListType(str, Enum):
    COLLECTION = "COLLECTION"
    DECK = "DECK"


class DeckSlotData(BaseModel):
    """Individual deck slot data"""

    slot_type: str  # ENTRANCE, COMPETITOR, DECK, FINISH, ALTERNATE
    slot_number: (
        int  # 0 for single slots, 1-30 for deck cards, increments for finish/alternate
    )
    card_uuid: str


class DeckData(BaseModel):
    """Deck structure data"""

    spectacle_type: str  # NEWMAN or VALIANT
    slots: List[DeckSlotData]


class SharedListCreate(BaseModel):
    name: Optional[str] = Field(None, max_length=255, description="Optional list name")
    description: Optional[str] = Field(None, description="Optional list description")
    card_uuids: List[str] = Field(..., description="List of card UUIDs")
    list_type: SharedListType = Field(
        SharedListType.COLLECTION, description="Type of list (COLLECTION or DECK)"
    )
    deck_data: Optional[DeckData] = Field(
        None, description="Deck structure data (required if list_type is DECK)"
    )


class SharedListResponse(BaseModel):
    id: str
    name: Optional[str]
    description: Optional[str]
    card_uuids: List[str]
    list_type: str
    deck_data: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class SharedListCreateResponse(BaseModel):
    id: str
    url: str
    message: str = "Shareable list created successfully"
