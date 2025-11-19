#!/usr/bin/env python3
"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.

Creates SQLite database schema for mobile Room database and loads card data.
SQLite-specific adaptations:
- Uses TEXT instead of ARRAY (stores comma-separated values)
- Uses TEXT for enums
- Simplified relationship tables
"""

import sqlite3
import sys
import yaml
import uuid as uuid_module
from pathlib import Path


def create_database(db_path: str):
    """Create SQLite database with all tables for SRG card game."""

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print(f"Creating database at {db_path}...")

    # Drop existing tables if they exist
    print("Dropping existing tables...")
    cursor.execute("DROP TABLE IF EXISTS related_finishes")
    cursor.execute("DROP TABLE IF EXISTS related_cards")
    cursor.execute("DROP TABLE IF EXISTS crowd_meter_cards")
    cursor.execute("DROP TABLE IF EXISTS spectacle_cards")
    cursor.execute("DROP TABLE IF EXISTS entrance_cards")
    cursor.execute("DROP TABLE IF EXISTS trio_competitor_cards")
    cursor.execute("DROP TABLE IF EXISTS tornado_competitor_cards")
    cursor.execute("DROP TABLE IF EXISTS single_competitor_cards")
    cursor.execute("DROP TABLE IF EXISTS competitor_cards")
    cursor.execute("DROP TABLE IF EXISTS main_deck_cards")
    cursor.execute("DROP TABLE IF EXISTS shared_lists")
    cursor.execute("DROP TABLE IF EXISTS cards")

    # Base cards table
    print("Creating cards table...")
    cursor.execute("""
        CREATE TABLE cards (
            db_uuid TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            srg_url TEXT,
            srgpc_url TEXT,
            release_set TEXT,
            is_banned INTEGER DEFAULT 0,
            rules_text TEXT,
            errata_text TEXT,
            comments TEXT,
            tags TEXT,
            card_type TEXT NOT NULL
        )
    """)

    # Main deck cards
    print("Creating main_deck_cards table...")
    cursor.execute("""
        CREATE TABLE main_deck_cards (
            db_uuid TEXT PRIMARY KEY NOT NULL,
            deck_card_number INTEGER,
            atk_type TEXT,
            play_order TEXT,
            rules TEXT,
            FOREIGN KEY (db_uuid) REFERENCES cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Competitor cards (base for single/tornado/trio)
    print("Creating competitor_cards table...")
    cursor.execute("""
        CREATE TABLE competitor_cards (
            db_uuid TEXT PRIMARY KEY NOT NULL,
            power INTEGER,
            agility INTEGER,
            strike INTEGER,
            submission INTEGER,
            grapple INTEGER,
            technique INTEGER,
            division TEXT,
            FOREIGN KEY (db_uuid) REFERENCES cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Single competitor cards
    print("Creating single_competitor_cards table...")
    cursor.execute("""
        CREATE TABLE single_competitor_cards (
            db_uuid TEXT PRIMARY KEY NOT NULL,
            gender TEXT,
            FOREIGN KEY (db_uuid) REFERENCES competitor_cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Tornado competitor cards
    print("Creating tornado_competitor_cards table...")
    cursor.execute("""
        CREATE TABLE tornado_competitor_cards (
            db_uuid TEXT PRIMARY KEY NOT NULL,
            FOREIGN KEY (db_uuid) REFERENCES competitor_cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Trio competitor cards
    print("Creating trio_competitor_cards table...")
    cursor.execute("""
        CREATE TABLE trio_competitor_cards (
            db_uuid TEXT PRIMARY KEY NOT NULL,
            FOREIGN KEY (db_uuid) REFERENCES competitor_cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Entrance cards
    print("Creating entrance_cards table...")
    cursor.execute("""
        CREATE TABLE entrance_cards (
            db_uuid TEXT PRIMARY KEY NOT NULL,
            FOREIGN KEY (db_uuid) REFERENCES cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Spectacle cards
    print("Creating spectacle_cards table...")
    cursor.execute("""
        CREATE TABLE spectacle_cards (
            db_uuid TEXT PRIMARY KEY NOT NULL,
            FOREIGN KEY (db_uuid) REFERENCES cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Crowd meter cards
    print("Creating crowd_meter_cards table...")
    cursor.execute("""
        CREATE TABLE crowd_meter_cards (
            db_uuid TEXT PRIMARY KEY NOT NULL,
            FOREIGN KEY (db_uuid) REFERENCES cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Related cards junction table
    print("Creating related_cards table...")
    cursor.execute("""
        CREATE TABLE related_cards (
            card_id TEXT NOT NULL,
            related_card_id TEXT NOT NULL,
            PRIMARY KEY (card_id, related_card_id),
            FOREIGN KEY (card_id) REFERENCES cards(db_uuid) ON DELETE CASCADE,
            FOREIGN KEY (related_card_id) REFERENCES cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Related finishes junction table
    print("Creating related_finishes table...")
    cursor.execute("""
        CREATE TABLE related_finishes (
            competitor_id TEXT NOT NULL,
            finish_card_id TEXT NOT NULL,
            PRIMARY KEY (competitor_id, finish_card_id),
            FOREIGN KEY (competitor_id) REFERENCES competitor_cards(db_uuid) ON DELETE CASCADE,
            FOREIGN KEY (finish_card_id) REFERENCES main_deck_cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Shared lists table
    print("Creating shared_lists table...")
    cursor.execute("""
        CREATE TABLE shared_lists (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT,
            description TEXT,
            card_uuids TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create indexes for better query performance
    print("Creating indexes...")
    cursor.execute("CREATE INDEX idx_cards_name ON cards(name)")
    cursor.execute("CREATE INDEX idx_cards_type ON cards(card_type)")
    cursor.execute("CREATE INDEX idx_cards_banned ON cards(is_banned)")
    cursor.execute("CREATE INDEX idx_main_deck_atk_type ON main_deck_cards(atk_type)")
    cursor.execute(
        "CREATE INDEX idx_main_deck_play_order ON main_deck_cards(play_order)"
    )
    cursor.execute("CREATE INDEX idx_competitor_division ON competitor_cards(division)")
    cursor.execute("CREATE INDEX idx_single_gender ON single_competitor_cards(gender)")

    conn.commit()
    conn.close()

    print("Done! Database created successfully.")


def normalize_tags(tags):
    """Normalize tags to comma-separated string."""
    if not tags:
        return ""
    if isinstance(tags, list):
        return ",".join(str(t).strip() for t in tags if t)
    if isinstance(tags, str):
        return tags.strip()
    return str(tags)


def ensure_uuid(entry):
    """Ensure entry has a UUID, generate if missing."""
    if not entry.get("db_uuid"):
        new_uuid = uuid_module.uuid4().hex
        entry["db_uuid"] = new_uuid
        print(f"[NEW] Generated UUID {new_uuid} for '{entry.get('name')}'")
    return entry["db_uuid"]


def insert_card_base(cursor, entry):
    """Insert into base cards table."""
    cursor.execute(
        """
        INSERT OR REPLACE INTO cards (
            db_uuid, name, srg_url, srgpc_url, release_set,
            is_banned, rules_text, errata_text, comments, tags, card_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            entry["db_uuid"],
            entry["name"],
            entry.get("srg_url"),
            entry.get("srgpc_url"),
            entry.get("release_set"),
            1 if entry.get("is_banned") else 0,
            entry.get("rules_text"),
            entry.get("errata_text"),
            entry.get("comments"),
            normalize_tags(entry.get("tags")),
            entry.get("card_type"),
        ),
    )


def insert_main_deck_card(cursor, entry):
    """Insert MainDeckCard specific data."""
    cursor.execute(
        """
        INSERT OR REPLACE INTO main_deck_cards (
            db_uuid, deck_card_number, atk_type, play_order
        ) VALUES (?, ?, ?, ?)
    """,
        (
            entry["db_uuid"],
            entry.get("deck_card_number"),
            entry.get("atk_type"),
            entry.get("play_order"),
        ),
    )


def insert_competitor_card(cursor, entry):
    """Insert CompetitorCard base data (for all competitor types)."""
    cursor.execute(
        """
        INSERT OR REPLACE INTO competitor_cards (
            db_uuid, power, agility, strike, submission, grapple, technique, division
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            entry["db_uuid"],
            entry.get("power"),
            entry.get("agility"),
            entry.get("strike"),
            entry.get("submission"),
            entry.get("grapple"),
            entry.get("technique"),
            entry.get("division"),
        ),
    )


def insert_single_competitor_card(cursor, entry):
    """Insert SingleCompetitorCard specific data."""
    insert_competitor_card(cursor, entry)
    cursor.execute(
        """
        INSERT OR REPLACE INTO single_competitor_cards (db_uuid, gender)
        VALUES (?, ?)
    """,
        (entry["db_uuid"], entry.get("gender")),
    )


def insert_tornado_competitor_card(cursor, entry):
    """Insert TornadoCompetitorCard specific data."""
    insert_competitor_card(cursor, entry)
    cursor.execute(
        """
        INSERT OR REPLACE INTO tornado_competitor_cards (db_uuid)
        VALUES (?)
    """,
        (entry["db_uuid"],),
    )


def insert_trio_competitor_card(cursor, entry):
    """Insert TrioCompetitorCard specific data."""
    insert_competitor_card(cursor, entry)
    cursor.execute(
        """
        INSERT OR REPLACE INTO trio_competitor_cards (db_uuid)
        VALUES (?)
    """,
        (entry["db_uuid"],),
    )


def insert_entrance_card(cursor, entry):
    """Insert EntranceCard specific data."""
    cursor.execute(
        """
        INSERT OR REPLACE INTO entrance_cards (db_uuid)
        VALUES (?)
    """,
        (entry["db_uuid"],),
    )


def insert_spectacle_card(cursor, entry):
    """Insert SpectacleCard specific data."""
    cursor.execute(
        """
        INSERT OR REPLACE INTO spectacle_cards (db_uuid)
        VALUES (?)
    """,
        (entry["db_uuid"],),
    )


def insert_crowd_meter_card(cursor, entry):
    """Insert CrowdMeterCard specific data."""
    cursor.execute(
        """
        INSERT OR REPLACE INTO crowd_meter_cards (db_uuid)
        VALUES (?)
    """,
        (entry["db_uuid"],),
    )


# Map card type to insert function
TYPE_HANDLERS = {
    "MainDeckCard": insert_main_deck_card,
    "SingleCompetitorCard": insert_single_competitor_card,
    "TornadoCompetitorCard": insert_tornado_competitor_card,
    "TrioCompetitorCard": insert_trio_competitor_card,
    "EntranceCard": insert_entrance_card,
    "SpectacleCard": insert_spectacle_card,
    "CrowdMeterCard": insert_crowd_meter_card,
}


def insert_card(cursor, entry):
    """Insert a card into appropriate tables based on card_type."""
    card_type = entry.get("card_type")

    # Insert base card data
    insert_card_base(cursor, entry)

    # Insert type-specific data
    handler = TYPE_HANDLERS.get(card_type)
    if handler:
        handler(cursor, entry)
    else:
        print(f"[WARNING] Unknown card_type '{card_type}' for '{entry.get('name')}'")


def insert_relationships(cursor, entry):
    """Insert related_finishes and related_cards relationships."""
    card_uuid = entry["db_uuid"]

    # Insert related finishes
    for finish_uuid in entry.get("related_finishes", []):
        cursor.execute(
            """
            INSERT OR IGNORE INTO related_finishes (competitor_id, finish_card_id)
            VALUES (?, ?)
        """,
            (card_uuid, finish_uuid),
        )

    # Insert related cards
    for related_uuid in entry.get("related_cards", []):
        cursor.execute(
            """
            INSERT OR IGNORE INTO related_cards (card_id, related_card_id)
            VALUES (?, ?)
        """,
            (card_uuid, related_uuid),
        )


def load_cards_from_yaml(conn, yaml_path: str):
    """Load card data from YAML file into database."""
    print(f"\nLoading cards from {yaml_path}...")

    with open(yaml_path) as f:
        cards = yaml.safe_load(f)

    if not cards:
        print("[ERROR] No cards found in YAML file")
        return

    print(f"Found {len(cards)} cards in YAML")

    cursor = conn.cursor()

    # Ensure all cards have UUIDs
    for entry in cards:
        ensure_uuid(entry)

    # Split into two passes: cards without references, then cards with references
    no_refs = []
    with_refs = []
    for entry in cards:
        has_refs = entry.get("related_finishes") or entry.get("related_cards")
        (with_refs if has_refs else no_refs).append(entry)

    # Phase 1: Insert all base cards
    print(f"\n[PHASE 1] Inserting {len(no_refs)} cards without references...")
    for entry in no_refs:
        insert_card(cursor, entry)
        print(f"[OK] Inserted {entry.get('card_type')} '{entry.get('name')}'")

    # Phase 2: Insert cards with references
    print(f"\n[PHASE 2] Inserting {len(with_refs)} cards with references...")
    for entry in with_refs:
        insert_card(cursor, entry)
        insert_relationships(cursor, entry)
        print(
            f"[OK] Inserted {entry.get('card_type')} '{entry.get('name')}' with relationships"
        )

    conn.commit()
    print(f"\n[SUCCESS] Loaded {len(cards)} cards into database")


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else "srg_cards.db"
    yaml_path = sys.argv[2] if len(sys.argv) > 2 else "cards.yaml"

    # Create schema
    create_database(db_path)

    # Load data
    if Path(yaml_path).exists():
        conn = sqlite3.connect(db_path)
        load_cards_from_yaml(conn, yaml_path)
        conn.close()
    else:
        print(f"\n[WARNING] YAML file not found: {yaml_path}")
        print("Schema created but no data loaded.")
        print(f"Run with: python3 {sys.argv[0]} {db_path} <path_to_cards.yaml>")
