"""
Submissions router for missing cards and images
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import os
from pathlib import Path
import re
from datetime import datetime

from database import SessionLocal

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Ensure uploads directory exists
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)
MISSING_CARDS_DIR = UPLOADS_DIR / "missing_cards"
MISSING_IMAGES_DIR = UPLOADS_DIR / "missing_images"
MISSING_CARDS_DIR.mkdir(exist_ok=True)
MISSING_IMAGES_DIR.mkdir(exist_ok=True)


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and other issues"""
    # Remove any path components
    filename = os.path.basename(filename)
    # Replace spaces and special chars with underscores
    filename = re.sub(r"[^\w\s.-]", "", filename)
    filename = re.sub(r"[-\s]+", "_", filename)
    return filename.lower()


class MissingCardSubmission(BaseModel):
    card_name: str
    card_type: str
    rules_text: Optional[str] = None


@router.post("/submissions/missing-card")
async def submit_missing_card(
    payload: MissingCardSubmission, db: Session = Depends(get_db)
):
    """
    Submit a missing card for review.
    Saves submission details to a text file.
    """
    if not payload.card_name or not payload.card_name.strip():
        raise HTTPException(status_code=400, detail="Card name is required")

    if not payload.card_type or not payload.card_type.strip():
        raise HTTPException(status_code=400, detail="Card type is required")

    # Create a timestamp-based filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = sanitize_filename(payload.card_name)
    filename = f"{timestamp}_{safe_name}.txt"
    filepath = MISSING_CARDS_DIR / filename

    # Write submission to file
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"Submission Time: {datetime.now().isoformat()}\n")
            f.write(f"Card Name: {payload.card_name}\n")
            f.write(f"Card Type: {payload.card_type}\n")
            f.write(f"Rules Text: {payload.rules_text or '(none provided)'}\n")

        return {
            "success": True,
            "message": "Missing card submission received. Thank you!",
            "filename": filename,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save submission: {str(e)}"
        )


@router.post("/submissions/missing-image")
async def submit_missing_image(
    card_name: str = Form(...), image: UploadFile = File(...)
):
    """
    Submit a missing card image.
    Saves the image with the card name.
    """
    if not card_name or not card_name.strip():
        raise HTTPException(status_code=400, detail="Card name is required")

    if not image:
        raise HTTPException(status_code=400, detail="Image file is required")

    # Validate image type
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP"
        )

    # Get file extension
    ext = image.filename.split(".")[-1] if "." in image.filename else "jpg"

    # Create filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = sanitize_filename(card_name)
    filename = f"{timestamp}_{safe_name}.{ext}"
    filepath = MISSING_IMAGES_DIR / filename

    # Save the image
    try:
        contents = await image.read()
        with open(filepath, "wb") as f:
            f.write(contents)

        return {
            "success": True,
            "message": "Image submission received. Thank you!",
            "filename": filename,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")
