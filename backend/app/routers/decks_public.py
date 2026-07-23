"""
Public (no-login) deck validation + enrichment.

The enrichment core is not private — it just turns a deck_data payload into
engine-ready Deck JSON (or explains why it can't). Both the existing public deck
builder and Run It Back use it. Login is only needed for a player's *stored*
decks and history, which live in the rib_* routers.

Mounted under /api -> /api/decks/*.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from rib_engine import enrich_deck, engine_info
from schemas.shared_list_schema import DeckData

router = APIRouter(prefix="/decks", tags=["decks-public"])


@router.get("/engine-info")
def get_engine_info():
    """Version/schema stamp of the backend srg binary (for the WASM no-skew check).

    Public: it reveals only engine + schema versions, nothing user-specific.
    """
    return engine_info()


class DeckDataRequest(BaseModel):
    deck_data: DeckData


class ValidateResponse(BaseModel):
    valid: bool
    detail: str | None = None


@router.post("/enrich")
def enrich(payload: DeckDataRequest):
    """Enrich a deck_data payload to engine-ready Deck JSON. 422 if invalid."""
    return enrich_deck(payload.deck_data.model_dump())


@router.post("/validate", response_model=ValidateResponse)
def validate(payload: DeckDataRequest):
    """Check whether a deck_data payload is a legal, playable deck.

    Always 200; `valid` says whether the engine could load it, and `detail`
    carries the reason when it couldn't (missing competitor, wrong card count,
    unknown card, non-single competitor, ...). Handy for inline builder UI.
    """
    try:
        enrich_deck(payload.deck_data.model_dump())
        return ValidateResponse(valid=True)
    except HTTPException as e:
        return ValidateResponse(valid=False, detail=str(e.detail))
