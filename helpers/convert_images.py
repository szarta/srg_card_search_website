#!/usr/bin/env python3
"""
Convert source images to WebP fullsize + thumbnails, named by YAML db_uuid.

- Map filenames -> card names -> YAML db_uuid (exact slug match, then fuzzy).
- Write outputs to OUT/fullsize/xx/{uuid}.webp and OUT/thumbnails/xx/{uuid}.webp
- Convert only if missing or source is newer.
- Never deletes source files.

Deps: pip install pillow pyyaml rapidfuzz
"""

from __future__ import annotations
import argparse
import csv
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml
from PIL import Image

try:
    from rapidfuzz import process, fuzz

    HAVE_RAPIDFUZZ = True
except Exception:
    # Fallback to difflib if rapidfuzz not available (slower/less accurate)
    HAVE_RAPIDFUZZ = False


IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        description="Convert images to WebP fullsize+thumbs named by YAML db_uuid."
    )
    ap.add_argument("--yaml", required=True, type=Path, help="Path to cards.yaml")
    ap.add_argument("--src", required=True, type=Path, help="Folder of source images")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("./images"),
        help="Output root (default ./images)",
    )
    ap.add_argument(
        "--thumb-height",
        type=int,
        default=200,
        help="Thumbnail height in px (default 200)",
    )
    ap.add_argument(
        "--quality", type=int, default=88, help="Fullsize WebP quality (default 88)"
    )
    ap.add_argument(
        "--thumb-quality",
        type=int,
        default=80,
        help="Thumbnail WebP quality (default 80)",
    )
    ap.add_argument(
        "--mobile-quality",
        type=int,
        default=75,
        help="Mobile WebP quality (default 75)",
    )
    ap.add_argument(
        "--cutoff",
        type=float,
        default=0.86,
        help="Fuzzy match cutoff (0-1, default 0.86)",
    )
    ap.add_argument(
        "--strip-leading-num",
        action="store_true",
        help="Strip a leading number (e.g., '12-...') from filename guess",
    )
    ap.add_argument("--report", type=Path, help="Optional CSV report path")
    ap.add_argument(
        "--dry-run", action="store_true", help="Print actions; do not write files"
    )
    return ap.parse_args()


# ---------- YAML & matching ----------


def load_cards(yaml_path: Path) -> List[dict]:
    data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "cards" in data:
        items = data["cards"]
    elif isinstance(data, list):
        items = data
    else:
        raise ValueError(
            "Unsupported YAML structure. Expect a list or a dict with key 'cards'."
        )
    cards: List[dict] = []
    for c in items:
        if not isinstance(c, dict):
            continue
        name = (c.get("name") or "").strip()
        uuid = (c.get("db_uuid") or "").strip()
        if name and uuid:
            cards.append(c)
    if not cards:
        raise ValueError("No valid cards with name + db_uuid found in YAML.")
    return cards


def slug(s: str) -> str:
    # Normalize like frontend slugify: lowercase, alnum+hyphen, no leading/trailing hyphens
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"(^-|-$)", "", s)
    return s


def build_indices(cards: List[dict]) -> Tuple[Dict[str, dict], List[str]]:
    slug_to_card: Dict[str, dict] = {}
    names: List[str] = []
    for c in cards:
        nm = str(c["name"]).strip()
        names.append(nm)
        slug_to_card[slug(nm)] = c
    return slug_to_card, names


def filename_to_guess(p: Path, strip_leading_num: bool) -> str:
    base = p.stem
    base = base.replace("_", " ").replace("-", " ")
    base = re.sub(r"\s+", " ", base).strip()
    if strip_leading_num:
        base = re.sub(r"^\d+\s*", "", base)  # drop leading digits + space
    return base


def match_card(
    guess: str,
    slug_index: Dict[str, dict],
    names: List[str],
    cutoff: float,
) -> Tuple[Optional[dict], float, str]:
    if not guess:
        return None, 0.0, ""
    # exact slug match
    sguess = slug(guess)
    if sguess in slug_index:
        c = slug_index[sguess]
        return c, 1.0, c["name"]
    # fuzzy match
    if HAVE_RAPIDFUZZ:
        m = process.extractOne(
            guess, names, scorer=fuzz.WRatio, score_cutoff=cutoff * 100
        )
        if m:
            best_name, score, _ = m
            return slug_index.get(slug(best_name)), score / 100.0, best_name
        return None, 0.0, ""
    else:
        # difflib fallback
        best = None
        score = 0.0
        for nm in names:
            s = similarity(guess.lower(), nm.lower())
            if s > score:
                score, best = s, nm
        if best and score >= cutoff:
            return slug_index.get(slug(best)), score, best
        return None, score, best or ""


def similarity(a: str, b: str) -> float:
    # difflib ratio [0..1]
    import difflib

    return difflib.SequenceMatcher(a=a, b=b).ratio()


# ---------- Image I/O ----------


def needs_build(src: Path, dst: Path) -> bool:
    if not dst.exists():
        return True
    return src.stat().st_mtime > dst.stat().st_mtime


def save_full(src: Path, dst: Path, quality: int, dry: bool) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dry:
        print(f"[DRY] FULL  -> {dst}")
        return
    with Image.open(src) as im:
        im = im.convert("RGB")
        im.save(dst, format="WEBP", quality=quality, method=6)


def save_thumb(src: Path, dst: Path, height: int, quality: int, dry: bool) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dry:
        print(f"[DRY] THUMB -> {dst}")
        return
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        if h == 0:
            new_h = height
            new_w = height
        else:
            new_h = height
            new_w = int(round(w * (height / float(h))))
        thumb = im.resize((max(1, new_w), max(1, new_h)), Image.Resampling.LANCZOS)
        thumb.save(dst, format="WEBP", quality=quality, method=6)


def save_mobile(src: Path, dst: Path, quality: int, dry: bool) -> None:
    """Save mobile-optimized version (same resolution as fullsize, lower quality)."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dry:
        print(f"[DRY] MOBILE -> {dst}")
        return
    with Image.open(src) as im:
        im = im.convert("RGB")
        im.save(dst, format="WEBP", quality=quality, method=6)


# ---------- Main ----------


def main() -> None:
    args = parse_args()

    if not args.yaml.is_file():
        print(f"ERROR: YAML not found: {args.yaml}", file=sys.stderr)
        sys.exit(2)
    if not args.src.is_dir():
        print(f"ERROR: src not a directory: {args.src}", file=sys.stderr)
        sys.exit(2)

    cards = load_cards(args.yaml)
    slug_index, names = build_indices(cards)

    images = [
        p for p in args.src.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS
    ]
    images.sort()

    out_full_root = args.out / "fullsize"
    out_thumb_root = args.out / "thumbnails"
    out_mobile_root = args.out / "mobile"
    out_full_root.mkdir(parents=True, exist_ok=True)
    out_thumb_root.mkdir(parents=True, exist_ok=True)
    out_mobile_root.mkdir(parents=True, exist_ok=True)

    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)

    mapped = 0
    skipped = 0
    converted = 0

    report_rows: List[List[str]] = []
    if args.report:
        report_rows.append(
            ["source", "guess", "matched_name", "uuid", "score", "action"]
        )

    for src in images:
        guess = filename_to_guess(src, strip_leading_num=args.strip_leading_num)
        card, score, mname = match_card(guess, slug_index, names, cutoff=args.cutoff)

        if not card:
            print(f"[SKIP] No match: {src.name} | guess='{guess}' score={score:.2f}")
            skipped += 1
            if args.report:
                report_rows.append(
                    [str(src), guess, mname, "", f"{score:.2f}", "NO_MATCH"]
                )
            continue

        uuid = str(card["db_uuid"]).strip()
        if not uuid:
            print(f"[SKIP] Match has no db_uuid: {mname}")
            skipped += 1
            if args.report:
                report_rows.append(
                    [str(src), guess, mname, "", f"{score:.2f}", "NO_UUID"]
                )
            continue

        shard = uuid[:2]
        dst_full = out_full_root / shard / f"{uuid}.webp"
        dst_thumb = out_thumb_root / shard / f"{uuid}.webp"
        dst_mobile = out_mobile_root / shard / f"{uuid}.webp"

        action = []
        if needs_build(src, dst_full):
            save_full(src, dst_full, quality=args.quality, dry=args.dry_run)
            action.append("FULL")
            converted += 1
        if needs_build(src, dst_thumb):
            save_thumb(
                src,
                dst_thumb,
                height=args.thumb_height,
                quality=args.thumb_quality,
                dry=args.dry_run,
            )
            action.append("THUMB")
            converted += 1
        if needs_build(src, dst_mobile):
            save_mobile(src, dst_mobile, quality=args.mobile_quality, dry=args.dry_run)
            action.append("MOBILE")
            converted += 1

        mapped += 1
        act = "+".join(action) if action else "SKIP_UP_TO_DATE"
        print(
            f"[OK] {src.name} -> {shard}/{uuid}.webp | match='{mname}' ({score:.2f}) | {act}"
        )

        if args.report:
            report_rows.append([str(src), guess, mname, uuid, f"{score:.2f}", act])

    print("\nSummary:")
    print(f"  Considered:      {len(images)}")
    print(f"  Mapped:          {mapped}")
    print(f"  Converted files: {converted}")
    print(f"  Unmatched:       {skipped}")
    print(f"  Output root:     {args.out}")

    if args.report:
        with args.report.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerows(report_rows)
        print(f"  Report:          {args.report}")


if __name__ == "__main__":
    main()
