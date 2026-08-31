"""
Run It Back PvP matches router: the FastAPI identity surface for player-vs-player
games. Mounted under /api, so routes are /api/rib/matches*.

FastAPI owns identity and the seat bindings; the Rust ``srg-match-server`` owns
the match lifecycle and engine state (it WRITES the shared ``rib_matches`` table).
This router only:

  * mints **seat tokens** the client presents to the match-server, and
  * lists the caller's games (a read of ``rib_matches`` scoped by login).

It never mutates a match. The trust handshake: a logged-in user asks FastAPI for
a token; FastAPI verifies the user actually holds the seat (from the bindings)
and signs a short-lived JWT the match-server verifies (see ``rib_match_token``).

Two token flavors:
  * ``POST /rib/matches/token`` — a create/join token (``sub`` only). Present it
    to the match-server's create or join-by-code endpoint; it binds the seat to
    ``sub``.
  * ``POST /rib/matches/{id}/token`` — a per-match seat token (``sub`` + match +
    seat), issued only to a user who already holds a seat in that match.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_db, require_user
from models.base import Match, User
from rib_match_token import (
    DEFAULT_TTL_SECONDS,
    MATCH_SERVER_URL,
    mint_seat_token,
)
from schemas.rib_match_schema import (
    MatchListResponse,
    MatchSummary,
    SeatTokenResponse,
)

router = APIRouter(prefix="/rib/matches", tags=["rib-matches"])


def _seat_of(match: Match, user: User) -> Optional[str]:
    """The seat this user holds in the match, or None."""
    if match.seat_a_user == user.id:
        return "A"
    if match.seat_b_user == user.id:
        return "B"
    return None


@router.post("/token", response_model=SeatTokenResponse)
def mint_create_token(user: User = Depends(require_user)):
    """A create/join token, bound to the caller. Present it to the match-server's
    create or join-by-code endpoint (which reads ``sub`` to bind the new seat)."""
    return SeatTokenResponse(
        token=mint_seat_token(user_id=user.id),
        seat=None,
        expires_in=DEFAULT_TTL_SECONDS,
        match_server=MATCH_SERVER_URL,
    )


@router.post("/{match_id}/token", response_model=SeatTokenResponse)
def mint_match_token(
    match_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """A per-match seat token for a game the caller is a seat in.

    Returns 404 (not 403) when the match is unknown *or* the caller is not one of
    its two seats — same non-leaking pattern as the decks/records routers.
    """
    match = db.query(Match).filter(Match.id == match_id).one_or_none()
    seat = _seat_of(match, user) if match is not None else None
    if seat is None:
        raise HTTPException(status_code=404, detail="Match not found")

    return SeatTokenResponse(
        token=mint_seat_token(user_id=user.id, match_id=match_id, seat=seat),
        seat=seat,
        expires_in=DEFAULT_TTL_SECONDS,
        match_server=MATCH_SERVER_URL,
    )


@router.get("", response_model=MatchListResponse)
def list_matches(user: User = Depends(require_user), db: Session = Depends(get_db)):
    """The caller's games, newest first — a read of the shared table scoped by
    login (the match-server keeps status/whose_turn current)."""
    matches = (
        db.query(Match)
        .filter((Match.seat_a_user == user.id) | (Match.seat_b_user == user.id))
        .order_by(Match.updated_at.desc())
        .all()
    )

    # Resolve opponent emails in one query (avoid N+1).
    opponent_ids = {
        opp
        for m in matches
        if (opp := (m.seat_b_user if m.seat_a_user == user.id else m.seat_a_user))
        is not None
    }
    emails = (
        {
            u.id: u.email
            for u in db.query(User.id, User.email)
            .filter(User.id.in_(opponent_ids))
            .all()
        }
        if opponent_ids
        else {}
    )

    summaries = []
    for m in matches:
        your_seat = "A" if m.seat_a_user == user.id else "B"
        opponent_id = m.seat_b_user if your_seat == "A" else m.seat_a_user
        summaries.append(
            MatchSummary(
                id=m.id,
                status=m.status,
                your_seat=your_seat,
                opponent_id=opponent_id,
                opponent_email=emails.get(opponent_id),
                your_turn=(not m.finished and m.whose_turn == your_seat),
                visibility=m.visibility,
                turn_deadline=(
                    int(m.turn_deadline.timestamp()) if m.turn_deadline else None
                ),
            )
        )
    return MatchListResponse(matches=summaries)
