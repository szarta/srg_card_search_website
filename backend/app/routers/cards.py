"""
Cards router
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
import re
from pydantic import BaseModel
from sqlalchemy import func

from models.base import (
    Card,
    MainDeckCard,
    CompetitorCard,
    SingleCompetitorCard,
    CardType,
    AttackSubtype,
    PlayOrderSubtype,
    Gender,
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


def safe_serialize_card(card, include_relationships=True, max_depth=2, current_depth=0):
    """
    Safely serialize a card object to dict, handling circular references.

    Args:
        card: SQLAlchemy card object
        include_relationships: Whether to include related_cards and related_finishes
        max_depth: Maximum depth to serialize relationships (prevents infinite recursion)
        current_depth: Current recursion depth (internal use)
    """
    if current_depth > max_depth:
        # Return minimal representation to break recursion
        return {
            "db_uuid": card.db_uuid,
            "name": card.name,
            "card_type": card.card_type,
        }

    result = {
        "db_uuid": card.db_uuid,
        "name": card.name,
        "card_type": card.card_type,
        "atk_type": getattr(card, 'atk_type', None),
        "play_order": getattr(card, 'play_order', None),
        "deck_card_number": getattr(card, 'deck_card_number', None),
        "is_banned": card.is_banned,
        "rules_text": card.rules_text,
        "errata_text": card.errata_text,
        "tags": card.tags or [],
        "comments": card.comments,
        "srg_url": card.srg_url,
        "release_set": card.release_set,
        "power": getattr(card, 'power', None),
        "agility": getattr(card, 'agility', None),
        "strike": getattr(card, 'strike', None),
        "submission": getattr(card, 'submission', None),
        "grapple": getattr(card, 'grapple', None),
        "technique": getattr(card, 'technique', None),
        "division": getattr(card, 'division', None),
        "gender": getattr(card, 'gender', None),
    }

    if include_relationships:
        # Handle related_cards
        related_cards = []
        if hasattr(card, 'related_cards') and card.related_cards:
            for related_card in card.related_cards[:10]:  # Limit to prevent huge responses
                related_cards.append(
                    safe_serialize_card(related_card, include_relationships=False, max_depth=max_depth, current_depth=current_depth + 1)
                )
        result["related_cards"] = related_cards

        # Handle related_finishes
        related_finishes = []
        if hasattr(card, 'related_finishes') and card.related_finishes:
            for finish_card in card.related_finishes[:20]:  # Limit to prevent huge responses
                related_finishes.append(
                    safe_serialize_card(finish_card, include_relationships=False, max_depth=max_depth, current_depth=current_depth + 1)
                )
        result["related_finishes"] = related_finishes
    else:
        result["related_cards"] = []
        result["related_finishes"] = []

    return result


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
                | (func.array_to_string(cls.tags, " ").ilike(f"%{q}%"))
            )

        if is_banned is not None:
            qry = qry.filter(cls.is_banned == is_banned)
        if release_set:
            qry = qry.filter(cls.release_set == release_set)
        return qry

    items: List[Card] = []

    # ---- Single Competitors (can filter gender) ----
    if card_type is None or card_type == CardType.single_competitor.value:
        sq = db.query(SingleCompetitorCard)
        sq = apply_common_filters(sq, SingleCompetitorCard)
        # Optional: scope by type if explicitly requested (harmless if None)
        if card_type == CardType.single_competitor.value:
            sq = sq.filter(
                SingleCompetitorCard.card_type == CardType.single_competitor.value
            )
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
    paged = items[offset : offset + limit]

    return {
        "total_count": total_count,
        "items": [safe_serialize_card(row, include_relationships=False) for row in paged],
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
                joinedload(Card.related_cards),
                joinedload(CompetitorCard.related_finishes),
            )
            .filter(CompetitorCard.db_uuid == card.db_uuid)
            .first()
        )
    elif ctype == CardType.main_deck.value:
        card = (
            db.query(MainDeckCard)
            .options(joinedload(Card.related_cards))
            .filter(MainDeckCard.db_uuid == card.db_uuid)
            .first()
        )
    else:
        card = (
            db.query(Card)
            .options(joinedload(Card.related_cards))
            .filter(Card.db_uuid == db_uuid)
            .first()
        )

    return safe_serialize_card(card)


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
                joinedload(Card.related_cards),  # <- Use Card.related_cards, not CompetitorCard.related_cards
                joinedload(CompetitorCard.related_finishes),
            )
            .filter(CompetitorCard.db_uuid == db_uuid)
            .first()
        )
    elif ctype == CardType.main_deck.value:
        card = (
            db.query(MainDeckCard)
            .options(joinedload(Card.related_cards))  # <- Use Card.related_cards
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

    return safe_serialize_card(card)


class NamesRequest(BaseModel):
    names: list[str]
    quantities: list[int] | None = None  # accepted but ignored for now (unique cards)


@router.post("/cards/by-names")
def cards_by_names(payload: NamesRequest, db: Session = Depends(get_db)):
    """
    Resolve a list of card names to full card rows, preserving the order of the input.
    Exact, case-insensitive name match. Returns any unmatched names for the UI to display.
    """
    if not payload.names:
        return {"rows": [], "unmatched": []}

    # 1) normalize inputs and preserve original order
    ordered = []
    seen_positions = {}
    for i, raw in enumerate(payload.names):
        name = (raw or "").strip()
        if not name:
            continue
        ordered.append(name)
        # remember first position for stable ordering of duplicates
        seen_positions.setdefault(name.lower(), i)

    if not ordered:
        return {"rows": [], "unmatched": []}

    lname_set = {n.lower() for n in ordered}

    # 2) find candidate base rows by exact (case-insensitive) name
    base_rows: list[Card] = (
        db.query(Card).filter(func.lower(Card.name).in_(lname_set)).all()
    )

    # Map name(lower) -> list of db_uuids (just in case of duplicate names across types)
    by_lname = {}
    for c in base_rows:
        by_lname.setdefault(c.name.lower(), []).append(c)

    # 3) batch-hydrate by type so subclass columns (e.g. deck_card_number, stats) are present
    singles, tornado_trio, maindeck, others = [], [], [], []
    for c in base_rows:
        if c.card_type == CardType.single_competitor.value:
            singles.append(c.db_uuid)
        elif c.card_type in {
            CardType.tornado_competitor.value,
            CardType.trio_competitor.value,
        }:
            tornado_trio.append(c.db_uuid)
        elif c.card_type == CardType.main_deck.value:
            maindeck.append(c.db_uuid)
        else:
            others.append(c.db_uuid)

    # query each mapper
    hydrated: dict[str, Card] = {}

    if singles:
        for row in (
            db.query(SingleCompetitorCard)
            .options(
                joinedload(Card.related_cards),
                joinedload(SingleCompetitorCard.related_finishes),
            )
            .filter(SingleCompetitorCard.db_uuid.in_(singles))
            .all()
        ):
            hydrated[row.db_uuid] = row

    if tornado_trio:
        for row in (
            db.query(CompetitorCard)
            .options(
                joinedload(Card.related_cards),
                joinedload(CompetitorCard.related_finishes),
            )
            .filter(CompetitorCard.db_uuid.in_(tornado_trio))
            .all()
        ):
            hydrated[row.db_uuid] = row

    if maindeck:
        for row in (
            db.query(MainDeckCard)
            .options(joinedload(Card.related_cards))
            .filter(MainDeckCard.db_uuid.in_(maindeck))
            .all()
        ):
            hydrated[row.db_uuid] = row  # includes deck_card_number

    if others:
        for row in (
            db.query(Card)
            .options(joinedload(Card.related_cards))
            .filter(Card.db_uuid.in_(others))
            .all()
        ):
            hydrated[row.db_uuid] = row

    # 4) build output in the order of the input names
    rows_out = []
    unmatched = []
    for name in ordered:
        candidates = by_lname.get(name.lower())
        if not candidates:
            unmatched.append(name)
            continue
        # If multiple rows share the same name, include them all
        for c in candidates:
            obj = hydrated.get(c.db_uuid, c)
            rows_out.append(safe_serialize_card(obj))

    return {"rows": rows_out, "unmatched": unmatched}
