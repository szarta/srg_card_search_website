"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

from fastapi import APIRouter

router = APIRouter()

IMAGES_BASE_URL = "/images"


def build_image_url(db_uuid: str, size: str) -> str:
    subfolder = db_uuid[:2]
    return f"{IMAGES_BASE_URL}/{size}/{subfolder}/{db_uuid}.png"


@router.get("/cards/{db_uuid}/images")
async def get_card_images(db_uuid: str):
    # Optional: Validate db_uuid format here

    thumbnail_url = build_image_url(db_uuid, "thumbnails")
    fullsize_url = build_image_url(db_uuid, "fullsize")

    # Optional: check if files exist on disk; skipping here for simplicity

    return {
        "db_uuid": db_uuid,
        "thumbnail_url": thumbnail_url,
        "fullsize_url": fullsize_url,
    }
