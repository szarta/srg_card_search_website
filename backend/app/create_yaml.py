#!/usr/bin/env python3
"""
    create_yaml.py
    :author: Brandon Arrendondo

    :license: MIT
"""
import sys
import argparse
import logging
import yaml

__version__ = "%(prog)s 1.0.0 (Rel: 14 Aug 2025)"
default_log_format = "%(filename)s:%(levelname)s:%(asctime)s] %(message)s"


def load_yaml(filepath):
    with open(filepath, "r") as f:
        return yaml.safe_load(f)


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("filepath")

    parser.add_argument("-v", "--verbose", help="increase output verbosity",
                        action="store_true")

    parser.add_argument("--version", action="version", version=__version__,
                        help="show the version and exit")

    args = parser.parse_args()

    logging.basicConfig(format=default_log_format)
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    else:
        logging.getLogger().setLevel(logging.INFO)

    y = load_yaml(args.filepath)
    for card in y:
        print(f'- name: "{card}"')
        print("  play_order: Lead")
        print("  atk_type: Submission")
        print("  card_type: MainDeckCard")
        print("  deck_card_number: 9")
        print("\n")


if __name__ == "__main__":
    main(sys.argv[1:])
