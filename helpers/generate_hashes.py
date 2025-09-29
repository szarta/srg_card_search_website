#!/usr/bin/env python3
"""
generate_hashes.py
:author: Brandon Arrendondo

:license: MIT
"""

import sys
import argparse
import logging
import imagehash
import os
import glob
import cv2
import sqlite3
from PIL import Image

__version__ = "%(prog)s 3.0.0 (Rel: 29 Sep 2025)"
default_log_format = "%(filename)s:%(levelname)s:%(asctime)s] %(message)s"


def create_database(db_path):
    """Create the SQLite database with optimized schema."""
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS image_hashes (
            db_uuid TEXT PRIMARY KEY,
            phash TEXT NOT NULL,
            orb_features BLOB
        )
    """)

    # Index on phash for faster lookups
    c.execute("CREATE INDEX IF NOT EXISTS idx_phash ON image_hashes(phash)")

    conn.commit()
    return conn


def get_perceptual_hash(image_path, hash_size=8):
    """Generate perceptual hash for an image."""
    try:
        img = Image.open(image_path)
        phash = imagehash.phash(img, hash_size=hash_size)
        return str(phash)
    except Exception as e:
        logging.error(f"Error processing {image_path}: {e}")
        return None


def get_orb_features(image_path, n_features=100):
    """
    Extract ORB features from an image.

    Returns:
        numpy array of descriptors or None
    """
    try:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return None

        orb = cv2.ORB_create(nfeatures=n_features)
        keypoints, descriptors = orb.detectAndCompute(img, None)

        return descriptors
    except Exception as e:
        logging.error(f"Error extracting ORB features from {image_path}: {e}")
        return None


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("dirpath", help="Directory containing images")
    parser.add_argument(
        "-o",
        "--output",
        default="card_hashes.db",
        help="Output SQLite database file (default: card_hashes.db)",
    )
    parser.add_argument(
        "-n",
        "--nfeatures",
        type=int,
        default=100,
        help="Number of ORB features to extract (default: 100)",
    )
    parser.add_argument(
        "-v", "--verbose", help="Increase output verbosity", action="store_true"
    )
    parser.add_argument(
        "--version",
        action="version",
        version=__version__,
        help="Show the version and exit",
    )

    args = parser.parse_args()

    logging.basicConfig(format=default_log_format)
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    else:
        logging.getLogger().setLevel(logging.INFO)

    # Create database
    print(f"Creating database: {args.output}")
    conn = create_database(args.output)
    cursor = conn.cursor()

    pattern = os.path.join(args.dirpath, "**", "*.webp")
    files = list(glob.glob(pattern, recursive=True))

    print(f"Found {len(files)} images to process")

    processed = 0
    failed = 0

    for i, filepath in enumerate(files, 1):
        uuid = os.path.splitext(os.path.basename(filepath))[0]

        # Get pHash
        phash = get_perceptual_hash(filepath)
        if not phash:
            failed += 1
            continue

        # Get ORB features
        orb_descriptors = get_orb_features(filepath, n_features=args.nfeatures)
        orb_blob = orb_descriptors.tobytes() if orb_descriptors is not None else None

        # Insert into database
        try:
            cursor.execute(
                "INSERT OR REPLACE INTO image_hashes (db_uuid, phash, orb_features) VALUES (?, ?, ?)",
                (uuid, phash, orb_blob),
            )
            processed += 1

            if args.verbose:
                orb_count = len(orb_descriptors) if orb_descriptors is not None else 0
                logging.debug(
                    f"[{i}/{len(files)}] {uuid}: phash={phash}, orb_features={orb_count}"
                )
            elif i % 100 == 0:
                print(f"Progress: {i}/{len(files)}")

        except sqlite3.Error as e:
            logging.error(f"Database error for {uuid}: {e}")
            failed += 1

    conn.commit()
    conn.close()

    print("\nCompleted!")
    print(f"Successfully processed: {processed}")
    print(f"Failed: {failed}")
    print(f"Database size: {os.path.getsize(args.output) / (1024*1024):.2f} MB")


if __name__ == "__main__":
    main(sys.argv[1:])
