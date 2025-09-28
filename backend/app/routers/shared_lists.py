"""
Shared Lists router for creating and retrieving shareable card lists
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from models.base import SharedList, Card
from database import SessionLocal
from schemas.shared_list_schema import (
    SharedListCreate,
    SharedListResponse,
    SharedListCreateResponse,
)

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/shared-lists", response_model=SharedListCreateResponse)
def create_shared_list(payload: SharedListCreate, db: Session = Depends(get_db)):
    """
    Create a new shareable list from card UUIDs.
    """
    if not payload.card_uuids:
        raise HTTPException(
            status_code=400, detail="At least one card UUID is required"
        )

    # Validate that all UUIDs exist in the database
    existing_cards = (
        db.query(Card.db_uuid).filter(Card.db_uuid.in_(payload.card_uuids)).all()
    )
    existing_uuids = {row.db_uuid for row in existing_cards}
    missing_uuids = [uuid for uuid in payload.card_uuids if uuid not in existing_uuids]

    if missing_uuids:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid card UUIDs: {', '.join(missing_uuids[:5])}",  # Limit error message length
        )

    # Create the shared list
    shared_list = SharedList(
        name=payload.name,
        description=payload.description,
        card_uuids=payload.card_uuids,
    )

    try:
        db.add(shared_list)
        db.commit()
        db.refresh(shared_list)

        return SharedListCreateResponse(
            id=shared_list.id, url=f"/create-list?shared={shared_list.id}"
        )
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create shared list")


@router.get("/shared-lists/{shared_id}", response_model=SharedListResponse)
def get_shared_list(shared_id: str, db: Session = Depends(get_db)):
    """
    Retrieve a shared list by ID.
    """
    shared_list = db.query(SharedList).filter(SharedList.id == shared_id).first()

    if not shared_list:
        raise HTTPException(status_code=404, detail="Shared list not found")

    return shared_list


@router.delete("/shared-lists/{shared_id}")
def delete_shared_list(shared_id: str, db: Session = Depends(get_db)):
    """
    Delete a shared list (optional endpoint for cleanup).
    """
    shared_list = db.query(SharedList).filter(SharedList.id == shared_id).first()

    if not shared_list:
        raise HTTPException(status_code=404, detail="Shared list not found")

    try:
        db.delete(shared_list)
        db.commit()
        return {"message": "Shared list deleted successfully"}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete shared list")


@router.get("/shared-lists", response_model=List[SharedListResponse])
def list_shared_lists(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):
    """
    List recent shared lists (optional, for admin/debugging).
    """
    lists = (
        db.query(SharedList)
        .order_by(SharedList.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return lists
