from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from sqlmodel import Session
from starlette.exceptions import HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from app.api import backup, progress, sessions, settings, songs, stats
from app.db import ROOT, database_engine, run_migrations, seed


class Frontend(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        if path.split("/", 1)[0] == "api":
            raise HTTPException(404)
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or Path(path).suffix:
                raise
            return await super().get_response("index.html", scope)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    engine = database_engine()
    try:
        run_migrations(engine)
        with Session(engine) as session:
            seed(session)
        app.state.engine = engine
        yield
    finally:
        engine.dispose()


def create_app(web_dir: Path = ROOT / "app/web") -> FastAPI:
    app = FastAPI(title="Ruvox", lifespan=lifespan)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(sessions.router)
    app.include_router(progress.router)
    app.include_router(settings.router)
    app.include_router(songs.router)
    app.include_router(stats.router)
    app.include_router(backup.router)

    if web_dir.is_dir():
        app.mount("/", Frontend(directory=web_dir, html=True))
    return app
