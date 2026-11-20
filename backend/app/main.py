import mimetypes
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from sqlmodel import Session
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from app.api import backup, lan_api, progress, sessions, settings, songs, stats
from app.config import read_settings, write_settings
from app.db import ROOT, database_engine, run_migrations, seed
from app.lan import COOKIE, PairingState, host_allowed, new_secret

mimetypes.add_type("application/manifest+json", ".webmanifest")  # the PWA manifest


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
        if app.state.lan_enabled:
            saved = read_settings()
            if not saved.lan_secret:
                saved.lan_secret = new_secret()
                write_settings(saved)
            app.state.pairing = PairingState(saved.lan_secret)
        yield
    finally:
        engine.dispose()


OPEN_API_PATHS = {"/api/health", "/api/lan/status", "/api/lan/pair"}


def create_app(web_dir: Path = ROOT / "app/web", lan: bool | None = None) -> FastAPI:
    lan_enabled = read_settings().lan_enabled if lan is None else lan
    app = FastAPI(title="Ruvox", lifespan=lifespan)
    app.state.lan_enabled = lan_enabled
    app.state.restart = lan_api.schedule_restart

    @app.middleware("http")
    async def guard(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # DNS rebinding: only localhost and IP-literal hosts are served (D15).
        if not host_allowed(request.headers.get("host", ""), lan_enabled):
            return PlainTextResponse("Invalid host header", status_code=400)
        path = request.url.path
        if (
            lan_enabled
            and path.startswith("/api/")
            and path not in OPEN_API_PATHS
            and not lan_api.is_loopback(request)
        ):
            pairing: PairingState | None = getattr(request.app.state, "pairing", None)
            if pairing is None or not pairing.valid(request.cookies.get(COOKIE)):
                return JSONResponse(
                    {
                        "detail": "Pareie este dispositivo com o código mostrado no computador."
                    },
                    status_code=401,
                )
        return await call_next(request)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(sessions.router)
    app.include_router(progress.router)
    app.include_router(settings.router)
    app.include_router(songs.router)
    app.include_router(stats.router)
    app.include_router(backup.router)
    app.include_router(lan_api.router)

    if web_dir.is_dir():
        app.mount("/", Frontend(directory=web_dir, html=True))
    return app
