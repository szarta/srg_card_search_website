#!/usr/bin/env python3
"""
cards_without_rules.py
:author: Brandon Arrendondo

:license: MIT
"""

import sys
import argparse
import logging
import yaml

__version__ = "%(prog)s 1.0.0 (Rel: 04 Sep 2025)"
default_log_format = "%(filename)s:%(levelname)s:%(asctime)s] %(message)s"


def read_yaml(path: str):
    with open(path) as f:
        return yaml.safe_load(f)


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("filepath")

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

    y = read_yaml(args.filepath)
    comp_without_rules = []
    deck_card_without_rules = []
    for item in y:
        if "rules_text" not in item:
            if item["card_type"] == "SingleCompetitorCard":
                comp_without_rules.append(item)
            elif item["card_type"] == "MainDeckCard":
                deck_card_without_rules.append(item)

    print(len(deck_card_without_rules))
    for i in deck_card_without_rules:
        if i["deck_card_number"] == 11:
            print(i["name"])


if __name__ == "__main__":
    main(sys.argv[1:])
