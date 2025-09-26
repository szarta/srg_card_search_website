#!/usr/bin/env python3
"""
get_urls.py
:author: Brandon Arrendondo

:license: MIT
"""

import sys
import argparse
import logging
from bs4 import BeautifulSoup
import yaml
from rapidfuzz import fuzz

__version__ = "%(prog)s 1.0.0 (Rel: 25 Sep 2025)"
default_log_format = "%(filename)s:%(levelname)s:%(asctime)s] %(message)s"


def fuzzy_match(name1, name2):
    # statistical fuzzy match using library rapidfuzz
    ratio = fuzz.ratio(name1.lower(), name2.lower())
    return ratio > 80  # threshold for a match


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("filepath")
    parser.add_argument("number")
    parser.add_argument("cards_yaml")

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

    link_data = []
    with open(args.filepath, "r") as f:
        html_page = f.read()

        soup = BeautifulSoup(html_page, "html.parser")
        for link in soup.findAll("a"):
            # Extract URL from href attribute
            url = link.get("href")
            # Extract text content (link text/name)
            text = link.get_text(strip=True)

            # Only add links that have both URL and text, and contain the specified number
            if url and text and args.number in url:
                link_info = {"url": url, "text": text}
                link_data.append(link_info)

    # Remove duplicates based on URL
    seen_urls = set()
    unique_links = []
    for link in link_data:
        if link["url"] not in seen_urls:
            seen_urls.add(link["url"])
            unique_links.append(link)

    # Find the name of the URL in cards_yaml
    with open(args.cards_yaml, "r") as f:
        cards_data = yaml.safe_load(f)

    cards_in_play = {}
    for card in cards_data:
        if "deck_card_number" in card and str(card["deck_card_number"]) == str(
            args.number
        ):
            cards_in_play[card["name"]] = card

    for link in unique_links:
        link_card_name = link["text"]  # Changed from "name" to "text"
        matched = False
        for yaml_card_name in cards_in_play.keys():
            # Fuzzy match link_card_name to yaml_card_name
            if fuzzy_match(link_card_name, yaml_card_name):
                # Uncomment for debug
                # print(f"Matched '{link_card_name}' to '{yaml_card_name}'")
                cards_in_play[yaml_card_name]["srgpc_url"] = link["url"]
                matched = True
                break
        if not matched:
            print(f"Card name '{link_card_name}' not found in cards.yaml")

    # Save cards.yaml
    with open(args.cards_yaml, "w") as f:
        yaml.dump(cards_data, f)


if __name__ == "__main__":
    main(sys.argv[1:])
