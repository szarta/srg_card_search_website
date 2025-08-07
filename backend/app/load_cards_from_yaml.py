"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

import yaml
import uuid
from sqlalchemy.orm import sessionmaker
from enum import Enum
from sqlalchemy import create_engine
from models.base import (
    Card,
    MainDeckCard,
    SingleCompetitorCard,
    TornadoCompetitorCard,
    TrioCompetitorCard,
    EntranceCard,
    SpectacleCard,
    CrowdMeterCard,
    AttackSubtype,
    PlayOrderSubtype,
)

DATABASE_URL = "postgresql://SECURE_USERNAME:SECURE_PASSWORD@localhost/srg_cards"
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

card_type_map = {
    "MainDeckCard": MainDeckCard,
    "SingleCompetitorCard": SingleCompetitorCard,
    "TornadoCompetitorCard": TornadoCompetitorCard,
    "TrioCompetitorCard": TrioCompetitorCard,
    "EntranceCard": EntranceCard,
    "SpectacleCard": SpectacleCard,
    "CrowdMeterCard": CrowdMeterCard,
}


def clear_all_cards(session):
    session.query(MainDeckCard).delete()
    session.query(SingleCompetitorCard).delete()
    session.query(TornadoCompetitorCard).delete()
    session.query(TrioCompetitorCard).delete()
    session.query(EntranceCard).delete()
    session.query(SpectacleCard).delete()
    session.query(CrowdMeterCard).delete()
    session.query(Card).delete()
    session.commit()


def load_cards(yaml_file: str, output_file: str):
    with open(yaml_file, "r") as f:
        original_data = yaml.safe_load(f)

    updated_data = []
    session = Session()

    confirm = input("⚠️ This will DELETE all existing cards. Continue? (y/N): ")
    if confirm.lower() != "y":
        print("Aborted.")
        return

    clear_all_cards(session)

    for entry in original_data:
        entry = entry.copy()
        type_name = entry.pop("card_type")
        Model = card_type_map.get(type_name)

        if not Model:
            print(f"Skipping unknown card type: {type_name}")
            continue

        db_uuid = entry.get("db_uuid") or uuid.uuid4().hex
        entry["db_uuid"] = db_uuid
        entry["card_type"] = type_name

        # Enum cleanup
        if "atk_type" in entry:
            try:
                entry["atk_type"] = AttackSubtype[entry["atk_type"]]
            except KeyError:
                print(f"Invalid atk_type: {entry['atk_type']} — skipping.")
                continue

        if "play_order" in entry:
            try:
                entry["play_order"] = PlayOrderSubtype(entry["play_order"])
            except KeyError:
                print(f"Invalid play_order: {entry['play_order']} — skipping.")
                continue

        card = Model(**entry)
        session.add(card)

        # Convert enums back to string for output YAML
        cleaned_entry = {
            k: (v.value if isinstance(v, Enum) else v) for k, v in entry.items()
        }
        updated_data.append(cleaned_entry)

    session.commit()
    session.close()
    print(f"🟡 Loaded {len(original_data)} entries from {yaml_file}")
    print(f"✅ Loaded {len(updated_data)} cards.")

    # Write output YAML with UUIDs
    with open(output_file, "w") as f:
        yaml.dump(updated_data, f, sort_keys=False)
    print(f"📁 Wrote updated YAML with UUIDs to {output_file}")


if __name__ == "__main__":
    load_cards("cards.yaml", "cards_with_uuids.yaml")
