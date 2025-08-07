"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

from pydantic import BaseModel
from typing import List, Optional
from models.base import CardType, AttackSubtype, PlayOrderSubtype


class Card(BaseModel):
    db_uuid: str
    name: str
    card_type: CardType
    atk_type: Optional[AttackSubtype] = None
    play_order: Optional[PlayOrderSubtype] = None
    deck_card_number: Optional[int] = None
    is_banned: bool
    rules_text: Optional[str]
    errata_text: Optional[str]
    comments: Optional[str]
    srg_url: Optional[str]
    release_set: Optional[str]

    class Config:
        from_attributes = True


class PaginatedCardResponse(BaseModel):
    total_count: int
    items: List[Card]
