#!/usr/bin/env python3
"""
Two-pass loader for SRG Supershow cards with UUID generation and YAML output:
 1) Ensure every entry has a db_uuid (generate if missing)
 2) Insert all cards without cross-references
 3) Insert remaining cards and link related finishes
 4) Write out an updated YAML with all entries (including generated UUIDs)
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
)

# Map `CardType.value` → SQLAlchemy class
MODEL_MAP = {
    CardType.main_deck.value: MainDeckCard,
    CardType.single_competitor.value: SingleCompetitorCard,
    CardType.tornado_competitor.value: TornadoCompetitorCard,
    CardType.trio_competitor.value: TrioCompetitorCard,
    CardType.entrance.value: EntranceCard,
    CardType.spectacle.value: SpectacleCard,
    CardType.crowd_meter.value: CrowdMeterCard,
}


def load_cards(input_path: str, output_path: str):
    # 1) Read YAML
    with open(input_path) as f:
        data = yaml.safe_load(f)

    # 1a) Ensure UUIDs on every entry
    for entry in data:
        if not entry.get('db_uuid'):
            new_uuid = str(uuid.uuid4())
            entry['db_uuid'] = new_uuid
            print(f"🆕 Generated UUID {new_uuid} for entry '{entry.get('name')}'")

    # 2) Split entries by whether they have `related_finishes`
    no_refs   = [e for e in data if not e.get('related_finishes')]
    with_refs = [e for e in data if e.get('related_finishes')]

    session = SessionLocal()
    inserted = {}  # db_uuid -> instance

    # Phase 1: insert base cards
    print("🚀 Phase 1: inserting cards without references...")
    for entry in no_refs:
        ctype = entry['card_type']
        cls   = MODEL_MAP.get(ctype)
        if not cls:
            print(f"⚠️  Skipping unknown card_type {ctype!r} for {entry.get('name')!r}")
            continue

        # Common fields for all cards
        kwargs = {
            'db_uuid':      entry['db_uuid'],
            'name':         entry['name'],
            'srg_url':      entry.get('srg_url'),
            'release_set':  entry.get('release_set'),
            'is_banned':    entry.get('is_banned', False),
            'rules_text':   entry.get('rules_text'),
            'errata_text':  entry.get('errata_text'),
            'comments':     entry.get('comments'),
            'tags':         entry.get('tags'),
            'card_type':    ctype,
        }
        # MainDeckCard extras
        if cls is MainDeckCard:
            if entry.get('deck_card_number') is not None:
                kwargs['deck_card_number'] = entry['deck_card_number']
            if entry.get('atk_type') is not None:
                kwargs['atk_type']     = AttackSubtype(entry['atk_type'])
            if entry.get('play_order') is not None:
                kwargs['play_order']  = PlayOrderSubtype(entry['play_order'])

        # CompetitorCard (and subclasses) extras
        elif issubclass(cls, CompetitorCard):
            for stat in ('power','agility','strike','submission','grapple','technique'):
                if entry.get(stat) is not None:
                    kwargs[stat] = entry[stat]

        try:
            card = cls(**kwargs)
            session.add(card)
            session.flush()
            inserted[entry['db_uuid']] = card
            print(f"✅ Inserted {cls.__name__} '{card.name}'")
        except IntegrityError as err:
            session.rollback()
            print(f"❌ Failed to insert {entry.get('name')!r}: {err}")

    # Phase 2: insert & link cards with references
    print("🚀 Phase 2: inserting cards with references...")
    for entry in with_refs:
        ctype = entry['card_type']
        cls   = MODEL_MAP.get(ctype)
        if not cls:
            print(f"⚠️  Skipping unknown card_type {ctype!r} for {entry.get('name')!r}")
            continue

        kwargs = {
            'db_uuid':      entry['db_uuid'],
            'name':         entry['name'],
            'srg_url':      entry.get('srg_url'),
            'release_set':  entry.get('release_set'),
            'is_banned':    entry.get('is_banned', False),
            'rules_text':   entry.get('rules_text'),
            'errata_text':  entry.get('errata_text'),
            'comments':     entry.get('comments'),
            'tags':         entry.get('tags'),
            'card_type':    ctype,
        }
        if issubclass(cls, CompetitorCard):
            for stat in ('power','agility','strike','submission','grapple','technique'):
                if entry.get(stat) is not None:
                    kwargs[stat] = entry[stat]

        try:
            card = cls(**kwargs)
            session.add(card)
            session.flush()
            # Link related finishes
            for fid in entry.get('related_finishes', []):
                finish_card = inserted.get(fid) or session.query(MainDeckCard).filter_by(db_uuid=fid).one()
                card.related_finishes.append(finish_card)
            session.flush()
            inserted[entry['db_uuid']] = card
            print(f"✅ Linked finishes for '{card.name}'")
        except Exception as err:
            session.rollback()
            print(f"❌ Error linking finishes for {entry.get('name')!r}: {err}")

    session.commit()
    session.close()
    print("🎉 Database load complete.")

    # 4) Write out augmented YAML
    try:
        with open(output_path, 'w') as f:
            yaml.safe_dump(data, f, sort_keys=False)
        print(f"📦 Wrote augmented YAML to {output_path}")
    except Exception as err:
        print(f"❌ Failed to write augmented YAML: {err}")


if __name__ == '__main__':
    input_path = sys.argv[1] if len(sys.argv) > 1 else 'cards.yaml'
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'augmented_cards.yaml'
    load_cards(input_path, output_path)

