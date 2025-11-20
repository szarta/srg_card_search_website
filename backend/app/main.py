"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from routers import cards
from routers import images
from routers import sitemap
from routers import card_meta
from routers import shared_lists
from routers import submissions
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

__version__ = "%(prog)s 1.0.0 (Rel: 07 Aug 2025)"
default_log_format = "%(filename)s:%(levelname)s:%(asctime)s] %(message)s"

# Get the directory where main.py lives
BASE_DIR = Path(__file__).resolve().parent

# Relative paths from the backend directory
IMAGES_ROOT = BASE_DIR / "images"
UPLOADS_ROOT = BASE_DIR / "uploads"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/images/thumbnails",
    StaticFiles(directory=str(IMAGES_ROOT / "thumbnails")),
    name="thumbnails",
)

app.mount(
    "/images/fullsize",
    StaticFiles(directory=str(IMAGES_ROOT / "fullsize")),
    name="fullsize",
)

app.mount(
    "/images/mobile",
    StaticFiles(directory=str(IMAGES_ROOT / "mobile")),
    name="mobile",
)


@app.get("/api/images/manifest", include_in_schema=False)
def get_image_manifest():
    """Return the image manifest for mobile app sync."""
    manifest_path = BASE_DIR / "images_manifest.json"
    if manifest_path.exists():
        return FileResponse(manifest_path, media_type="application/json")
    return {"error": "Manifest not found"}


@app.get("/api/cards/manifest", include_in_schema=False)
def get_cards_manifest():
    """Return the card database manifest for mobile app sync."""
    manifest_path = BASE_DIR / "db_manifest.json"
    if manifest_path.exists():
        return FileResponse(manifest_path, media_type="application/json")
    return {"error": "Manifest not found"}


@app.get("/api/cards/database", include_in_schema=False)
def get_cards_database():
    """Return the mobile card database file."""
    db_path = BASE_DIR / "srg_cards_mobile.db"
    if db_path.exists():
        return FileResponse(
            db_path,
            media_type="application/octet-stream",
            filename="srg_cards_mobile.db",
        )
    return {"error": "Database not found"}


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(os.path.join("static", "favicon.ico"))


app.include_router(cards.router)
app.include_router(images.router)
app.include_router(sitemap.router)
app.include_router(card_meta.router)
app.include_router(submissions.router, prefix="/api", tags=["submissions"])
app.include_router(shared_lists.router, prefix="/api", tags=["shared_lists"])
