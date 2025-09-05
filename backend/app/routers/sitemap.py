from fastapi import APIRouter, Response
from sqlalchemy.orm import Session
from database import SessionLocal
from models.base import Card  # adjust import if different

router = APIRouter()


@router.get("/sitemap.xml", response_class=Response)
def sitemap():
    db: Session = SessionLocal()
    cards = db.query(Card).all()
    db.close()

    urls = []
    for card in cards:
        slug = card.slug or card.db_uuid
        urls.append(f"""
        <url>
          <loc>https://get-diced.com/card/{slug}</loc>
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
