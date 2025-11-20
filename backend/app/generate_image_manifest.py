#!/usr/bin/env python3
"""
Generate images_manifest.yaml with SHA-256 hashes for all mobile images.

Usage:
    python3 generate_image_manifest.py

Output:
    images_manifest.yaml in the same directory
"""

import os
import hashlib
import json
from pathlib import Path
from datetime import datetime

IMAGES_DIR = Path(__file__).parent / "images" / "mobile"
OUTPUT_FILE = Path(__file__).parent / "images_manifest.json"


def sha256_file(filepath):
    """Calculate SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def generate_manifest():
    """Scan mobile images and generate manifest with hashes."""
    images = {}

    print(f"Scanning images in {IMAGES_DIR}...")

    # Walk through all subdirectories (organized by first 2 chars of UUID)
    for root, dirs, files in os.walk(IMAGES_DIR):
        for filename in files:
            if filename.endswith(".webp"):
                filepath = Path(root) / filename
                uuid = filename.replace(".webp", "")

                # Calculate hash
                file_hash = sha256_file(filepath)

                # Get relative path from mobile dir (e.g., "ab/abc123.webp")
                rel_path = filepath.relative_to(IMAGES_DIR)

                images[uuid] = {"path": str(rel_path), "hash": file_hash}

    # Create manifest
    manifest = {
        "version": 1,
        "generated": datetime.now().isoformat(),
        "image_count": len(images),
        "images": images,
    }

    # Write JSON
    with open(OUTPUT_FILE, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"Generated manifest with {len(images)} images")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    generate_manifest()
