"""
Cards router
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
import re

from models.base import (
    Card,
    MainDeckCard,
    CompetitorCard,
    SingleCompetitorCard,
    CardType,
    AttackSubtype,
    PlayOrderSubtype,
    Gender
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


def _slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


@router.get("/cards", response_model=PaginatedCardResponse)
def list_cards(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Search name, rules text, or tags"),
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
    division: Optional[str] = Query(None, min_length=0, max_length=100),
    gender: Optional[Gender] = Query(None),
):
    """
    Robust list endpoint:
      - Query concrete mappers directly (CompetitorCard, MainDeckCard) so subclass columns hydrate.
      - Query base Card for other types (EntranceCard, SpectacleCard, CrowdMeterCard).
      - Merge, sort in Python, then paginate.
    Scale is fine (≈2k rows).
    """

    def apply_common_filters(qry, cls):
        if q:
            # Match name, rules text, OR tags across all card types
            qry = qry.filter(
                (cls.name.ilike(f"%{q}%"))
                | (cls.rules_text.ilike(f"%{q}%"))
                | (cls.tags.ilike(f"%{q}%"))
            )
        if is_banned is not None:
            qry = qry.filter(cls.is_banned == is_banned)
        if release_set:
            qry = qry.filter(cls.release_set == release_set)
        return qry

    items: List[Card] = []

    # If caller specified a type, only hit that mapper; else include all.
    competitor_types = {
        CardType.single_competitor.value,
        CardType.tornado_competitor.value,
        CardType.trio_competitor.value,
    }

    # ---- Single Competitors (can filter gender) ----
    if card_type is None or card_type == CardType.single_competitor.value:
        sq = db.query(SingleCompetitorCard)
        sq = apply_common_filters(sq, SingleCompetitorCard)
        # Optional: scope by type if explicitly requested (harmless if None)
        if card_type == CardType.single_competitor.value:
            sq = sq.filter(SingleCompetitorCard.card_type == CardType.single_competitor.value)
        if division:
            sq = sq.filter(SingleCompetitorCard.division.ilike(f"%{division}%"))
        if gender is not None:
            sq = sq.filter(SingleCompetitorCard.gender == gender)
        # Stat filters
        if power is not None:
            sq = sq.filter(SingleCompetitorCard.power == power)
        if agility is not None:
            sq = sq.filter(SingleCompetitorCard.agility == agility)
        if strike is not None:
            sq = sq.filter(SingleCompetitorCard.strike == strike)
        if submission is not None:
            sq = sq.filter(SingleCompetitorCard.submission == submission)
        if grapple is not None:
            sq = sq.filter(SingleCompetitorCard.grapple == grapple)
        if technique is not None:
            sq = sq.filter(SingleCompetitorCard.technique == technique)
        items += sq.all()

    # ---- Tornado/Trio Competitors (no gender column here) ----
    tt_types = [CardType.tornado_competitor.value, CardType.trio_competitor.value]
    if card_type is None or card_type in tt_types:
        cq = db.query(CompetitorCard)
        cq = apply_common_filters(cq, CompetitorCard)

        # Exclude singles so we don't duplicate results with the block above
        if card_type is None:
            cq = cq.filter(CompetitorCard.card_type.in_(tt_types))
        else:
            cq = cq.filter(CompetitorCard.card_type == card_type)
        if division:
            cq = cq.filter(CompetitorCard.division.ilike(f"%{division}%"))
        # Stat filters
        if power is not None:
            cq = cq.filter(CompetitorCard.power == power)
        if agility is not None:
            cq = cq.filter(CompetitorCard.agility == agility)
        if strike is not None:
            cq = cq.filter(CompetitorCard.strike == strike)
        if submission is not None:
            cq = cq.filter(CompetitorCard.submission == submission)
        if grapple is not None:
            cq = cq.filter(CompetitorCard.grapple == grapple)
        if technique is not None:
            cq = cq.filter(CompetitorCard.technique == technique)
        items += cq.all()

    # ---- Main Deck ----
    if card_type is None or card_type == CardType.main_deck.value:
        mq = db.query(MainDeckCard)
        mq = apply_common_filters(mq, MainDeckCard)
        if atk_type in [e.value for e in AttackSubtype]:
            mq = mq.filter(MainDeckCard.atk_type == atk_type)
        if play_order in [e.value for e in PlayOrderSubtype]:
            mq = mq.filter(MainDeckCard.play_order == play_order)
        if deck_card_number is not None:
            mq = mq.filter(MainDeckCard.deck_card_number == deck_card_number)

        items += mq.all()

    # ---- Other base-only types (Entrance, Spectacle, Crowd Meter, etc.) ----
    other_types = {
        CardType.entrance.value,
        CardType.spectacle.value,
        CardType.crowd_meter.value,
    }
    if card_type is None or card_type in other_types:
        oq = db.query(Card)
        oq = apply_common_filters(oq, Card)
        if card_type in other_types:
            oq = oq.filter(Card.card_type == card_type)
        else:
            # When unspecified, only include the "other" set here
            oq = oq.filter(Card.card_type.in_(list(other_types)))
        items += oq.all()

    # ---- Merge + sort + paginate ----
    reverse = sort_order == "desc"
    items.sort(key=lambda c: (c.name or "").lower(), reverse=reverse)

    total_count = len(items)
    paged = items[offset: offset + limit]

    return {
        "total_count": total_count,
        "items": [CardSchema.model_validate(row).model_dump() for row in paged],
    }


@router.get("/cards/slug/{slug}", response_model=CardSchema)
def get_card_by_slug(slug: str, db: Session = Depends(get_db)):
    # Broad filter by words to keep DB work reasonable, then exact-match via Python slugify
    words = [w for w in slug.split("-") if w]
    q = db.query(Card)
    for w in words:
        q = q.filter(Card.name.ilike(f"%{w}%"))

    candidates = q.all()
    card = next((c for c in candidates if _slugify(c.name) == slug), None)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    # Fetch fully-mapped row exactly like /cards/{db_uuid}
    ctype = card.card_type
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
            .filter(CompetitorCard.db_uuid == card.db_uuid)
            .first()
        )
    elif ctype == CardType.main_deck.value:
        card = (
            db.query(MainDeckCard)
            .options(joinedload(MainDeckCard.related_cards))
            .filter(MainDeckCard.db_uuid == card.db_uuid)
            .first()
        )
    else:
        card = (
            db.query(Card)
            .options(joinedload(Card.related_cards))
            .filter(Card.db_uuid == card.db_uuid)
            .first()
        )

    return CardSchema.model_validate(card).model_dump()


@router.get("/cards/{db_uuid}", response_model=CardSchema)
def get_card(db_uuid: str, db: Session = Depends(get_db)):
    # 1) first fetch just the type
    ctype = db.query(Card.card_type).filter(Card.db_uuid == db_uuid).scalar()

    # 2) query the correct mapper so relationships/columns hydrate
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
    elif ctype == CardType.main_deck.value:
        card = (
            db.query(MainDeckCard)
            .options(joinedload(MainDeckCard.related_cards))
            .filter(MainDeckCard.db_uuid == db_uuid)
            .first()
        )
    else:
        card = (
            db.query(Card)
            .options(joinedload(Card.related_cards))
            .filter(Card.db_uuid == db_uuid)
            .first()
        )

    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    return CardSchema.model_validate(card).model_dump()
