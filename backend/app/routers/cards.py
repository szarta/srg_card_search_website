"""
Cards router
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List, Tuple
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
        "atk_type": getattr(card, "atk_type", None),
        "play_order": getattr(card, "play_order", None),
        "deck_card_number": getattr(card, "deck_card_number", None),
        "is_banned": card.is_banned,
        "rules_text": card.rules_text,
        "errata_text": card.errata_text,
        "tags": card.tags or [],
        "comments": card.comments,
        "srg_url": card.srg_url,
        "srgpc_url": card.srgpc_url,
        "release_set": card.release_set,
        "power": getattr(card, "power", None),
        "agility": getattr(card, "agility", None),
        "strike": getattr(card, "strike", None),
        "submission": getattr(card, "submission", None),
        "grapple": getattr(card, "grapple", None),
        "technique": getattr(card, "technique", None),
        "division": getattr(card, "division", None),
        "gender": getattr(card, "gender", None),
    }

    if include_relationships:
        # Handle related_cards
        related_cards = []
        if hasattr(card, "related_cards") and card.related_cards:
            for related_card in card.related_cards[
                :10
            ]:  # Limit to prevent huge responses
                related_cards.append(
                    safe_serialize_card(
                        related_card,
                        include_relationships=False,
                        max_depth=max_depth,
                        current_depth=current_depth + 1,
                    )
                )
        result["related_cards"] = related_cards

        # Handle related_finishes
        related_finishes = []
        if hasattr(card, "related_finishes") and card.related_finishes:
            for finish_card in card.related_finishes[
                :20
            ]:  # Limit to prevent huge responses
                related_finishes.append(
                    safe_serialize_card(
                        finish_card,
                        include_relationships=False,
                        max_depth=max_depth,
                        current_depth=current_depth + 1,
                    )
                )
        result["related_finishes"] = related_finishes
    else:
        result["related_cards"] = []
        result["related_finishes"] = []

    return result


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
            .filter(
                Card.db_uuid == card.db_uuid
            )  # <- This was the bug: db_uuid -> card.db_uuid
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
                joinedload(
                    Card.related_cards
                ),  # <- Use Card.related_cards, not CompetitorCard.related_cards
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


class UuidsRequest(BaseModel):
    uuids: List[str]


@router.post("/cards/by-uuids")
def cards_by_uuids(payload: UuidsRequest, db: Session = Depends(get_db)):
    """
    Resolve a list of card UUIDs to full card rows, preserving the order of the input.
    Returns any missing UUIDs for the UI to display.
    """
    if not payload.uuids:
        return {"rows": [], "missing": []}

    # Remove duplicates while preserving order
    seen = set()
    ordered_uuids = []
    for uuid_str in payload.uuids:
        if uuid_str not in seen:
            seen.add(uuid_str)
            ordered_uuids.append(uuid_str)

    if not ordered_uuids:
        return {"rows": [], "missing": []}

    # 1) find candidate base rows by UUID
    base_rows: List[Card] = db.query(Card).filter(Card.db_uuid.in_(ordered_uuids)).all()

    # Map uuid -> Card object
    by_uuid = {c.db_uuid: c for c in base_rows}

    # 2) batch-hydrate by type so subclass columns are present
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
            hydrated[row.db_uuid] = row

    if others:
        for row in (
            db.query(Card)
            .options(joinedload(Card.related_cards))
            .filter(Card.db_uuid.in_(others))
            .all()
        ):
            hydrated[row.db_uuid] = row

    # 3) build output in the order of the input UUIDs
    rows_out = []
    missing = []
    for uuid_str in ordered_uuids:
        if uuid_str in by_uuid:
            obj = hydrated.get(uuid_str, by_uuid[uuid_str])
            rows_out.append(safe_serialize_card(obj))
        else:
            missing.append(uuid_str)

    return {"rows": rows_out, "missing": missing}


def normalize_for_matching(text: str) -> str:
    """
    Normalize text for fuzzy matching by:
    - Converting to lowercase
    - Removing all punctuation and special characters
    - Collapsing multiple spaces to single space
    - Trimming whitespace
    """
    if not text:
        return ""
    normalized = re.sub(r"[^a-z0-9\s]", "", text.lower())
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def _apply_common_filters(
    qry, cls, q: Optional[str], is_banned: Optional[bool], release_set: Optional[str]
):
    """Extract common filter logic to reduce complexity"""
    if q:
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


def _apply_stat_filters(
    qry, cls, power, agility, strike, submission, grapple, technique
):
    """Extract stat filter logic"""
    if power is not None:
        qry = qry.filter(cls.power == power)
    if agility is not None:
        qry = qry.filter(cls.agility == agility)
    if strike is not None:
        qry = qry.filter(cls.strike == strike)
    if submission is not None:
        qry = qry.filter(cls.submission == submission)
    if grapple is not None:
        qry = qry.filter(cls.grapple == grapple)
    if technique is not None:
        qry = qry.filter(cls.technique == technique)
    return qry


def _query_single_competitors(
    db: Session,
    card_type,
    q,
    is_banned,
    release_set,
    division,
    gender,
    power,
    agility,
    strike,
    submission,
    grapple,
    technique,
) -> List[Card]:
    """Query single competitor cards"""
    if card_type is not None and card_type != CardType.single_competitor.value:
        return []

    sq = db.query(SingleCompetitorCard)
    sq = _apply_common_filters(sq, SingleCompetitorCard, q, is_banned, release_set)

    if card_type == CardType.single_competitor.value:
        sq = sq.filter(
            SingleCompetitorCard.card_type == CardType.single_competitor.value
        )
    if division:
        sq = sq.filter(SingleCompetitorCard.division.ilike(f"%{division}%"))
    if gender is not None:
        sq = sq.filter(SingleCompetitorCard.gender == gender)

    sq = _apply_stat_filters(
        sq, SingleCompetitorCard, power, agility, strike, submission, grapple, technique
    )
    return sq.all()


def _query_tornado_trio_competitors(
    db: Session,
    card_type,
    q,
    is_banned,
    release_set,
    division,
    power,
    agility,
    strike,
    submission,
    grapple,
    technique,
) -> List[Card]:
    """Query tornado/trio competitor cards"""
    tt_types = [CardType.tornado_competitor.value, CardType.trio_competitor.value]
    if card_type is not None and card_type not in tt_types:
        return []

    cq = db.query(CompetitorCard)
    cq = _apply_common_filters(cq, CompetitorCard, q, is_banned, release_set)

    if card_type is None:
        cq = cq.filter(CompetitorCard.card_type.in_(tt_types))
    else:
        cq = cq.filter(CompetitorCard.card_type == card_type)

    if division:
        cq = cq.filter(CompetitorCard.division.ilike(f"%{division}%"))

    cq = _apply_stat_filters(
        cq, CompetitorCard, power, agility, strike, submission, grapple, technique
    )
    return cq.all()


def _query_main_deck_cards(
    db: Session,
    card_type,
    q,
    is_banned,
    release_set,
    atk_type,
    play_order,
    deck_card_number,
) -> List[Card]:
    """Query main deck cards"""
    if card_type is not None and card_type != CardType.main_deck.value:
        return []

    mq = db.query(MainDeckCard)
    mq = _apply_common_filters(mq, MainDeckCard, q, is_banned, release_set)

    if atk_type in [e.value for e in AttackSubtype]:
        mq = mq.filter(MainDeckCard.atk_type == atk_type)
    if play_order in [e.value for e in PlayOrderSubtype]:
        mq = mq.filter(MainDeckCard.play_order == play_order)
    if deck_card_number is not None:
        mq = mq.filter(MainDeckCard.deck_card_number == deck_card_number)

    return mq.all()


def _query_other_cards(db: Session, card_type, q, is_banned, release_set) -> List[Card]:
    """Query entrance, spectacle, crowd meter cards"""
    other_types = {
        CardType.entrance.value,
        CardType.spectacle.value,
        CardType.crowd_meter.value,
    }
    if card_type is not None and card_type not in other_types:
        return []

    oq = db.query(Card)
    oq = _apply_common_filters(oq, Card, q, is_banned, release_set)

    if card_type in other_types:
        oq = oq.filter(Card.card_type == card_type)
    else:
        oq = oq.filter(Card.card_type.in_(list(other_types)))

    return oq.all()


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
    Robust list endpoint with reduced complexity.
    Query concrete mappers directly so subclass columns hydrate.
    """
    items: List[Card] = []

    # Query each card type using helper functions
    items += _query_single_competitors(
        db,
        card_type,
        q,
        is_banned,
        release_set,
        division,
        gender,
        power,
        agility,
        strike,
        submission,
        grapple,
        technique,
    )

    items += _query_tornado_trio_competitors(
        db,
        card_type,
        q,
        is_banned,
        release_set,
        division,
        power,
        agility,
        strike,
        submission,
        grapple,
        technique,
    )

    items += _query_main_deck_cards(
        db, card_type, q, is_banned, release_set, atk_type, play_order, deck_card_number
    )

    items += _query_other_cards(db, card_type, q, is_banned, release_set)

    # Sort and paginate
    reverse = sort_order == "desc"
    items.sort(key=lambda c: (c.name or "").lower(), reverse=reverse)

    total_count = len(items)
    paged = items[offset : offset + limit]

    return {
        "total_count": total_count,
        "items": [
            safe_serialize_card(row, include_relationships=False) for row in paged
        ],
    }


def _build_normalized_lookup(all_cards: List[Card]) -> dict:
    """Build normalized name lookup map"""
    normalized_lookup = {}
    for card in all_cards:
        if card.name:
            norm_name = normalize_for_matching(card.name)
            if norm_name:
                normalized_lookup.setdefault(norm_name, []).append(card)
    return normalized_lookup


def _match_input_names(
    ordered: List[str], normalized_lookup: dict
) -> Tuple[dict, List[str]]:
    """Match input names to cards"""
    matched_cards = {}
    unmatched = []

    for input_name in ordered:
        norm_input = normalize_for_matching(input_name)
        if norm_input in normalized_lookup:
            matched_cards[input_name] = normalized_lookup[norm_input]
        else:
            unmatched.append(input_name)

    return matched_cards, unmatched


def _categorize_cards_by_type(
    all_cards: List[Card], all_matched_uuids: set
) -> Tuple[List[str], List[str], List[str], List[str], dict]:
    """Categorize matched cards by type for batch hydration"""
    singles, tornado_trio, maindeck, others = [], [], [], []
    uuid_to_base_card = {}

    for card in all_cards:
        if card.db_uuid in all_matched_uuids:
            uuid_to_base_card[card.db_uuid] = card
            if card.card_type == CardType.single_competitor.value:
                singles.append(card.db_uuid)
            elif card.card_type in {
                CardType.tornado_competitor.value,
                CardType.trio_competitor.value,
            }:
                tornado_trio.append(card.db_uuid)
            elif card.card_type == CardType.main_deck.value:
                maindeck.append(card.db_uuid)
            else:
                others.append(card.db_uuid)

    return singles, tornado_trio, maindeck, others, uuid_to_base_card


def _hydrate_cards(
    db: Session,
    singles: List[str],
    tornado_trio: List[str],
    maindeck: List[str],
    others: List[str],
) -> dict:
    """Hydrate cards with full relationships"""
    hydrated = {}

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
            hydrated[row.db_uuid] = row

    if others:
        for row in (
            db.query(Card)
            .options(joinedload(Card.related_cards))
            .filter(Card.db_uuid.in_(others))
            .all()
        ):
            hydrated[row.db_uuid] = row

    return hydrated


@router.post("/cards/by-names")
def cards_by_names(payload: NamesRequest, db: Session = Depends(get_db)):
    """
    Resolve card names using fuzzy matching.
    Ignores punctuation, casing, and extra whitespace.
    """
    if not payload.names:
        return {"rows": [], "unmatched": []}

    # Normalize and order inputs
    ordered = [name.strip() for name in payload.names if name and name.strip()]
    if not ordered:
        return {"rows": [], "unmatched": []}

    # Fetch and build lookup
    all_cards = db.query(Card).all()
    normalized_lookup = _build_normalized_lookup(all_cards)

    # Match inputs
    matched_cards, unmatched = _match_input_names(ordered, normalized_lookup)

    # Collect matched UUIDs
    all_matched_uuids = {
        card.db_uuid for cards_list in matched_cards.values() for card in cards_list
    }

    if not all_matched_uuids:
        return {"rows": [], "unmatched": unmatched}

    # Categorize and hydrate
    singles, tornado_trio, maindeck, others, uuid_to_base_card = (
        _categorize_cards_by_type(all_cards, all_matched_uuids)
    )
    hydrated = _hydrate_cards(db, singles, tornado_trio, maindeck, others)

    # Build output preserving input order
    rows_out = []
    for input_name in ordered:
        if input_name in matched_cards:
            for card in matched_cards[input_name]:
                obj = hydrated.get(card.db_uuid, uuid_to_base_card[card.db_uuid])
                rows_out.append(safe_serialize_card(obj))

    return {"rows": rows_out, "unmatched": unmatched}
