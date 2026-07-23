# srg_card_search_website

Fast web search for [SRG Supershow](https://supershowthegame.com) Cards.  The
site is modeled after [Scryfall](https://www.scryfall.com) and is intended to
benefit the Supershow community via quick mobile-friendly card search with
linkable cards via API to allow for features seen in other card games, like
deck lists and Discord bots.

# Development Installation #

Backend technology stackup:

* Python
* SQL Alchemy
* FastAPI
* Postgres DB (for card metadata storage)
* Card images in webp stored externally in full size and thumbnail

Frontend technology stackup:

* React with Javascript
* Vite


## Backend Setup ##

Setup Postgres, if not already installed:

    sudo apt install postgresql postgresql-contrib libpq-dev


Ensure Postgres is using a strong password for postgres account:

    sudo -i -u postgres
    psql
    ALTER USER postgres PASSWORD 'your_strong_password';
    \q
    exit


Create DB for cards:

    psql -U postgres -h localhost
    CREATE DATABASE srg_cards;
    \q


Setup venv for backend:

    python -m venv venv
    source venv/bin/activate
    pip install -r backend/requirements.txt


Populate database with tables:
    cd backend/app
    python create_db.py


To run backend:

    cd backend/app
    uvicorn main:app --reload


## Frontend Setup ##

Setup NVM to control node version:

    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

After restarting shell:

    nvm install 20.19.0
    nvm use 20.19.0
    nvm alias default 20.19.0

To install frontend requirements:

    cd frontend
    npm install

To run frontend:
    cd frontend
    npm run dev


# Production / Server Reload #

The site runs on `get-diced.com` (ssh `dondo@get-diced.com`), with the project
at `/home/dondo/srg_card_search_website`. The backend runs as a systemd service
(FastAPI via gunicorn + uvicorn workers on 127.0.0.1:8000), and the frontend is
a static build served by nginx.

After pulling new code:

To reload the backend:

    sudo systemctl restart srg-backend

Verify it is running:

    ps aux | grep uvicorn

To reload the frontend (rebuild the static bundle nginx serves):

    cd frontend
    npm install        # only if dependencies changed
    npm run build
    sudo nginx -t && sudo systemctl reload nginx


# Run It Back (deployment) #

"Run It Back" is the login-gated section (`/run-it-back`) where a user owns decks
and plays Supershow against an AI. The rest of the site stays public. It adds two
deployment requirements beyond the normal reload above: the **`srg` engine
binary** on the box, and a **matched WASM build** in the frontend bundle.

## One-time database setup ##

The Run It Back tables (`rib_users`, `rib_decks`, `rib_game_records`) are created
additively:

    cd backend/app
    python create_rib_tables.py

This uses `create_all(..., checkfirst=True)` against only those tables and NEVER
drops anything, so it is safe to run against production. It then adds any model
column a live table is missing (`ALTER TABLE ... ADD COLUMN`, nullable columns
only — it never drops, renames, or retypes). Re-run it after adding a new RIB
table or column; a `NOT NULL` column without a default is reported, not forced,
and has to be added by hand.

**Do not run `create_db.py` on production — it DROPS ALL TABLES.**

## Backend environment (on the `srg-backend` systemd unit) ##

    RIB_SECRET_KEY=<stable random secret>   # REQUIRED
    RIB_COOKIE_SECURE=1                     # production (https) only

`RIB_SECRET_KEY` signs the session cookie. If it is unset the code falls back to a
hard-coded development secret that is visible in the source — anyone could then
forge a valid session cookie, so **it must be set in production**. Use a stable
value: changing it invalidates every existing session (everyone must sign in
again). Generate one once:

    python -c "import secrets; print(secrets.token_urlsafe(48))"

Optional, only if the engine is not at its default location:

    SRG_BIN=/path/to/srg          # default: <SRG_SIM_DIR>/target/release/srg
    SRG_SIM_DIR=/path/to/srg_sim  # default: ~/data/srg_sim
    SRG_CARDS=/path/to/cards.yaml # default: backend/app/cards.yaml

## The engine: binary and WASM pkg must be a matched pair ##

The backend shells the `srg` binary — to turn a stored deck into engine-ready
(IR-enriched) JSON, and to validate imported match archives — and the browser
runs the same engine compiled to WASM. Both sides must agree on the schema
versions, or enriched decks will not load.

Build both from one commit, in the engine checkout (`~/data/srg_sim`):

    invoke release-web

Then:

1. Deploy the produced `srg` release binary to the box (at `SRG_BIN`, or the
   default `target/release/srg`).
2. Vendor the produced pkg into `frontend/src/runitback/pkg/`
   (`srg_core.js` + `srg_core_bg.wasm`) and commit it. It is committed on purpose
   so the frontend builds without a Rust toolchain.

Verify the pair matches — compare **schema versions**, not the commit hash:

    srg info          # {"schemas":{"effect_ir":70,"game_log":1,
                      #             "observable_state":1,"match_record":1}}
    curl -s localhost:8000/api/decks/engine-info

The play screen reads both and shows a version-skew warning if they disagree.

## Importing games played elsewhere ##

`/run-it-back/games/import` ingests a **match record** — the portable format
pinned in the engine checkout at `schemas/v1/match_record.md`, with a worked
example at `fixtures/records/observer_example.json`. A record is written by hand
(there is deliberately no authoring tool) and validated twice before anything is
stored: in the browser by the WASM validator, and on the server by
`srg validate-record --cards <cards.yaml>`, which also checks that every card
uuid resolves. Only the server's verdict gates the write.

The site stores only `schema_version: 1`. The engine bumps that number on any
change that could break a reader, so an archive from a newer engine is refused
rather than half-understood. Imported games play back from their frames; games
played here still replay by re-simulating their stored snapshot.

## nginx ##

The frontend is same-origin with the API (nginx proxies `/api` to the backend),
which is what lets the `httpOnly` session cookie work. No CORS setup is needed in
production.

WASM must be served with the correct MIME type or the browser refuses to
instantiate it. Check that nginx knows it:

    grep wasm /etc/nginx/mime.types      # expect: application/wasm  wasm;

If that line is missing (older nginx), add to the server block:

    types { application/wasm wasm; }

The `.wasm` file ships as a normal hashed asset under `dist/assets/`, so it is
covered by whatever static-asset caching the site already uses.

These endpoints are intentionally **public (no login)** and must not be gated:

    /api/decks/enrich, /api/decks/validate, /api/decks/engine-info
    /api/games/public, /api/games/public/{id}

## Minting users ##

There is no signup. Access keys are hand-minted by the admin, and the raw key is
shown exactly once (only its SHA-256 hash is stored):

    cd backend/app
    python mint_user.py --email person@example.com
    python mint_user.py --email person@example.com --rotate      # new key
    python mint_user.py --email person@example.com --deactivate  # block login

## Note on Node ##

`npm run build` works on Node 18, but the Vite dev server (`npm run dev`)
requires Node >= 20.19.


# Contributions/Thanks #


