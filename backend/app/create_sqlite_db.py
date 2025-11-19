#!/usr/bin/env python3
"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.

Creates SQLite database schema for mobile Room database.
SQLite-specific adaptations:
- Uses TEXT instead of ARRAY (stores JSON array)
- Uses TEXT for enums
- Simplified relationship tables
"""

import sqlite3
import sys


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
    cursor.execute("CREATE INDEX idx_main_deck_play_order ON main_deck_cards(play_order)")
    cursor.execute("CREATE INDEX idx_competitor_division ON competitor_cards(division)")
    cursor.execute("CREATE INDEX idx_single_gender ON single_competitor_cards(gender)")

    conn.commit()
    conn.close()

    print("Done! Database created successfully.")


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else "srg_cards.db"
    create_database(db_path)
