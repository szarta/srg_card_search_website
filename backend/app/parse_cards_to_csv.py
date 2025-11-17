#!/usr/bin/env python3
"""
parse_cards_to_csv.py
:author: Brandon Arrendondo

:license: MIT
"""

import sys
import argparse
import logging
import yaml
import csv

__version__ = "%(prog)s 1.0.0"
default_log_format = "%(filename)s:%(levelname)s:%(asctime)s] %(message)s"


def read_yaml(path: str):
    with open(path) as f:
        return yaml.safe_load(f)


def sort_key(card):
    """Generate sort key: card_type, then card_number (if MainDeckCard), then name"""
    card_type = card.get("card_type", "")

    # Primary sort by card_type
    # Secondary sort by card number for MainDeckCard (None for others sorts last)
    if card_type == "MainDeckCard":
        card_number = card.get("deck_card_number", 999999)
    else:
        card_number = 999999  # Large number to sort non-MainDeckCards after MainDeckCards with same type

    # Tertiary sort by name alphabetically
    name = card.get("name", "").lower()

    return (card_type, card_number, name)


def main(argv):
    parser = argparse.ArgumentParser(description="Parse cards.yaml to CSV format")
    parser.add_argument("input_file", help="Path to cards.yaml file")
    parser.add_argument(
        "-o",
        "--output",
        default="cards.csv",
        help="Output CSV file (default: cards.csv)",
    )

    parser.add_argument(
        "-v", "--verbose", help="increase output verbosity", action="store_true"
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

    # Read YAML
    cards = read_yaml(args.input_file)
    logging.info(f"Loaded {len(cards)} cards from {args.input_file}")

    # Sort cards
    sorted_cards = sorted(cards, key=sort_key)

    # Write CSV
    fieldnames = [
        "name",
        "card_type",
        "card_number",
        "rules_text",
        "qty",
        "qty_tradeable",
        "qty_wanted",
    ]

    with open(args.output, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        for card in sorted_cards:
            row = {
                "name": card.get("name", ""),
                "card_type": card.get("card_type", ""),
                "card_number": card.get("deck_card_number", "")
                if card.get("card_type") == "MainDeckCard"
                else "",
                "rules_text": card.get("rules_text", ""),
                "qty": "",  # Empty for user to fill in
                "qty_tradeable": "",  # Empty for user to fill in
                "qty_wanted": "",  # Empty for user to fill in
            }
            writer.writerow(row)

    logging.info(f"Successfully wrote {len(sorted_cards)} cards to {args.output}")


if __name__ == "__main__":
    main(sys.argv[1:])
