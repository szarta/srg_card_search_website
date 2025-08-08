"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

from fastapi import APIRouter, Depends, Query
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc
from typing import Optional
from sqlalchemy.orm import with_polymorphic, joinedload

from models.base import (
    Card,
    MainDeckCard,
    CompetitorCard,
    CardType,
    AttackSubtype,
    PlayOrderSubtype,
)
from database import SessionLocal
from schemas.card_schema import Card as CardSchema, PaginatedCardResponse


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
    power: Optional[int] = Query(None),
    agility: Optional[int] = Query(None),
    strike: Optional[int] = Query(None),
    submission: Optional[int] = Query(None),
    grapple: Optional[int] = Query(None),
    technique: Optional[int] = Query(None),
):
    # Ensure card_poly is always defined
    card_poly = None
    if card_type == CardType.main_deck.value:
        card_poly = with_polymorphic(Card, [MainDeckCard])
        query = db.query(card_poly)
    elif card_type in [
        CardType.single_competitor.value,
        CardType.tornado_competitor.value,
        CardType.trio_competitor.value,
    ]:
        card_poly = with_polymorphic(Card, [CompetitorCard])
        query = db.query(card_poly)
    else:
        query = db.query(Card)
        # For filtering on MainDeckCard fields, we skip when not main deck

    # Common filters on Card
    if card_type in [e.value for e in CardType]:
        query = query.filter(Card.card_type == card_type)

    if card_type == CardType.main_deck.value:
        if atk_type in [e.value for e in AttackSubtype]:
            query = query.filter(card_poly.MainDeckCard.atk_type == atk_type)
        if play_order in [e.value for e in PlayOrderSubtype]:
            query = query.filter(card_poly.MainDeckCard.play_order == play_order)

    if (
        card_type
        in [
            CardType.single_competitor.value,
            CardType.tornado_competitor.value,
            CardType.trio_competitor.value,
        ]
        and card_poly
    ):
        if power is not None:
            query = query.filter(card_poly.CompetitorCard.power == power)
        if agility is not None:
            query = query.filter(card_poly.CompetitorCard.agility == agility)
        if strike is not None:
            query = query.filter(card_poly.CompetitorCard.strike == strike)
        if submission is not None:
            query = query.filter(card_poly.CompetitorCard.submission == submission)
        if grapple is not None:
            query = query.filter(card_poly.CompetitorCard.grapple == grapple)
        if technique is not None:
            query = query.filter(card_poly.CompetitorCard.technique == technique)

    if deck_card_number is not None and card_type == CardType.main_deck.value:
        query = query.filter(
            card_poly.MainDeckCard.deck_card_number == deck_card_number
        )

    if q:
        # Always search Card.name/rules_text regardless of card type
        query = query.filter(
            (Card.name.ilike(f"%{q}%")) | (Card.rules_text.ilike(f"%{q}%"))
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
def get_card(db_uuid: str, db: Session = Depends(get_db)):
    # 1) first fetch just the type
    ctype = db.query(Card.card_type).filter(Card.db_uuid == db_uuid).scalar()

    # 2) If this is a competitor, query that subclass directly so
    #    its related_finishes relationship is on the mapper.
    if ctype in {
        CardType.single_competitor.value,
        CardType.tornado_competitor.value,
        CardType.trio_competitor.value,
    }:
        card = (
            db.query(CompetitorCard)
            .options(
                joinedload(CompetitorCard.related_cards),
                joinedload(CompetitorCard.related_finishes),
            )
            .filter(CompetitorCard.db_uuid == db_uuid)
            .first()
        )
    else:
        # Non-competitors only have related_cards
        card = (
            db.query(Card)
            .options(joinedload(Card.related_cards))
            .filter(Card.db_uuid == db_uuid)
            .first()
        )

    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    # explicitly dump to dict so nested lists show up
    return CardSchema.model_validate(card).model_dump()
