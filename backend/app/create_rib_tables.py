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

from sqlalchemy import inspect, text

from database import engine
from models.base import Base, User, Deck, GameRecord

# Only the RIB tables — explicitly listed so we never accidentally create
# (or interact with) the card-search schema here.
RIB_TABLES = [
    User.__table__,
    Deck.__table__,
    GameRecord.__table__,
]


def add_missing_columns(connection):
    """ALTER TABLE ... ADD COLUMN for model columns a live table lacks.

    create_all(checkfirst=True) skips a table that already exists, so a column
    added to a model after the first deploy would never reach the database. We
    have no migration tool by design (one admin, one box), so this closes that
    gap the only way that is always safe: adding nullable columns. It never
    drops, renames, retypes, or reorders anything — a column that exists is left
    exactly as it is, and a model column that is NOT NULL without a default is
    reported rather than forced.
    """
    inspector = inspect(connection)
    for table in RIB_TABLES:
        if not inspector.has_table(table.name):
            continue
        existing = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing:
                continue
            if not column.nullable and column.default is None:
                print(f"  SKIP {table.name}.{column.name}: NOT NULL, add it by hand")
                continue
            ddl = column.type.compile(connection.dialect)
            print(f"  ADD  {table.name}.{column.name} {ddl}")
            connection.execute(
                text(f'ALTER TABLE {table.name} ADD COLUMN "{column.name}" {ddl}')
            )


def main():
    names = ", ".join(t.name for t in RIB_TABLES)
    print(f"Ensuring RIB tables exist (checkfirst, no drop): {names}")
    Base.metadata.create_all(engine, tables=RIB_TABLES, checkfirst=True)
    print("Ensuring columns exist (additive only):")
    with engine.begin() as connection:
        add_missing_columns(connection)
    print("Done.")


if __name__ == "__main__":
    main()
