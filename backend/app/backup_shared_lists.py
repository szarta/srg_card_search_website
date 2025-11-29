"""
Backup and restore shared lists during database recreation
"""

import json
from models.base import SharedList
from database import SessionLocal


def backup_shared_lists(filename="shared_lists_backup.json"):
    """Backup all shared lists to a JSON file"""
    db = SessionLocal()
    try:
        shared_lists = db.query(SharedList).all()
        backup_data = []

        for sl in shared_lists:
            backup_data.append(
                {
                    "id": sl.id,
                    "name": sl.name,
                    "description": sl.description,
                    "card_uuids": sl.card_uuids,
                    "list_type": sl.list_type.value
                    if hasattr(sl, "list_type") and sl.list_type
                    else "COLLECTION",
                    "deck_data": sl.deck_data if hasattr(sl, "deck_data") else None,
                    "created_at": sl.created_at.isoformat() if sl.created_at else None,
                }
            )

        with open(filename, "w") as f:
            json.dump(backup_data, f, indent=2)

        print(f"Backed up {len(backup_data)} shared lists to {filename}")
        return len(backup_data)

    except Exception as e:
        print(f"Backup failed: {e}")
        return 0
    finally:
        db.close()


def restore_shared_lists(filename="shared_lists_backup.json"):
    """Restore shared lists from JSON backup"""
    try:
        with open(filename, "r") as f:
            backup_data = json.load(f)
    except FileNotFoundError:
        print(f"No backup file found: {filename}")
        return 0

    db = SessionLocal()
    try:
        restored_count = 0
        for data in backup_data:
            # Check if this shared list already exists (avoid duplicates)
            existing = db.query(SharedList).filter(SharedList.id == data["id"]).first()
            if existing:
                print(f"Skipping existing shared list: {data['id']}")
                continue

            shared_list = SharedList(
                id=data["id"],
                name=data["name"],
                description=data["description"],
                card_uuids=data["card_uuids"],
                list_type=data.get("list_type", "COLLECTION"),
                deck_data=data.get("deck_data"),
                # Note: created_at will be set to current time since we can't override it
            )

            db.add(shared_list)
            restored_count += 1

        db.commit()
        print(f"Restored {restored_count} shared lists")
        return restored_count

    except Exception as e:
        db.rollback()
        print(f"Restore failed: {e}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python backup_shared_lists.py [backup|restore] [filename]")
        sys.exit(1)

    action = sys.argv[1]
    filename = sys.argv[2] if len(sys.argv) > 2 else "shared_lists_backup.json"

    if action == "backup":
        backup_shared_lists(filename)
    elif action == "restore":
        restore_shared_lists(filename)
    else:
        print("Action must be 'backup' or 'restore'")
        sys.exit(1)
