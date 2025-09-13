"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional
from models.base import CardType, AttackSubtype, PlayOrderSubtype, Gender


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
    tags: Optional[List[str]] = []
    comments: Optional[str]
    srg_url: Optional[str]
    release_set: Optional[str]
    related_cards: Optional[List[Card]] = None
    related_finishes: Optional[List[Card]] = None
    power: Optional[int] = None
    agility: Optional[int] = None
    strike: Optional[int] = None
    submission: Optional[int] = None
    grapple: Optional[int] = None
    technique: Optional[int] = None

    division: Optional[str] = None
    gender: Optional[Gender] = None

    class Config:
        from_attributes = True


Card.model_rebuild()


class PaginatedCardResponse(BaseModel):
    total_count: int
    items: List[Card]
