"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.

Additively create the "Run It Back" tables (rib_users, rib_decks, ...).

Unlike create_db.py, this script NEVER drops anything. It calls
create_all(..., checkfirst=True) against only the RIB tables, so it is safe to
run against the live production database — existing tables (cards, shared_lists,
...) are untouched, and tables that already exist are skipped.

Run from inside backend/app:  python create_rib_tables.py
"""

from database import engine
from models.base import Base, User, Deck, GameRecord

# Only the RIB tables — explicitly listed so we never accidentally create
# (or interact with) the card-search schema here.
RIB_TABLES = [
    User.__table__,
    Deck.__table__,
    GameRecord.__table__,
]


def main():
    names = ", ".join(t.name for t in RIB_TABLES)
    print(f"Ensuring RIB tables exist (checkfirst, no drop): {names}")
    Base.metadata.create_all(engine, tables=RIB_TABLES, checkfirst=True)
    print("Done.")


if __name__ == "__main__":
    main()
