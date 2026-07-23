"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.

Bridge from stored decks to the srg engine.

A user's deck is stored as deck_data slots referencing cards by db_uuid (see
schemas.shared_list_schema.DeckData and how ArticlePage.jsx builds slots). The
srg engine wants IR-enriched Deck JSON. We get there by writing a decklist YAML
(cards referenced by db_uuid, which the srg loader resolves directly) and
shelling `srg session open`, whose output snapshot embeds the enriched decks.

Config via env:
  SRG_BIN    path to the srg binary (default: <srg_sim>/target/release/srg)
  SRG_SIM_DIR root of the srg_sim checkout (default: ~/data/srg_sim)
  SRG_CARDS  path to the cards.yaml export (default: this backend's app/cards.yaml)
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import HTTPException

BASE_DIR = Path(__file__).resolve().parent


def _srg_sim_dir() -> Path:
    return Path(os.environ.get("SRG_SIM_DIR", str(Path.home() / "data" / "srg_sim")))


def _srg_bin() -> Path:
    env = os.environ.get("SRG_BIN")
    if env:
        return Path(env)
    sim = _srg_sim_dir()
    release = sim / "target" / "release" / "srg"
    if release.exists():
        return release
    return sim / "target" / "debug" / "srg"


def _cards_path() -> Path:
    env = os.environ.get("SRG_CARDS")
    if env:
        return Path(env)
    return BASE_DIR / "cards.yaml"


def deck_data_to_decklist(deck_data: dict) -> dict:
    """Turn stored deck_data slots into an srg decklist dict (uuid references).

    COMPETITOR/ENTRANCE slots become the competitor/entrance; DECK slots (the
    MainDeckCards, incl. finishes) become the ordered cards list. ALTERNATE
    slots are excluded (sideboard). Raises HTTPException(422) if the deck is not
    a complete, single-competitor, 30-card main deck the engine can load.
    """
    slots = (deck_data or {}).get("slots", [])
    competitor = None
    entrance = None
    deck_cards = []
    for s in slots:
        st = s.get("slot_type")
        uuid = s.get("card_uuid")
        if not uuid:
            continue
        if st == "COMPETITOR":
            competitor = uuid
        elif st == "ENTRANCE":
            entrance = uuid
        elif st == "DECK":
            deck_cards.append((s.get("slot_number", 0), uuid))

    if competitor is None:
        raise HTTPException(status_code=422, detail="Deck has no competitor slot")
    if entrance is None:
        raise HTTPException(status_code=422, detail="Deck has no entrance slot")
    if len(deck_cards) != 30:
        raise HTTPException(
            status_code=422,
            detail=f"Deck must have exactly 30 main-deck cards (has {len(deck_cards)})",
        )

    deck_cards.sort(key=lambda t: t[0])
    return {
        "competitor": {"db_uuid": competitor},
        "entrance": {"db_uuid": entrance},
        "cards": [{"db_uuid": u} for _, u in deck_cards],
    }


def _run_session_open(
    deck_a_path: Path, deck_b_path: Path, seed: int, seat_b: str
) -> dict:
    srg = _srg_bin()
    cards = _cards_path()
    if not srg.exists():
        raise HTTPException(
            status_code=503,
            detail="Game engine binary not available (build srg, or set SRG_BIN)",
        )
    cmd = [
        str(srg),
        "session",
        "open",
        str(deck_a_path),
        str(deck_b_path),
        "--cards",
        str(cards),
        "--seat-a",
        "remote",
        "--seat-b",
        seat_b,
        "--seed",
        str(seed),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Engine timed out")
    if proc.returncode != 0:
        # Surface the engine's own error (bad card, wrong competitor type, etc.)
        detail = (proc.stderr or proc.stdout or "engine error").strip().splitlines()
        raise HTTPException(
            status_code=422,
            detail=f"Engine could not load deck: {detail[-1] if detail else 'unknown'}",
        )
    return json.loads(proc.stdout)


def engine_info() -> dict:
    """Return the srg binary's version/schema stamp (`srg info` output).

    The frontend asserts the WASM pkg's schema versions equal these so a skewed
    (binary, pkg) pair can't silently corrupt enriched decks. 503 if the binary
    isn't available.
    """
    srg = _srg_bin()
    if not srg.exists():
        raise HTTPException(
            status_code=503,
            detail="Game engine binary not available (build srg, or set SRG_BIN)",
        )
    try:
        proc = subprocess.run(
            [str(srg), "info"], capture_output=True, text=True, timeout=10
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Engine timed out")
    if proc.returncode != 0:
        raise HTTPException(status_code=503, detail="Engine info unavailable")
    return json.loads(proc.stdout)


def enrich_deck(deck_data: dict) -> dict:
    """Return the IR-enriched Deck JSON for a single stored deck.

    Self-pairs the deck (open a match of the deck vs itself) and returns
    snapshot.deck_a — the enriched form WasmSession.open consumes.
    """
    decklist = deck_data_to_decklist(deck_data)
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "deck.yaml"
        p.write_text(json.dumps(decklist))  # JSON is valid YAML
        out = _run_session_open(p, p, seed=0, seat_b="heuristic")
    return out["snapshot"]["deck_a"]
