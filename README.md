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
