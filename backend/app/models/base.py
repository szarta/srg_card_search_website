"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

from sqlalchemy import (
    Column,
    String,
    Boolean,
    Enum,
    Integer,
    ForeignKey,
    Table,
    DateTime,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.postgresql import ARRAY, TEXT, JSONB
from sqlalchemy.sql import func
import enum
import uuid

Base = declarative_base()


class CardType(str, enum.Enum):
    main_deck = "MainDeckCard"
    single_competitor = "SingleCompetitorCard"
    tornado_competitor = "TornadoCompetitorCard"
    trio_competitor = "TrioCompetitorCard"
    entrance = "EntranceCard"
    spectacle = "SpectacleCard"
    crowd_meter = "CrowdMeterCard"


class AttackSubtype(enum.Enum):
    Strike = "Strike"
    Grapple = "Grapple"
    Submission = "Submission"


class PlayOrderSubtype(enum.Enum):
    Lead = "Lead"
    Followup = "Followup"
    Finish = "Finish"


related_cards_table = Table(
    "related_cards",
    Base.metadata,
    Column("card_id", String, ForeignKey("cards.db_uuid"), primary_key=True),
    Column("related_card_id", String, ForeignKey("cards.db_uuid"), primary_key=True),
)

related_finishes_table = Table(
    "related_finishes",
    Base.metadata,
    Column(
        "competitor_id",
        String,
        ForeignKey("competitor_cards.db_uuid"),
        primary_key=True,
    ),
    Column(
        "finish_card_id",
        String,
        ForeignKey("main_deck_cards.db_uuid"),
        primary_key=True,
    ),
)


class Card(Base):
    __tablename__ = "cards"
    db_uuid = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    srg_url = Column(String)
    srgpc_url = Column(String)
    release_set = Column(String)
    is_banned = Column(Boolean, default=False)
    spotlight = Column(Boolean, default=False)
    rules_text = Column(String)
    errata_text = Column(String)
    comments = Column(String)
    tags = Column(ARRAY(TEXT), nullable=True)
    # Structured requirements, e.g. [{"min_strike": 8}, {"min_agility": 9}].
    # Open-ended list so freeform (non-skill) requirements can be added later.
    requirements = Column(JSONB, nullable=True)
    card_type = Column(String)

    # Configure polymorphic mapping
    __mapper_args__ = {
        "polymorphic_identity": "Card",
        "polymorphic_on": card_type,
        "with_polymorphic": "*",
    }

    related_cards = relationship(
        "Card",
        secondary=related_cards_table,
        primaryjoin=db_uuid == related_cards_table.c.card_id,
        secondaryjoin=db_uuid == related_cards_table.c.related_card_id,
    )


class MainDeckCard(Card):
    __tablename__ = "main_deck_cards"
    db_uuid = Column(String, ForeignKey("cards.db_uuid"), primary_key=True)
    deck_card_number = Column(Integer)
    atk_type = Column(Enum(AttackSubtype))
    play_order = Column(Enum(PlayOrderSubtype))
    rules = Column(String)

    __mapper_args__ = {
        "polymorphic_identity": "MainDeckCard",
    }


class CompetitorCard(Card):
    __tablename__ = "competitor_cards"
    db_uuid = Column(String, ForeignKey("cards.db_uuid"), primary_key=True)
    power = Column(Integer)
    agility = Column(Integer)
    strike = Column(Integer)
    submission = Column(Integer)
    grapple = Column(Integer)
    technique = Column(Integer)
    division = Column(String, nullable=True)

    __mapper_args__ = {
        "polymorphic_identity": "CompetitorCard",
    }

    related_finishes = relationship(
        "MainDeckCard", secondary=related_finishes_table, backref="finishers_for"
    )


class SingleCompetitorCard(CompetitorCard):
    __tablename__ = "single_competitor_cards"
    db_uuid = Column(String, ForeignKey("competitor_cards.db_uuid"), primary_key=True)

    __mapper_args__ = {
        "polymorphic_identity": "SingleCompetitorCard",
    }


class TornadoCompetitorCard(CompetitorCard):
    __tablename__ = "tornado_competitor_cards"
    db_uuid = Column(String, ForeignKey("competitor_cards.db_uuid"), primary_key=True)

    __mapper_args__ = {
        "polymorphic_identity": "TornadoCompetitorCard",
    }


class TrioCompetitorCard(CompetitorCard):
    __tablename__ = "trio_competitor_cards"
    db_uuid = Column(String, ForeignKey("competitor_cards.db_uuid"), primary_key=True)

    __mapper_args__ = {
        "polymorphic_identity": "TrioCompetitorCard",
    }


class EntranceCard(Card):
    __tablename__ = "entrance_cards"
    db_uuid = Column(String, ForeignKey("cards.db_uuid"), primary_key=True)

    __mapper_args__ = {
        "polymorphic_identity": "EntranceCard",
    }


class SpectacleCard(Card):
    __tablename__ = "spectacle_cards"
    db_uuid = Column(String, ForeignKey("cards.db_uuid"), primary_key=True)

    __mapper_args__ = {
        "polymorphic_identity": "SpectacleCard",
    }


class CrowdMeterCard(Card):
    __tablename__ = "crowd_meter_cards"
    db_uuid = Column(String, ForeignKey("cards.db_uuid"), primary_key=True)

    __mapper_args__ = {
        "polymorphic_identity": "CrowdMeterCard",
    }


class SharedListType(str, enum.Enum):
    collection = "COLLECTION"
    deck = "DECK"


class SharedList(Base):
    __tablename__ = "shared_lists"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    card_uuids = Column(ARRAY(String), nullable=False)
    list_type = Column(
        Enum(SharedListType, name="shared_list_type_enum"),
        nullable=False,
        default=SharedListType.collection,
    )
    deck_data = Column(
        JSON, nullable=True
    )  # Stores deck structure when list_type is DECK
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<SharedList(id='{self.id}', name='{self.name}', type='{self.list_type}', cards={len(self.card_uuids or [])})>"


# ---------------------------------------------------------------------------
# Run It Back — logged-in gameplay section.
#
# These tables are additive and login-gated; the public card-search site never
# touches them. They are created by create_rib_tables.py (checkfirst, no drop),
# NOT by create_db.py.
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "rib_users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(320), nullable=False, unique=True)
    # SHA-256 hex of a 256-bit URL-safe access key. Keys are hand-minted and
    # high-entropy, so a plain hash (no bcrypt) is sufficient. Raw key is never
    # stored; it is shown once by mint_user.py.
    key_hash = Column(String(64), nullable=False, unique=True, index=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    decks = relationship("Deck", back_populates="owner", cascade="all, delete-orphan")
    records = relationship(
        "GameRecord", back_populates="owner", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(id='{self.id}', email='{self.email}', active={self.active})>"


class Deck(Base):
    __tablename__ = "rib_decks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("rib_users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    # Same slot structure used by SharedList.deck_data (see
    # schemas/shared_list_schema.py DeckData): spectacle_type + slots[].
    deck_data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User", back_populates="decks")

    def __repr__(self):
        return f"<Deck(id='{self.id}', user_id='{self.user_id}', name='{self.name}')>"


class GameRecord(Base):
    """A saved, replayable game.

    Two information shapes share this table (see the Run It Back record design):

    - ``full`` — a site-run game. Engine-authoritative and re-simulatable: the
      ``snapshot`` string (from ``WasmSession.snapshot()``) is a self-contained,
      version-stamped seed that ``restore()`` rebuilds byte-for-byte, and it
      embeds decks + seed + seats + every decision. ``decisions``/``seed`` are
      kept alongside as queryable, portable metadata.
    - ``observer`` — an imported real-life / other-platform game. Only publicly
      observable data: an ordered ``frames`` sequence (per-step public state +
      action), no hidden zones and no seed, so it is NOT re-simulatable and is
      played back frame-by-frame.

    ``owner_id`` is nullable: site games belong to the player, but public /
    imported games may be ownerless. ``visibility`` gates the public archive
    (task 19); the public/observer projection is effectively an interchange
    format, so keep it clean.
    """

    __tablename__ = "rib_game_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String, ForeignKey("rib_users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 'full' (site-run, re-simulatable) | 'observer' (imported, playback only)
    information_view = Column(String(16), nullable=False, default="full")
    # 'private' (owner only) | 'public' (browsable/replayable by anyone)
    visibility = Column(String(16), nullable=False, default="private")
    # 'site' (played here) | 'import' (user-produced archive)
    source = Column(String(16), nullable=False, default="site")

    # Engine/schema stamp the record was produced with (replay fidelity needs
    # it) — the `version()` / `srg info` schemas object.
    engine_version = Column(JSON, nullable=True)
    # { winner, reason, turns }
    result = Column(JSON, nullable=False)
    # Display metadata: { A: {competitor, deck_name}, B: {competitor, policy} }
    participants = Column(JSON, nullable=True)

    # u64 seed stored as a string to avoid JS/JSON integer-precision loss.
    seed = Column(String(32), nullable=True)
    # Ordered human decision indices (full games) — replay without the engine.
    decisions = Column(JSON, nullable=True)
    # Self-contained engine snapshot string (full games).
    snapshot = Column(Text, nullable=True)
    # Ordered observable frames (observer games) — playback source.
    frames = Column(JSON, nullable=True)
    # Provenance for imported archives: the record's `meta` block
    # ({created, source, match_type, notes}) — where a real-life game was played
    # and who transcribed it. Null for site games.
    meta = Column(JSON, nullable=True)

    owner = relationship("User", back_populates="records")

    def __repr__(self):
        return (
            f"<GameRecord(id='{self.id}', view='{self.information_view}', "
            f"visibility='{self.visibility}')>"
        )
