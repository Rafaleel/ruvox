from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import Session

from app.api import health
from app.db import engine, init_db
from app.services.seed import seed_alphabet


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    with Session(engine) as session:
        seed_alphabet(session)
    yield


app = FastAPI(title="Ruvox", lifespan=lifespan)
app.include_router(health.router)
