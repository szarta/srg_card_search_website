"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://USERNAME:SECUREPASSWORD@localhost/srg_cards"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
