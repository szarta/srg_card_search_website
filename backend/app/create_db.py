"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.

Rebuild the card-search schema from scratch.

This DROPS AND RECREATES every table whose contents are derived from
cards.yaml, which is the source of truth — that is the whole point, and it is
what workflow.sh runs on each deploy.

It deliberately does NOT touch the Run It Back tables (see models.base
.RIB_MODELS): accounts, decks and saved games are original data that nothing
regenerates. Those are created and extended by create_rib_tables.py.
"""

from models.base import (  # noqa: F401  (importing Base pulls in every model)
    RIB_MODELS,
    Base,
)
from sqlalchemy_utils import database_exists, create_database
from database import engine

PRESERVED = {m.__tablename__ for m in RIB_MODELS}


def rebuildable_tables():
    """Every table this script owns: all of them except the preserved ones.

    Derived by exclusion rather than by listing, so a new card table is picked
    up automatically. The check is the other half of that: a new `rib_` table
    that nobody added to RIB_MODELS would otherwise be dropped silently on the
    next deploy, taking real user data with it.
    """
    stray = [
        t.name
        for t in Base.metadata.sorted_tables
        if t.name.startswith("rib_") and t.name not in PRESERVED
    ]
    if stray:
        raise SystemExit(
            f"Refusing to run: {', '.join(stray)} looks like Run It Back data but is "
            "not in models.base.RIB_MODELS, so it would be dropped. Add it there."
        )
    return [t for t in Base.metadata.sorted_tables if t.name not in PRESERVED]


def main():
    if not database_exists(engine.url):
        create_database(engine.url)
        print("Created database.")

    tables = rebuildable_tables()
    print(f"Preserving (Run It Back data): {', '.join(sorted(PRESERVED))}")
    print(f"Dropping and recreating {len(tables)} card-search tables...")
    Base.metadata.drop_all(engine, tables=tables)
    Base.metadata.create_all(engine, tables=tables)
    print("Done.")


if __name__ == "__main__":
    main()
