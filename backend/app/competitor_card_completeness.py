#!/usr/bin/env python3
"""
competitor_card_completeness.py
:author: Brandon Arrendondo

:license: MIT
"""

import sys
import argparse
import logging
import yaml

__version__ = "%(prog)s 1.0.0 (Rel: 11 Dec 2025)"
default_log_format = "%(filename)s:%(levelname)s:%(asctime)s] %(message)s"

COMPETITOR_CARD_TYPES = [
    "SingleCompetitorCard",
    "TornadoCompetitorCard",
    "TrioCompetitorCard",
]


def read_yaml(path: str):
    with open(path) as f:
        return yaml.safe_load(f)


def analyze_competitor_cards(cards_data):
    """
    Analyze competitor cards for missing fields.

    Returns a dict with statistics for each field.
    """
    competitor_cards = [
        card for card in cards_data if card.get("card_type") in COMPETITOR_CARD_TYPES
    ]

    total_count = len(competitor_cards)

    # Track missing fields
    missing_rules_text = []
    missing_power = []
    missing_related_finishes = []

    for card in competitor_cards:
        if "rules_text" not in card or card.get("rules_text") == "":
            missing_rules_text.append(card)

        if "power" not in card:
            missing_power.append(card)

        if "related_finishes" not in card:
            missing_related_finishes.append(card)

    return {
        "total": total_count,
        "missing_rules_text": missing_rules_text,
        "missing_power": missing_power,
        "missing_related_finishes": missing_related_finishes,
    }


def print_statistics(stats, verbose=False):
    """Print statistics about missing fields."""
    total = stats["total"]

    print(f"\nTotal Competitor Cards: {total}")
    print("=" * 60)

    # Rules text statistics
    missing_rules = len(stats["missing_rules_text"])
    pct_missing_rules = (missing_rules / total * 100) if total > 0 else 0
    pct_complete_rules = 100 - pct_missing_rules
    print("\nRules Text:")
    print(f"  Complete: {total - missing_rules} ({pct_complete_rules:.1f}%)")
    print(f"  Missing:  {missing_rules} ({pct_missing_rules:.1f}%)")

    # Power statistics
    missing_pow = len(stats["missing_power"])
    pct_missing_pow = (missing_pow / total * 100) if total > 0 else 0
    pct_complete_pow = 100 - pct_missing_pow
    print("\nPower:")
    print(f"  Complete: {total - missing_pow} ({pct_complete_pow:.1f}%)")
    print(f"  Missing:  {missing_pow} ({pct_missing_pow:.1f}%)")

    # Related finishes statistics
    missing_finishes = len(stats["missing_related_finishes"])
    pct_missing_finishes = (missing_finishes / total * 100) if total > 0 else 0
    pct_complete_finishes = 100 - pct_missing_finishes
    print("\nRelated Finishes:")
    print(f"  Complete: {total - missing_finishes} ({pct_complete_finishes:.1f}%)")
    print(f"  Missing:  {missing_finishes} ({pct_missing_finishes:.1f}%)")

    # If verbose, print the names of cards missing each field
    if verbose:
        if missing_rules > 0:
            print(f"\n\nCards missing rules_text ({missing_rules}):")
            print("-" * 60)
            for card in stats["missing_rules_text"]:
                print(
                    f"  - {card.get('name', 'Unknown')} ({card.get('card_type', 'Unknown')})"
                )

        if missing_pow > 0:
            print(f"\n\nCards missing power ({missing_pow}):")
            print("-" * 60)
            for card in stats["missing_power"]:
                print(
                    f"  - {card.get('name', 'Unknown')} ({card.get('card_type', 'Unknown')})"
                )

        if missing_finishes > 0:
            print(f"\n\nCards missing related_finishes ({missing_finishes}):")
            print("-" * 60)
            for card in stats["missing_related_finishes"]:
                print(
                    f"  - {card.get('name', 'Unknown')} ({card.get('card_type', 'Unknown')})"
                )


def main(argv):
    parser = argparse.ArgumentParser(
        description="Analyze completeness of competitor cards in cards.yaml"
    )
    parser.add_argument("filepath", help="Path to cards.yaml file")

    parser.add_argument(
        "-v",
        "--verbose",
        help="Show detailed list of cards missing each field",
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

    cards_data = read_yaml(args.filepath)
    stats = analyze_competitor_cards(cards_data)
    print_statistics(stats, verbose=args.verbose)


if __name__ == "__main__":
    main(sys.argv[1:])
