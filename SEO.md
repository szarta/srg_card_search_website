# SEO Documentation for get-diced.com

## How the SEO System Works

This is a Single Page Application (SPA) built with React, which presents challenges for search engine crawlers. We've implemented a bot detection system to serve search engines pre-rendered HTML with proper meta tags.

### Architecture

1. **Regular Users**: See the React SPA with client-side routing
2. **Search Engine Bots**: Redirected to server-rendered HTML pages with full SEO metadata

### Technical Implementation

#### Bot Detection (nginx)
Located in: `/etc/nginx/sites-available/srg.conf`

```nginx
map $http_user_agent $is_bot {
    default 0;
    ~*(googlebot|bingbot|duckduckbot|baiduspider|yandex|slurp|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|linkedinbot|embedly|pinterest|quora|skypeuripreview|vkshare|redditbot|mastodon|applebot) 1;
}

location ^~ /card/ {
    if ($is_bot = 1) {
        rewrite ^/card/(.*)$ /card-meta/$1 last;
    }
    try_files $uri $uri/ /index.html;
}
```

When a bot visits `/card/{slug}`, nginx rewrites the request to `/card-meta/{slug}` which is handled by the FastAPI backend.

#### Server-Side Meta Generation (FastAPI)
Located in: `backend/app/routers/card_meta.py`

The `/card-meta/{id_or_slug}` endpoint:
- Fetches card data from PostgreSQL
- Generates proper HTML with:
  - Title tag
  - Meta description
  - Open Graph tags (og:title, og:description, og:image, og:url)
  - Twitter Card tags
  - JSON-LD structured data (schema.org)
  - Canonical URL
- Includes a meta refresh to redirect users to the SPA
- Returns 404 for non-existent cards

#### Sitemap Generation
Located in: `backend/app/routers/sitemap.py`

- Endpoint: `https://get-diced.com/sitemap.xml`
- Dynamically generates sitemap from all cards in database
- Updates automatically as cards are added
- Currently includes: **4,208 URLs** (4,207 cards + homepage)

#### Robots.txt
Located in: `frontend/public/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://get-diced.com/sitemap.xml
```

## How to Re-Index with Google

### Initial Setup (One-time)

1. **Add site to Google Search Console**
   - Go to https://search.google.com/search-console
   - Click "Add Property"
   - Enter: `https://get-diced.com`
   - Verify ownership (DNS TXT record or HTML file upload)

2. **Submit Sitemap**
   - In Search Console, go to "Sitemaps" (left sidebar)
   - Enter: `sitemap.xml`
   - Click "Submit"

### After Adding New Cards

1. **Verify sitemap updated**
   ```bash
   curl -s https://get-diced.com/sitemap.xml | grep -c '<loc>'
   ```
   This should show the total number of URLs (cards + homepage)

2. **Request Google to re-crawl sitemap**
   - Go to Google Search Console > Sitemaps
   - Your sitemap should show with a date
   - Google will automatically re-crawl periodically, but you can:
     - Remove and re-submit the sitemap to force immediate attention
     - Or just wait (Google typically checks daily for popular sites)

3. **Request indexing for specific cards (optional)**
   - Go to Google Search Console > URL Inspection
   - Enter full URL: `https://get-diced.com/card/{slug}`
   - Click "Test Live URL"
   - Click "Request Indexing"
   - Note: You can only request ~10-20 URLs per day

### Expected Timeline

- **Sitemap submission**: Google notices within hours to days
- **Initial crawl**: 1-7 days after submission
- **Full index**: 1-4 weeks for all pages
- **Re-crawl after updates**: 1-2 weeks (varies by page popularity)

## Testing SEO Implementation

### Test Bot Detection

```bash
# Test with Googlebot user agent (should see card-specific meta tags)
curl -s -A "Googlebot" https://get-diced.com/card/sealed-away | grep '<title>'

# Expected: <title>Sealed Away | SRG Supershow Card Search</title>

# Test with regular user agent (should see generic SPA)
curl -s https://get-diced.com/card/sealed-away | grep '<title>'

# Expected: <title>SRG Supershow Card Search | get-diced.com</title>
```

### Test Card Meta Endpoint

```bash
# Test server-rendered page directly
curl -s http://127.0.0.1:8000/card-meta/sealed-away | head -20

# Should return full HTML with meta tags and JSON-LD
```

### Test Sitemap

```bash
# Verify sitemap is accessible
curl -s https://get-diced.com/sitemap.xml | head -50

# Count total URLs
curl -s https://get-diced.com/sitemap.xml | grep -c '<loc>'
```

### Verify Card in Database

```bash
# SSH to server
ssh dondo@get-diced.com

# Check if card exists and get its slug
cd /home/dondo/srg_card_search_website/backend/app
.venv/bin/python3 << 'EOF'
import sys
sys.path.insert(0, '/home/dondo/srg_card_search_website/backend/app')
from database import SessionLocal
from models.base import Card
import re

def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

db = SessionLocal()
card = db.query(Card).filter(Card.name.ilike('%CARD_NAME%')).first()
if card:
    print(f'Found: {card.name}')
    print(f'Slug: {slugify(card.name)}')
    print(f'URL: https://get-diced.com/card/{slugify(card.name)}')
else:
    print('Card not found')
db.close()
EOF
```

## Troubleshooting

### Cards not appearing in Google

1. **Check if sitemap includes the card**
   ```bash
   curl -s https://get-diced.com/sitemap.xml | grep -i "card-name"
   ```

2. **Verify bot sees correct meta tags**
   ```bash
   curl -s -A "Googlebot" https://get-diced.com/card/{slug} | grep '<title>'
   ```

3. **Check Google Search Console**
   - Look for crawl errors under "Coverage"
   - Check "URL Inspection" for specific pages
   - Review "Index Coverage" report

4. **Verify backend is running**
   ```bash
   ssh dondo@get-diced.com "ps aux | grep uvicorn"
   ```

5. **Check nginx configuration**
   ```bash
   ssh dondo@get-diced.com "sudo nginx -t"
   ```

### Meta tags not updating

- The backend generates meta tags dynamically from the database
- If card data changes, the meta tags update automatically (no cache)
- Test by curling with Googlebot user agent (see above)

### Sitemap not updating

- Sitemap is generated dynamically from the database
- Add card to database → sitemap updates immediately
- No need to rebuild or redeploy

## Performance Optimization

### Current Setup
- Bot traffic: Served by FastAPI (Python/PostgreSQL)
- User traffic: Static files served by nginx
- Images: Cached by nginx (30-day expiry)

### Monitoring
- Check Search Console for crawl rate and errors
- Monitor server resources if bot traffic increases
- Consider adding rate limiting if needed

## Additional SEO Opportunities

1. **Structured Data**: Already implemented via JSON-LD in card-meta pages
2. **Social Sharing**: Open Graph and Twitter Card tags already in place
3. **Canonical URLs**: Set correctly to prevent duplicate content issues
4. **Mobile-Friendly**: Responsive design with proper viewport meta tag

## Files to Review

- **nginx config**: `/etc/nginx/sites-available/srg.conf`
- **Card meta endpoint**: `backend/app/routers/card_meta.py`
- **Sitemap endpoint**: `backend/app/routers/sitemap.py`
- **Main app**: `backend/app/main.py` (includes card_meta router)
- **Frontend SEO component**: `frontend/src/components/SEO.jsx` (for client-side)
- **Robots.txt**: `frontend/public/robots.txt`

## Notes

- Database has **4,207 cards** as of Dec 6, 2025
- Bot detection covers major search engines and social media unfurl bots
- Server runs at 127.0.0.1:8000 (FastAPI with gunicorn + uvicorn workers)
- nginx proxies `/card-meta/` requests to the backend
- The `internal;` directive in nginx prevents direct access to `/card-meta/` from external users
