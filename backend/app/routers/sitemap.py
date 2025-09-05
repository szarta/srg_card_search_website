from fastapi import APIRouter, Response
from sqlalchemy.orm import Session
from database import SessionLocal
from models.base import Card
import re

router = APIRouter()


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


@router.get("/sitemap.xml", response_class=Response)
def sitemap():
    db: Session = SessionLocal()
    cards = db.query(Card).all()
    db.close()

    urls = []
    for card in cards:
        if hasattr(card, "name") and card.name:
            slug = slugify(card.name)
            path = f"/card/{slug}"
        else:
            path = f"/card/{card.db_uuid}"

        urls.append(f"""
        <url>
          <loc>https://get-diced.com{path}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
        </url>""")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>https://get-diced.com/</loc>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
      </url>
      {''.join(urls)}
    </urlset>"""

    return Response(content=xml.strip(), media_type="application/xml")
