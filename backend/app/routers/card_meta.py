# backend/app/routers/card_meta.py
from fastapi import APIRouter, Response
from sqlalchemy.orm import Session
from database import SessionLocal
from models.base import Card
import re
import json
from typing import Optional

router = APIRouter()


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def first_sentence(s: Optional[str]) -> str:
    if not s:
        return ""
    s = s.strip()
    m = re.match(r".+?(?:[.!?](?=\s|$)|$)", s)
    return (m.group(0) if m else s).strip()


def card_by_id_or_slug(db: Session, key: str) -> Optional[Card]:
    # UUID?
    if re.fullmatch(r"[0-9a-f]{32}", key, re.IGNORECASE):
        return db.query(Card).filter(Card.db_uuid == key).first()
    # Slug by name
    for c in db.query(Card).all():
        if c.name and slugify(c.name) == key:
            return c
    return None


@router.get("/card-meta/{id_or_slug}", response_class=Response)
def card_meta(id_or_slug: str):
    db: Session = SessionLocal()
    try:
        card = card_by_id_or_slug(db, id_or_slug)
    finally:
        db.close()

    if not card:
        return Response(content="Not Found", media_type="text/plain", status_code=404)

    name = card.name or "SRG Supershow Card"
    ctype = card.card_type or "Card"
    rule_snip = first_sentence(getattr(card, "rules_text", None))

    slug = slugify(card.name) if card.name else card.db_uuid
    canonical = f"https://get-diced.com/card/{slug}"
    image = (
        f"https://get-diced.com/images/fullsize/{card.db_uuid[:2]}/{card.db_uuid}.webp"
        if getattr(card, "db_uuid", None)
        else None
    )

    # Description (only the fields you said matter)
    bits = [name, ctype]
    if rule_snip:
        bits.append(f"Rules: {rule_snip}")
    description = " — ".join(bits)[:300]

    # JSON-LD
    competitor_types = {
        "SingleCompetitorCard",
        "TornadoCompetitorCard",
        "TrioCompetitorCard",
    }
    props = []
    if card.card_type in competitor_types:
        for k in ["power", "technique", "agility", "strike", "submission", "grapple"]:
            v = getattr(card, k, None)
            if v is not None:
                props.append(
                    {"@type": "PropertyValue", "name": k.capitalize(), "value": str(v)}
                )
    if (
        card.card_type == "MainDeckCard"
        and getattr(card, "deck_card_number", None) is not None
    ):
        props.append(
            {
                "@type": "PropertyValue",
                "name": "Deck Card #",
                "value": str(card.deck_card_number),
            }
        )

    jsonld = {
        "@context": "https://schema.org",
        "@type": "Game",
        "name": name,
        "url": canonical,
        "description": description,
        "identifier": getattr(card, "db_uuid", ""),
    }
    if image:
        jsonld["image"] = image
    if props:
        jsonld["additionalProperty"] = props

    html = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>{name} | SRG Supershow Card Search</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="{name} | SRG Supershow Card Search">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{canonical}">
{f'<meta property="og:image" content="{image}">' if image else ''}
<meta name="twitter:card" content="{'summary_large_image' if image else 'summary'}">
<meta name="twitter:title" content="{name} | SRG Supershow Card Search">
<meta name="twitter:description" content="{description}">
{f'<meta name="twitter:image" content="{image}">' if image else ''}
<script type="application/ld+json">{json.dumps(jsonld,separators=(",",":"))}</script>
<meta http-equiv="refresh" content="0; url={canonical}">
</head><body>
If you are not redirected, <a href="{canonical}">click here</a>.
</body></html>"""
    return Response(content=html, media_type="text/html; charset=utf-8")
