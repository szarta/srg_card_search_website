#!/usr/bin/env python3
"""
Convert fullsize images to mobile-optimized versions.
Only converts images that don't exist in mobile directory.
"""

import os
from pathlib import Path
from PIL import Image

FULLSIZE_DIR = Path(__file__).parent / "images" / "fullsize"
MOBILE_DIR = Path(__file__).parent / "images" / "mobile"
QUALITY = 75
MAX_SIZE = (800, 1120)  # Mobile-optimized size


def convert_missing():
    """Convert fullsize images that don't have mobile versions."""

    # Get existing mobile images
    mobile_files = set()
    for root, dirs, files in os.walk(MOBILE_DIR):
        for f in files:
            if f.endswith(".webp"):
                mobile_files.add(f)

    # Find and convert missing
    converted = 0
    for root, dirs, files in os.walk(FULLSIZE_DIR):
        for filename in files:
            if filename.endswith(".webp") and filename not in mobile_files:
                src = Path(root) / filename

                # Create output directory structure
                rel_dir = Path(root).relative_to(FULLSIZE_DIR)
                out_dir = MOBILE_DIR / rel_dir
                out_dir.mkdir(parents=True, exist_ok=True)

                dst = out_dir / filename

                try:
                    with Image.open(src) as img:
                        # Resize if larger than max
                        img.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
                        img.save(dst, "WEBP", quality=QUALITY)
                        converted += 1
                        print(f"Converted: {filename}")
                except Exception as e:
                    print(f"Error converting {filename}: {e}")

    print(f"\nConverted {converted} images to mobile format")


if __name__ == "__main__":
    convert_missing()
