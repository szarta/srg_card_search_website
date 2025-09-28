"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

from sqlalchemy import create_engine
from models.base import (
    Base,
    SharedList,
)  # This should import all your model classes  # noqa: F401
from sqlalchemy_utils import database_exists, create_database

DATABASE_URL = "postgresql://USERNAME:SECUREPASSWORD@localhost/srg_cards"
engine = create_engine(DATABASE_URL)

if not database_exists(engine.url):
    create_database(engine.url)
    print("Created database.")

print("Dropping all tables...")
Base.metadata.drop_all(engine)

print("Recreating all tables...")
Base.metadata.create_all(engine)

print("Done.")
