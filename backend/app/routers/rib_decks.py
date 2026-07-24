"""
Run It Back decks router: auth-gated CRUD over a user's own decks.

Mounted under /api, so routes are /api/rib/decks*. Every route requires an
authenticated user and is scoped to decks that user owns. Deck slot structure
reuses schemas.shared_list_schema.DeckData (same shape as SharedList.deck_data).

Decks are stored as-is (drafts allowed); the engine's strict 30-card validation
is applied later, at enrichment / game start.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_db, require_user
from models.base import Deck, User
from rib_engine import enrich_deck
from schemas.rib_schema import (
    DeckCreate,
    DeckListResponse,
    DeckResponse,
    DeckUpdate,
)

router = APIRouter(prefix="/rib/decks", tags=["rib-decks"])


def _owned_deck(deck_id: str, user: User, db: Session) -> Deck:
    deck = (
        db.query(Deck).filter(Deck.id == deck_id, Deck.user_id == user.id).one_or_none()
    )
    if deck is None:
        # 404 (not 403) so we don't reveal that another user's deck id exists.
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


@router.get("", response_model=DeckListResponse)
def list_decks(user: User = Depends(require_user), db: Session = Depends(get_db)):
    decks = (
        db.query(Deck)
        .filter(Deck.user_id == user.id)
        .order_by(Deck.updated_at.desc())
        .all()
    )
    return DeckListResponse(decks=decks)


@router.post("", response_model=DeckResponse, status_code=201)
def create_deck(
    payload: DeckCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    deck = Deck(
        user_id=user.id,
        name=payload.name,
        deck_data=payload.deck_data.model_dump(),
    )
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return deck


@router.get("/{deck_id}", response_model=DeckResponse)
def get_deck(
    deck_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    return _owned_deck(deck_id, user, db)


@router.get("/{deck_id}/enriched")
def get_enriched_deck(
    deck_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Return engine-ready IR-enriched Deck JSON for the user's deck.

    Shape matches what the browser WASM WasmSession.open consumes. Raises 422 if
    the deck is incomplete/invalid for the engine, 503/504 on engine problems.
    """
    deck = _owned_deck(deck_id, user, db)
    return enrich_deck(deck.deck_data)


@router.put("/{deck_id}", response_model=DeckResponse)
def update_deck(
    deck_id: str,
    payload: DeckUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    deck = _owned_deck(deck_id, user, db)
    if payload.name is not None:
        deck.name = payload.name
    if payload.deck_data is not None:
        deck.deck_data = payload.deck_data.model_dump()
    db.commit()
    db.refresh(deck)
    return deck


@router.delete("/{deck_id}", status_code=204)
def delete_deck(
    deck_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    deck = _owned_deck(deck_id, user, db)
    db.delete(deck)
    db.commit()
    return None
