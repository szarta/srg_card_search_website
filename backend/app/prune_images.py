#!/usr/bin/env python3
import sys
import argparse
import logging
import yaml
import os
import glob

__version__ = "%(prog)s 1.0.0 (Rel: 04 Sep 2025)"
default_log_format = "%(filename)s:%(levelname)s:%(asctime)s] %(message)s"


def read_yaml(path: str):
    with open(path) as f:
        return yaml.safe_load(f)


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("cards")

    parser.add_argument(
        "-v", "--verbose", help="increase output verbosity", action="store_true"
    )

    parser.add_argument(
        "--dry-run",
        help="show what would be deleted without actually deleting",
        action="store_true",
    )

    parser.add_argument(
        "--version",
        action="version",
        version=__version__,
        help="show the version and exit",
    )

    args = parser.parse_args()

    logging.basicConfig(format=default_log_format)
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    else:
        logging.getLogger().setLevel(logging.INFO)

    cards_yaml = read_yaml(args.cards)

    db_uuids = []
    for item in cards_yaml:
        db_uuid = item["db_uuid"]
        db_uuids.append(db_uuid)

    deleted_count = 0
    for item in glob.glob(os.path.join("images", "**", "*.webp"), recursive=True):
        if "image_unavailable.webp" in item:
            continue

        db_uuid = os.path.basename(item).replace(".webp", "")
        if db_uuid not in db_uuids:
            if args.dry_run:
                print(f"[DRY RUN] Would delete: {item}")
            else:
                print(f"Deleting: {item}")
                os.unlink(item)
            deleted_count += 1

    if args.dry_run:
        print(f"\n[DRY RUN] Would delete {deleted_count} file(s)")
    else:
        print(f"\nDeleted {deleted_count} file(s)")


if __name__ == "__main__":
    main(sys.argv[1:])
