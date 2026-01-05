#!/usr/bin/env python3
"""
word_occurrences.py
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


def parse_words_from_name(name):
    ret_arr = []
    arr = name.split(" ")
    for word in arr:
        real_word = word.lower()
        real_word = real_word.replace("!", "")
        real_word = real_word.replace("?", "")
        real_word = real_word.replace("(", "")
        real_word = real_word.replace(")", "")
        real_word = real_word.replace(".", "")
        if len(real_word) > 3:
            ret_arr.append(real_word)

    return ret_arr


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
    keyword_dict = {}
    for item in y:
        name = item["name"]
        card_type = item["card_type"]
        if card_type == "MainDeckCard":
            keyword_arr = parse_words_from_name(name)
            for kw in keyword_arr:
                if kw not in keyword_dict:
                    keyword_dict[kw] = 0

                keyword_dict[kw] += 1

    sorted_dict_desc = {
        k: v
        for k, v in sorted(keyword_dict.items(), key=lambda item: item[1], reverse=True)
    }
    print(sorted_dict_desc)
    # print(keyword_dict["trap"])


if __name__ == "__main__":
    main(sys.argv[1:])
