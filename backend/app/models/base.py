"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

from sqlalchemy import Column, String, Boolean, Enum, Integer, ForeignKey, Table
from sqlalchemy.orm import relationship, declarative_base
import enum

Base = declarative_base()


class Gender(str, enum.Enum):
    male = "Male"
    female = "Female"
    ambiguous = "Ambiguous"


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
    release_set = Column(String)
    is_banned = Column(Boolean, default=False)
    rules_text = Column(String)
    errata_text = Column(String)
    comments = Column(String)
    tags = Column(String)
    card_type = Column(String)

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

    related_finishes = relationship(
        "MainDeckCard", secondary=related_finishes_table, backref="finishers_for"
    )


class SingleCompetitorCard(CompetitorCard):
    __tablename__ = "single_competitor_cards"
    db_uuid = Column(String, ForeignKey("competitor_cards.db_uuid"), primary_key=True)
    gender = Column(Enum(Gender, name="gender_enum"), nullable=True)


class TornadoCompetitorCard(CompetitorCard):
    __tablename__ = "tornado_competitor_cards"
    db_uuid = Column(String, ForeignKey("competitor_cards.db_uuid"), primary_key=True)


class TrioCompetitorCard(CompetitorCard):
    __tablename__ = "trio_competitor_cards"
    db_uuid = Column(String, ForeignKey("competitor_cards.db_uuid"), primary_key=True)


class EntranceCard(Card):
    __tablename__ = "entrance_cards"
    db_uuid = Column(String, ForeignKey("cards.db_uuid"), primary_key=True)


class SpectacleCard(Card):
    __tablename__ = "spectacle_cards"
    db_uuid = Column(String, ForeignKey("cards.db_uuid"), primary_key=True)


class CrowdMeterCard(Card):
    __tablename__ = "crowd_meter_cards"
    db_uuid = Column(String, ForeignKey("cards.db_uuid"), primary_key=True)
