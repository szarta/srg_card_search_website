"""
Run It Back PvP match schemas (seat tokens + games list).

These cover only the FastAPI identity surface: minting seat tokens and listing a
user's games. The match lifecycle itself (create/join/state/submit) lives on the
Rust ``srg-match-server``, which the client reaches with a minted token.
"""

from typing import Optional

from pydantic import BaseModel


class SeatTokenResponse(BaseModel):
    """A minted seat token plus where to send it.

    ``seat`` is set only for a per-match token (``null`` for a create/join token).
    """

    token: str
    seat: Optional[str] = None
    expires_in: int
    match_server: str


class MatchSummary(BaseModel):
    """One row of a user's games list, from the caller's point of view."""

    id: str
    status: str
    your_seat: str
    opponent_id: Optional[str] = None
    opponent_email: Optional[str] = None
    your_turn: bool
    visibility: str
    # The current turn's deadline as Unix epoch seconds, or null if the match is
    # untimed / pending / finished. The client counts down to it on the games list.
    turn_deadline: Optional[int] = None


class MatchListResponse(BaseModel):
    matches: list[MatchSummary]
