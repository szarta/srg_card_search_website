#!/usr/bin/env python3
"""
One-time migration: parse "Skill Requirement: <Skill> <N>+" out of each card's
rules_text and add a structured `requirements:` list to cards.yaml.

Each parsed skill requirement becomes an entry like `{min_strike: 8}`. Cards can
have multiple skill requirements (multiple list entries). The list is intentionally
open-ended so freeform / non-skill requirements can be added by hand later.

rules_text is left untouched — the printed card text is preserved verbatim. Run
once, then maintain `requirements:` in the YAML directly (the loader reads it like
`tags`; it does NOT re-derive it from rules_text).

Usage:
    python add_requirements.py [input.yaml] [output.yaml]
Defaults to editing cards.yaml in place.
"""

import re
import sys

from load_cards_from_yaml import read_yaml, write_yaml, reorder_dict_keys

SKILLS = ["power", "technique", "agility", "strike", "submission", "grapple"]
_SKILL_ALT = "|".join(SKILLS)

# A skill requirement clause: one or more "<Skill> <N>[+]" separated by commas,
# introduced by "Skill Requirement:" (case-insensitive, tolerant of extra spaces).
_CLAUSE = r"(?:%s)\s*\d+\+?" % _SKILL_ALT
_REQ_RE = re.compile(
    r"Skill Requirement:\s*(%s(?:\s*,\s*%s)*)" % (_CLAUSE, _CLAUSE),
    re.IGNORECASE,
)
_PART_RE = re.compile(r"(%s)\s*(\d+)" % _SKILL_ALT, re.IGNORECASE)


def parse_requirements(rules_text: str) -> list[dict]:
    """Extract skill requirements from a card's rules_text.

    Returns a list like [{"min_strike": 8}, {"min_agility": 9}], preserving the
    order the skills appear on the card. Returns [] when there are none.
    """
    if not rules_text:
        return []

    reqs: list[dict] = []
    for m in _REQ_RE.finditer(rules_text):
        # Skip references to another card's *name*, e.g.
        #   ...unblank your "Skill Requirement: Submission 10+, Technique 9+" cards.
        # These are wrapped in double quotes; a real requirement is not.
        after = rules_text[m.end() : m.end() + 1]
        if after == '"':
            continue
        for skill, value in _PART_RE.findall(m.group(1)):
            reqs.append({f"min_{skill.lower()}": int(value)})
    return reqs


def main(inp: str, out: str):
    data = read_yaml(inp)
    changed = 0
    for entry in data:
        reqs = parse_requirements(entry.get("card_text", ""))
        if reqs:
            entry["requirements"] = reqs
            changed += 1
        # Reorder so `requirements` lands in its canonical slot (after tags).
        idx = data.index(entry)
        data[idx] = reorder_dict_keys(entry)

    write_yaml(data, out)
    print(f"[DONE] Added requirements to {changed} card(s).")


if __name__ == "__main__":
    inp = sys.argv[1] if len(sys.argv) > 1 else "cards.yaml"
    out = sys.argv[2] if len(sys.argv) > 2 else inp
    main(inp, out)
