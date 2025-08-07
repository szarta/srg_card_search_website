"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.
"""

import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from routers import cards
from routers import images
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

__version__ = "%(prog)s 1.0.0 (Rel: 07 Aug 2025)"
default_log_format = "%(filename)s:%(levelname)s:%(asctime)s] %(message)s"

IMAGES_ROOT = "/path/to/images"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/images/thumbnails",
    StaticFiles(directory=f"{IMAGES_ROOT}/thumbnails"),
    name="thumbnails",
)

app.mount(
    "/images/fullsize",
    StaticFiles(directory=f"{IMAGES_ROOT}/fullsize"),
    name="fullsize",
)


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(os.path.join("static", "favicon.ico"))


app.include_router(cards.router)
app.include_router(images.router)
