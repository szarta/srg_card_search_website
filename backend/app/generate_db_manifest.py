#!/usr/bin/env python3
"""
Generate database manifest with SHA-256 hash for mobile app sync.

Usage:
    python3 generate_db_manifest.py [db_path]

Output:
    db_manifest.json in the same directory
"""

import hashlib
import json
import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "srg_cards_mobile.db"
OUTPUT_FILE = Path(__file__).parent / "db_manifest.json"


def sha256_file(filepath):
    """Calculate SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def get_db_stats(db_path):
    """Get statistics from the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    stats = {}

    # Card count
    cursor.execute("SELECT COUNT(*) FROM cards")
    stats["card_count"] = cursor.fetchone()[0]

    # Related finishes count
    try:
        cursor.execute("SELECT COUNT(*) FROM card_related_finishes")
        stats["related_finishes_count"] = cursor.fetchone()[0]
    except sqlite3.OperationalError:
        stats["related_finishes_count"] = 0

    # Related cards count
    try:
        cursor.execute("SELECT COUNT(*) FROM card_related_cards")
        stats["related_cards_count"] = cursor.fetchone()[0]
    except sqlite3.OperationalError:
        stats["related_cards_count"] = 0

    conn.close()
    return stats


def generate_manifest(db_path=None):
    """Generate manifest with hash and stats."""
    if db_path is None:
        db_path = DB_PATH

    db_path = Path(db_path)

    if not db_path.exists():
        print(f"[ERROR] Database not found: {db_path}")
        return

    print(f"Generating manifest for {db_path}...")

    # Calculate hash
    file_hash = sha256_file(db_path)

    # Get stats
    stats = get_db_stats(db_path)

    # File size
    file_size = db_path.stat().st_size

    # Create manifest
    manifest = {
        "version": 1,
        "generated": datetime.now().isoformat(),
        "filename": db_path.name,
        "hash": file_hash,
        "size_bytes": file_size,
        "card_count": stats["card_count"],
        "related_finishes_count": stats["related_finishes_count"],
        "related_cards_count": stats["related_cards_count"],
    }

    # Write JSON
    with open(OUTPUT_FILE, "w") as f:
        json.dump(manifest, f, indent=2)

    print("Generated manifest:")
    print(f"  Cards: {stats['card_count']}")
    print(f"  Related finishes: {stats['related_finishes_count']}")
    print(f"  Related cards: {stats['related_cards_count']}")
    print(f"  Size: {file_size:,} bytes")
    print(f"  Hash: {file_hash[:16]}...")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    import sys

    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    generate_manifest(db_path)
