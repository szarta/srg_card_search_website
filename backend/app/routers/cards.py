"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

from fastapi import APIRouter, Depends, Query
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc
from typing import Optional
from sqlalchemy.orm import with_polymorphic

from models.base import Card, MainDeckCard, CardType, AttackSubtype, PlayOrderSubtype
from database import SessionLocal
from schemas.card_schema import Card as CardSchema, PaginatedCardResponse

from uuid import UUID

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/cards", response_model=PaginatedCardResponse)
def list_cards(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Search name or rules text"),
    card_type: Optional[str] = Query(None),
    atk_type: Optional[str] = Query(None),
    play_order: Optional[str] = Query(None),
    deck_card_number: Optional[int] = Query(None),
    is_banned: Optional[bool] = Query(None),
    release_set: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_order: str = Query("asc", enum=["asc", "desc"]),
):
    if card_type == CardType.main_deck:
        card_poly = with_polymorphic(Card, [MainDeckCard])
        query = db.query(card_poly)
    else:
        query = db.query(Card)

    # ✅ Apply only valid enum filters
    if card_type in [e.value for e in CardType]:
        query = query.filter(Card.card_type == card_type)

    if card_type == CardType.main_deck:
        if atk_type in [e.value for e in AttackSubtype]:
            query = query.filter(card_poly.MainDeckCard.atk_type == atk_type)

        if play_order in [e.value for e in PlayOrderSubtype]:
            query = query.filter(card_poly.MainDeckCard.play_order == play_order)

        if deck_card_number is not None:
            query = query.filter(
                card_poly.MainDeckCard.deck_card_number == deck_card_number
            )

    if q:
        query = query.filter(
            (card_poly.Card.name.ilike(f"%{q}%"))
            | (card_poly.Card.rules_text.ilike(f"%{q}%"))
        )

    if is_banned is not None:
        query = query.filter(Card.is_banned == is_banned)

    if release_set:
        query = query.filter(Card.release_set == release_set)

    total_count = query.count()
    query = query.order_by(asc(Card.name) if sort_order == "asc" else desc(Card.name))
    results = query.offset(offset).limit(limit).all()

    return {
        "total_count": total_count,
        "items": [CardSchema.model_validate(row).model_dump() for row in results],
    }


@router.get("/cards/{db_uuid}", response_model=CardSchema)
def get_card(db_uuid: UUID, db: Session = Depends(get_db)):
    card = db.query(Card).filter(Card.db_uuid == str(db_uuid)).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return CardSchema.model_validate(card)
