#!/usr/bin/env python3
"""
Refactored two-pass loader for SRG Supershow cards:
 - Break load_cards into smaller functions to reduce complexity
 - Ensure UUIDs, insert base cards, link finishes, and dump YAML
 - **Normalize tags to always be a list of strings**
 - **Order keys for readability and proper YAML formatting**
"""

import sys
import yaml
import uuid
from sqlalchemy.exc import IntegrityError
from database import SessionLocal
from models.base import (
    Card,
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

# Define the desired key ordering
KEY_ORDER = [
    "name",
    "db_uuid",
    "is_banned",
    "srg_url",
    "srgpc_url",
    "card_type",
    "atk_type",
    "play_order",
    "deck_card_number",
    "division",
    "gender",
    "power",
    "technique",
    "agility",
    "strike",
    "submission",
    "grapple",
    "rules_text",
    "errata_text",
    "comments",
    "release_set",
    "tags",
    "related_cards",
    "related_finishes",
]


# --- Helper functions ---


def read_yaml(path: str):
    with open(path) as f:
        return yaml.safe_load(f)


def ensure_uuids(data: list[dict]):
    for entry in data:
        if not entry.get("db_uuid"):
            new_uuid = uuid.uuid4().hex
            entry["db_uuid"] = new_uuid
            print(f"[NEW] Generated UUID {new_uuid} for '{entry.get('name')}'")


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


def reorder_dict_keys(d: dict) -> dict:
    """Reorder dictionary keys according to KEY_ORDER, with remaining keys at the end."""
    ordered = {}

    # Add keys in the specified order if they exist
    for key in KEY_ORDER:
        if key in d:
            ordered[key] = d[key]

    # Add any remaining keys that weren't in KEY_ORDER
    for key in d:
        if key not in ordered:
            ordered[key] = d[key]

    return ordered


def normalize_entries(data: list[dict]):
    """Apply in-place normalization passes over raw YAML entries."""
    for i, e in enumerate(data):
        e["tags"] = _normalize_tags_value(e.get("tags"))
        # Reorder keys for better readability
        data[i] = reorder_dict_keys(e)


def split_entries(data: list[dict]):
    """Split entries into those without references and those with references."""
    no_refs = []
    with_refs = []
    for e in data:
        has_refs = e.get("related_finishes") or e.get("related_cards")
        (with_refs if has_refs else no_refs).append(e)
    return no_refs, with_refs


def insert_entries(session, entries: list[dict], inserted: dict[str, object]):
    for entry in entries:
        ctype = entry.get("card_type")
        cls = MODEL_MAP.get(ctype)
        if not cls:
            print(f"[WARNING] Unknown card_type {ctype!r} for {entry.get('name')!r}")
            continue
        kwargs = _build_kwargs(entry)
        try:
            card = cls(**kwargs)
            session.add(card)
            session.flush()
            inserted[entry["db_uuid"]] = card
            print(f"[OK] Inserted {cls.__name__} '{card.name}'")
        except IntegrityError as err:
            session.rollback()
            print(f"[ERROR] Insert failed {entry.get('name')!r}: {err}")


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
        print(f"[LINKED] Linked finishes for '{card.name}'")


def link_related_cards(session, entries: list[dict], inserted: dict[str, object]):
    """Link related_cards relationships for all entries that have them."""
    for entry in entries:
        # Skip if no related_cards defined
        if not entry.get("related_cards"):
            continue

        card = inserted.get(entry["db_uuid"])
        if not card:
            print(
                f"[WARNING] Card {entry['db_uuid']} not found in inserted cards for related_cards linking"
            )
            continue

        related_count = 0
        for rid in entry.get("related_cards", []):
            # Try to find the related card in multiple tables
            related = (
                inserted.get(rid) or session.query(Card).filter_by(db_uuid=rid).first()
            )

            if related:
                card.related_cards.append(related)
                related_count += 1
            else:
                print(f"[WARNING] Related card {rid} not found for '{card.name}'")

        if related_count > 0:
            session.flush()
            print(f"[LINKED] Linked {related_count} related_cards for '{card.name}'")


def _build_kwargs(entry: dict) -> dict:
    # Common fields
    kw = {
        "db_uuid": entry["db_uuid"],
        "name": entry["name"],
        "srg_url": entry.get("srg_url"),
        "srgpc_url": entry.get("srgpc_url"),
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
                    f"[WARNING] Skipping unknown gender {g!r} for '{entry.get('name')}' (expected Male/Female/Ambiguous)"
                )

    return kw


class YamlDumper(yaml.SafeDumper):
    """Custom YAML dumper with proper formatting for lists."""

    def write_line_break(self, data=None):
        super().write_line_break(data)

    def increase_indent(self, flow=False, indentless=False):
        return super().increase_indent(flow, False)


def represent_list(dumper, data):
    """Custom list representation with proper spacing."""
    if len(data) == 0:
        return dumper.represent_list([])

    # Use block style for non-empty lists to ensure proper spacing
    return dumper.represent_list(data)


# Add the custom list representer
YamlDumper.add_representer(list, represent_list)


def write_yaml(data: list[dict], path: str):
    try:
        with open(path, "w") as f:
            yaml.dump(
                data,
                f,
                Dumper=YamlDumper,
                default_flow_style=False,
                sort_keys=False,
                allow_unicode=True,
                width=1000,  # Prevent unwanted line wrapping
                indent=2,
            )
        print(f"[SUCCESS] Wrote augmented YAML to {path}")
    except Exception as err:
        print(f"[ERROR] YAML write failed: {err}")


# --- Main loader orchestration ---


def load_cards(input_path: str, output_path: str):
    data = read_yaml(input_path)
    ensure_uuids(data)

    # Normalize tags (and any future in-place normalizations) before DB insert and YAML write
    normalize_entries(data)

    no_refs, with_refs = split_entries(data)

    session = SessionLocal()
    inserted: dict[str, object] = {}

    print("[STARTING] Phase 1 - Base inserts...")
    insert_entries(session, no_refs, inserted)

    print("[STARTING] Phase 2 - Reference linking...")
    insert_entries(session, with_refs, inserted)
    link_finishes(session, with_refs, inserted)
    link_related_cards(session, with_refs, inserted)
    session.commit()
    session.close()
    print("[COMPLETE] DB load complete.")

    write_yaml(data, output_path)


# CLI
if __name__ == "__main__":
    inp = sys.argv[1] if len(sys.argv) > 1 else "cards.yaml"
    out = sys.argv[2] if len(sys.argv) > 2 else "augmented_cards.yaml"
    load_cards(inp, out)
