#!/usr/bin/env python3
"""
Refactored two-pass loader for SRG Supershow cards:
 - Break load_cards into smaller functions to reduce complexity
 - Ensure UUIDs, insert base cards, link finishes, and dump YAML
 - **Normalize tags to always be a list of strings**
"""

import sys
import yaml
import uuid
from sqlalchemy.exc import IntegrityError
from database import SessionLocal
from models.base import (
    CardType,
    MainDeckCard,
    CompetitorCard,
    SingleCompetitorCard,
    TornadoCompetitorCard,
    TrioCompetitorCard,
    EntranceCard,
    SpectacleCard,
    CrowdMeterCard,
    AttackSubtype,
    PlayOrderSubtype,
    Gender,
)

# Map CardType.value -> model class
MODEL_MAP = {
    CardType.main_deck.value: MainDeckCard,
    CardType.single_competitor.value: SingleCompetitorCard,
    CardType.tornado_competitor.value: TornadoCompetitorCard,
    CardType.trio_competitor.value: TrioCompetitorCard,
    CardType.entrance.value: EntranceCard,
    CardType.spectacle.value: SpectacleCard,
    CardType.crowd_meter.value: CrowdMeterCard,
}


# --- Helper functions ---


def read_yaml(path: str):
    with open(path) as f:
        return yaml.safe_load(f)


def ensure_uuids(data: list[dict]):
    for entry in data:
        if not entry.get("db_uuid"):
            new_uuid = uuid.uuid4().hex
            entry["db_uuid"] = new_uuid
            print(f"🆕 Generated UUID {new_uuid} for '{entry.get('name')}'")


def _normalize_tags_value(v) -> list[str]:
    """Coerce tags into a clean list of strings.

    Accepts:
      - None -> []
      - list[str|int|...] -> [stripped strings], drops empties
      - single string -> [string] or split by commas if comma-separated
    """
    if v is None:
        return []
    if isinstance(v, list):
        out = []
        for x in v:
            s = str(x).strip()
            if s:
                out.append(s)
        return out
    if isinstance(v, str):
        # allow either a single tag or comma-separated tags provided as one string
        parts = [p.strip() for p in v.split(",")]
        return [p for p in parts if p]
    # any other type -> best effort string
    s = str(v).strip()
    return [s] if s else []


def normalize_entries(data: list[dict]):
    """Apply in-place normalization passes over raw YAML entries."""
    for e in data:
        e["tags"] = _normalize_tags_value(e.get("tags"))


def split_entries(data: list[dict]):
    no_refs = []
    with_refs = []
    for e in data:
        (with_refs if e.get("related_finishes") else no_refs).append(e)
    return no_refs, with_refs


def insert_entries(session, entries: list[dict], inserted: dict[str, object]):
    for entry in entries:
        ctype = entry.get("card_type")
        cls = MODEL_MAP.get(ctype)
        if not cls:
            print(f"⚠️  Unknown card_type {ctype!r} for {entry.get('name')!r}")
            continue
        kwargs = _build_kwargs(entry)
        try:
            card = cls(**kwargs)
            session.add(card)
            session.flush()
            inserted[entry["db_uuid"]] = card
            print(f"✅ Inserted {cls.__name__} '{card.name}'")
        except IntegrityError as err:
            session.rollback()
            print(f"❌ Insert failed {entry.get('name')!r}: {err}")


def link_finishes(session, entries: list[dict], inserted: dict[str, object]):
    for entry in entries:
        card = inserted.get(entry["db_uuid"])
        if not card:
            continue
        for fid in entry.get("related_finishes", []):
            finish = (
                inserted.get(fid)
                or session.query(MainDeckCard).filter_by(db_uuid=fid).one()
            )
            card.related_finishes.append(finish)
        session.flush()
        print(f"🔗 Linked finishes for '{card.name}'")


def _build_kwargs(entry: dict) -> dict:
    # Common fields
    kw = {
        "db_uuid": entry["db_uuid"],
        "name": entry["name"],
        "srg_url": entry.get("srg_url"),
        "release_set": entry.get("release_set"),
        "is_banned": entry.get("is_banned", False),
        "rules_text": entry.get("rules_text"),
        "errata_text": entry.get("errata_text"),
        "comments": entry.get("comments"),
        # IMPORTANT: tags are now always a list (ARRAY in Postgres)
        "tags": _normalize_tags_value(entry.get("tags")),
        "card_type": entry.get("card_type"),
    }

    cls = MODEL_MAP.get(entry.get("card_type"))

    if cls is MainDeckCard:
        if entry.get("deck_card_number") is not None:
            kw["deck_card_number"] = entry["deck_card_number"]
        if entry.get("atk_type"):
            kw["atk_type"] = AttackSubtype(entry["atk_type"])
        if entry.get("play_order"):
            kw["play_order"] = PlayOrderSubtype(entry["play_order"])

    elif issubclass(cls or type(None), CompetitorCard):
        for stat in [
            "power",
            "agility",
            "strike",
            "submission",
            "grapple",
            "technique",
        ]:
            if entry.get(stat) is not None:
                kw[stat] = entry[stat]

        # division for all competitor variants
        if entry.get("division"):
            kw["division"] = entry["division"]

        # gender for SingleCompetitor only
        if cls is SingleCompetitorCard and entry.get("gender") is not None:
            g = str(entry["gender"]).strip()
            # Accept case-insensitive enum labels
            mapping = {
                "male": Gender.male,
                "female": Gender.female,
                "ambiguous": Gender.ambiguous,
            }
            g_key = g.lower()
            if g_key in mapping:
                kw["gender"] = mapping[g_key]
            else:
                print(
                    f"⚠️  Skipping unknown gender {g!r} for '{entry.get('name')}' (expected Male/Female/Ambiguous)"
                )

    return kw


def write_yaml(data: list[dict], path: str):
    try:
        with open(path, "w") as f:
            yaml.safe_dump(data, f, sort_keys=False)
        print(f"📦 Wrote augmented YAML to {path}")
    except Exception as err:
        print(f"❌ YAML write failed: {err}")


# --- Main loader orchestration ---


def load_cards(input_path: str, output_path: str):
    data = read_yaml(input_path)
    ensure_uuids(data)

    # Normalize tags (and any future in-place normalizations) before DB insert and YAML write
    normalize_entries(data)

    no_refs, with_refs = split_entries(data)

    session = SessionLocal()
    inserted: dict[str, object] = {}

    print("🚀 Phase 1 - Base inserts...")
    insert_entries(session, no_refs, inserted)

    print("🚀 Phase 2 - Reference linking...")
    insert_entries(session, with_refs, inserted)
    link_finishes(session, with_refs, inserted)

    session.commit()
    session.close()
    print("🎉 DB load complete.")

    write_yaml(data, output_path)


# CLI
if __name__ == "__main__":
    inp = sys.argv[1] if len(sys.argv) > 1 else "cards.yaml"
    out = sys.argv[2] if len(sys.argv) > 2 else "augmented_cards.yaml"
    load_cards(inp, out)
