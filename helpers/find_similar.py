#!/usr/bin/env python3
"""
find_similar.py
Find similar images based on pHash and ORB features from SQLite database
"""

import sqlite3
import numpy as np
import cv2
from collections import defaultdict


def hamming_distance(hash1, hash2):
    """Calculate Hamming distance between two hex strings."""
    if len(hash1) != len(hash2):
        return float("inf")

    xor_result = int(hash1, 16) ^ int(hash2, 16)
    return bin(xor_result).count("1")


def orb_similarity(features1, features2, threshold=0.75):
    """
    Calculate ORB feature similarity using brute force matcher.

    Returns:
        Number of good matches
    """
    if features1 is None or features2 is None:
        return 0

    # Features are already numpy arrays from database
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

    try:
        matches = bf.knnMatch(features1, features2, k=2)
    except:
        return 0

    # Apply ratio test (Lowe's ratio test)
    good_matches = 0
    for match_pair in matches:
        if len(match_pair) == 2:
            m, n = match_pair
            if m.distance < threshold * n.distance:
                good_matches += 1

    return good_matches


def load_cards_from_db(db_path):
    """Load all cards from the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT db_uuid, phash, orb_features FROM image_hashes")
    cards = []

    for row in cursor.fetchall():
        uuid, phash, orb_blob = row

        # Convert ORB blob back to numpy array
        orb_features = None
        if orb_blob:
            # Assuming 100 features x 32 bytes each
            orb_features = np.frombuffer(orb_blob, dtype=np.uint8).reshape(-1, 32)

        cards.append({"uuid": uuid, "phash": phash, "orb_features": orb_features})

    conn.close()
    return cards


def find_similar_hashes(db_path, output_file, phash_threshold=5, orb_threshold=30):
    """Find pairs of images with similar pHashes or ORB features."""

    print(f"Loading cards from database: {db_path}")
    cards = load_cards_from_db(db_path)
    print(f"Loaded {len(cards)} cards")

    # Group by similarity type
    phash_matches = defaultdict(list)
    orb_matches = []

    print("Comparing all pairs...")
    total_comparisons = len(cards) * (len(cards) - 1) // 2
    current = 0
    orb_checks = 0

    # Compare all pairs
    for i, card1 in enumerate(cards):
        for card2 in cards[i + 1 :]:
            current += 1
            if current % 10000 == 0:
                print(
                    f"Progress: {current}/{total_comparisons} (ORB checks: {orb_checks})"
                )

            # Check pHash similarity
            if card1["phash"] and card2["phash"]:
                distance = hamming_distance(card1["phash"], card2["phash"])
                if distance <= phash_threshold:
                    phash_matches[distance].append(
                        {
                            "uuid1": card1["uuid"],
                            "uuid2": card2["uuid"],
                            "phash1": card1["phash"],
                            "phash2": card2["phash"],
                            "distance": distance,
                        }
                    )

                    # ONLY check ORB if pHash is similar (distance <= 5)
                    if (
                        distance <= 5
                        and card1["orb_features"] is not None
                        and card2["orb_features"] is not None
                    ):
                        orb_checks += 1
                        orb_score = orb_similarity(
                            card1["orb_features"], card2["orb_features"]
                        )
                        if orb_score >= orb_threshold:
                            orb_matches.append(
                                {
                                    "uuid1": card1["uuid"],
                                    "uuid2": card2["uuid"],
                                    "orb_score": orb_score,
                                    "phash_distance": distance,
                                }
                            )

    print(f"Total ORB checks performed: {orb_checks}")

    # Write to file
    with open(output_file, "w") as f:
        f.write("=" * 60 + "\n")
        f.write("PERCEPTUAL HASH MATCHES\n")
        f.write("=" * 60 + "\n")

        for distance in sorted(phash_matches.keys()):
            f.write(f"\n{'='*60}\n")
            f.write(f"Hamming Distance: {distance}\n")
            f.write(f"{'='*60}\n\n")

            for pair in phash_matches[distance]:
                f.write(f"UUID1: {pair['uuid1']}\n")
                f.write(f"UUID2: {pair['uuid2']}\n")
                f.write(f"pHash1: {pair['phash1']}\n")
                f.write(f"pHash2: {pair['phash2']}\n")
                f.write("\n")

        f.write("\n" + "=" * 60 + "\n")
        f.write("ORB FEATURE MATCHES (for pHash distance <= 5 only)\n")
        f.write("=" * 60 + "\n\n")

        # Sort by score (highest first)
        orb_matches.sort(key=lambda x: x["orb_score"], reverse=True)

        for match in orb_matches:
            f.write(f"UUID1: {match['uuid1']}\n")
            f.write(f"UUID2: {match['uuid2']}\n")
            f.write(f"pHash Distance: {match['phash_distance']}\n")
            f.write(f"ORB Score: {match['orb_score']} good matches\n")
            f.write("\n")

        # Summary
        f.write(f"\n{'='*60}\n")
        f.write("SUMMARY\n")
        f.write(f"{'='*60}\n")
        f.write("pHash Matches:\n")
        for distance in sorted(phash_matches.keys()):
            f.write(f"  Distance {distance}: {len(phash_matches[distance])} pairs\n")
        f.write(
            f"\nORB Matches (pHash <= 5): {len(orb_matches)} pairs "
            f"(threshold: {orb_threshold} good matches)\n"
        )
        f.write(f"Total ORB checks performed: {orb_checks}\n")

    return phash_matches, orb_matches


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Find similar images in database")
    parser.add_argument(
        "-d",
        "--database",
        default="card_hashes.db",
        help="SQLite database file (default: card_hashes.db)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="similar_hashes.txt",
        help="Output file (default: similar_hashes.txt)",
    )
    parser.add_argument(
        "-p",
        "--phash-threshold",
        type=int,
        default=5,
        help="pHash Hamming distance threshold (default: 5)",
    )
    parser.add_argument(
        "-r",
        "--orb-threshold",
        type=int,
        default=30,
        help="ORB good matches threshold (default: 30)",
    )

    args = parser.parse_args()

    phash_matches, orb_matches = find_similar_hashes(
        args.database,
        args.output,
        phash_threshold=args.phash_threshold,
        orb_threshold=args.orb_threshold,
    )

    print(f"\nResults written to {args.output}")

    # Print summary to console
    print("\n=== SUMMARY ===")
    print("pHash Matches:")
    for distance in sorted(phash_matches.keys()):
        print(f"  Distance {distance}: {len(phash_matches[distance])} pairs")
    print(f"\nORB Matches (pHash <= 5): {len(orb_matches)} pairs")
