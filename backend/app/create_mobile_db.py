#!/usr/bin/env python3
"""
Create mobile-app compatible SQLite database from cards.yaml
Uses single-table schema matching Android Room database format
"""

import sqlite3
import sys
import yaml
import uuid as uuid_module
from pathlib import Path


def create_mobile_schema(conn):
    """Create complete schema matching Android Room database."""
    cursor = conn.cursor()

    print("Creating mobile app database schema...")

    # Drop existing tables
    cursor.execute("DROP TABLE IF EXISTS folder_cards")
    cursor.execute("DROP TABLE IF EXISTS folders")
    cursor.execute("DROP TABLE IF EXISTS cards")
    cursor.execute("DROP TABLE IF EXISTS user_cards")

    # Legacy user_cards table (for migration compatibility)
    cursor.execute("""
        CREATE TABLE user_cards (
            card_id TEXT PRIMARY KEY NOT NULL,
            card_name TEXT NOT NULL,
            quantity_owned INTEGER NOT NULL,
            quantity_wanted INTEGER NOT NULL,
            is_custom INTEGER NOT NULL,
            added_timestamp INTEGER NOT NULL
        )
    """)

    # Folders table
    cursor.execute("""
        CREATE TABLE folders (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            is_default INTEGER NOT NULL,
            display_order INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        )
    """)

    # Cards table
    cursor.execute("""
        CREATE TABLE cards (
            db_uuid TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            card_type TEXT NOT NULL,
            rules_text TEXT,
            errata_text TEXT,
            is_banned INTEGER NOT NULL,
            release_set TEXT,
            srg_url TEXT,
            srgpc_url TEXT,
            comments TEXT,
            tags TEXT,
            power INTEGER,
            agility INTEGER,
            strike INTEGER,
            submission INTEGER,
            grapple INTEGER,
            technique INTEGER,
            division TEXT,
            gender TEXT,
            deck_card_number INTEGER,
            atk_type TEXT,
            play_order TEXT,
            synced_at INTEGER NOT NULL
        )
    """)

    # Folder-cards junction table
    cursor.execute("""
        CREATE TABLE folder_cards (
            folder_id TEXT NOT NULL,
            card_uuid TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            added_at INTEGER NOT NULL,
            PRIMARY KEY (folder_id, card_uuid),
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
            FOREIGN KEY (card_uuid) REFERENCES cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Card relationship tables (for linked finishes and related cards)
    cursor.execute("DROP TABLE IF EXISTS card_related_finishes")
    cursor.execute("DROP TABLE IF EXISTS card_related_cards")

    cursor.execute("""
        CREATE TABLE card_related_finishes (
            card_uuid TEXT NOT NULL,
            finish_uuid TEXT NOT NULL,
            PRIMARY KEY (card_uuid, finish_uuid),
            FOREIGN KEY (card_uuid) REFERENCES cards(db_uuid) ON DELETE CASCADE,
            FOREIGN KEY (finish_uuid) REFERENCES cards(db_uuid) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE card_related_cards (
            card_uuid TEXT NOT NULL,
            related_uuid TEXT NOT NULL,
            PRIMARY KEY (card_uuid, related_uuid),
            FOREIGN KEY (card_uuid) REFERENCES cards(db_uuid) ON DELETE CASCADE,
            FOREIGN KEY (related_uuid) REFERENCES cards(db_uuid) ON DELETE CASCADE
        )
    """)

    # Note: Room will create indexes itself, don't create them here

    # Insert default folders
    timestamp = int(1000 * 1700000000)  # Fixed timestamp
    cursor.execute(
        """
        INSERT INTO folders (id, name, is_default, display_order, created_at)
        VALUES
            ('owned', 'Owned', 1, 0, ?),
            ('wanted', 'Wanted', 1, 1, ?),
            ('trade', 'Trade', 1, 2, ?)
    """,
        (timestamp, timestamp, timestamp),
    )

    conn.commit()
    print("Schema created successfully with default folders")


def normalize_tags(tags):
    """Normalize tags to comma-separated string."""
    if not tags:
        return ""
    if isinstance(tags, list):
        return ",".join(str(t).strip() for t in tags if t)
    if isinstance(tags, str):
        return tags.strip()
    return str(tags)


def insert_card(cursor, entry, sync_time):
    """Insert card into single-table format."""
    cursor.execute(
        """
        INSERT OR REPLACE INTO cards (
            db_uuid, name, card_type, rules_text, errata_text,
            is_banned, release_set, srg_url, srgpc_url, comments, tags,
            power, agility, strike, submission, grapple, technique,
            division, gender, deck_card_number, atk_type, play_order,
            synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            entry["db_uuid"],
            entry["name"],
            entry.get("card_type"),
            entry.get("rules_text"),
            entry.get("errata_text"),
            1 if entry.get("is_banned") else 0,
            entry.get("release_set"),
            entry.get("srg_url"),
            entry.get("srgpc_url"),
            entry.get("comments"),
            normalize_tags(entry.get("tags")),
            entry.get("power"),
            entry.get("agility"),
            entry.get("strike"),
            entry.get("submission"),
            entry.get("grapple"),
            entry.get("technique"),
            entry.get("division"),
            entry.get("gender"),
            entry.get("deck_card_number"),
            entry.get("atk_type"),
            entry.get("play_order"),
            sync_time,
        ),
    )


def load_cards_from_yaml(conn, yaml_path):
    """Load cards from YAML into mobile database."""
    print(f"\nLoading cards from {yaml_path}...")

    with open(yaml_path) as f:
        cards = yaml.safe_load(f)

    if not cards:
        print("[ERROR] No cards found in YAML file")
        return

    print(f"Found {len(cards)} cards in YAML")

    cursor = conn.cursor()
    sync_time = int(1000 * 1700000000)  # Fixed timestamp for bundled database

    # Ensure UUIDs
    for entry in cards:
        if not entry.get("db_uuid"):
            entry["db_uuid"] = uuid_module.uuid4().hex
            print(f"[NEW] Generated UUID for '{entry.get('name')}'")

    # Insert all cards
    print("\nInserting cards...")
    for i, entry in enumerate(cards, 1):
        insert_card(cursor, entry, sync_time)
        if i % 100 == 0:
            print(f"  Progress: {i}/{len(cards)}")

    conn.commit()
    print(f"Loaded {len(cards)} cards")

    # Insert related finishes
    print("\nInserting related finishes...")
    finish_count = 0
    for entry in cards:
        card_uuid = entry["db_uuid"]
        related_finishes = entry.get("related_finishes", [])
        if related_finishes:
            for finish_uuid in related_finishes:
                cursor.execute(
                    "INSERT OR IGNORE INTO card_related_finishes (card_uuid, finish_uuid) VALUES (?, ?)",
                    (card_uuid, finish_uuid),
                )
                finish_count += 1

    conn.commit()
    print(f"Loaded {finish_count} related finish links")

    # Insert related cards
    print("\nInserting related cards...")
    related_count = 0
    for entry in cards:
        card_uuid = entry["db_uuid"]
        related_cards = entry.get("related_cards", [])
        if related_cards:
            for related_uuid in related_cards:
                cursor.execute(
                    "INSERT OR IGNORE INTO card_related_cards (card_uuid, related_uuid) VALUES (?, ?)",
                    (card_uuid, related_uuid),
                )
                related_count += 1

    conn.commit()
    print(f"Loaded {related_count} related card links")

    print(
        f"\n[SUCCESS] Database complete: {len(cards)} cards, {finish_count} finish links, {related_count} related links"
    )


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else "srg_cards_mobile.db"
    yaml_path = sys.argv[2] if len(sys.argv) > 2 else "cards.yaml"

    # Create database
    conn = sqlite3.connect(db_path)
    create_mobile_schema(conn)

    # Load data
    if Path(yaml_path).exists():
        load_cards_from_yaml(conn, yaml_path)
        conn.close()
        print(f"\nDatabase saved to: {db_path}")
    else:
        print(f"\n[ERROR] YAML file not found: {yaml_path}")
        sys.exit(1)
