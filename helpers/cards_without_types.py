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
    card_types = {}
    for item in y:
        card_type = item["card_type"]
        if card_type not in card_types.keys():
            card_types[card_type] = 0

        card_types[card_type] += 1

    print(card_types)


if __name__ == "__main__":
    main(sys.argv[1:])
