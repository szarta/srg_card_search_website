#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path


def csv_to_json(csv_path: str, json_path: str | None = None):
    """
    Convert an exported CSV (with a 'name' column) into a JSON file:
    { "names": ["Card1", "Card2", ...] }
    """
    csv_file = Path(csv_path)
    if json_path is None:
        json_file = csv_file.with_suffix(".json")
    else:
        json_file = Path(json_path)

    names = []
    with csv_file.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if "name" not in reader.fieldnames:
            raise ValueError(f"CSV is missing 'name' column: {reader.fieldnames}")
        for row in reader:
            nm = (row.get("name") or "").strip()
            if nm:
                names.append(nm)

    payload = {"names": names}
    with json_file.open("w", encoding="utf-8") as out:
        json.dump(payload, out, indent=2, ensure_ascii=False)

    print(f"Wrote {len(names)} names → {json_file}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: csv_to_listjson.py input.csv [output.json]")
        sys.exit(1)
    csv_to_json(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
