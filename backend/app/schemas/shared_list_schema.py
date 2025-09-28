"""
Shared List schemas for API requests/responses
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class SharedListCreate(BaseModel):
    name: Optional[str] = Field(None, max_length=255, description="Optional list name")
    description: Optional[str] = Field(None, description="Optional list description")
    card_uuids: List[str] = Field(..., description="List of card UUIDs")


class SharedListResponse(BaseModel):
    id: str
    name: Optional[str]
    description: Optional[str]
    card_uuids: List[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SharedListCreateResponse(BaseModel):
    id: str
    url: str
    message: str = "Shareable list created successfully"
