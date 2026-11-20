import os
import threading
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.config import read_settings, write_settings
from app.lan import (
    COOKIE,
    LOOPBACK_CLIENTS,
    PairingState,
    lan_ip,
    new_secret,
)

RESTART_EXIT_CODE = 75  # "restart requested": the Tauri shell respawns the backend

router = APIRouter(prefix="/api/lan", tags=["lan"])


def schedule_restart() -> None:
    # The settings file is already written; the shell restarts us with the new host.
    threading.Timer(0.5, os._exit, [RESTART_EXIT_CODE]).start()


def is_loopback(request: Request) -> bool:
    return request.client is not None and request.client.host in LOOPBACK_CLIENTS


def desktop_only(request: Request) -> None:
    if not is_loopback(request):
        raise HTTPException(403, "Isto só pode ser feito no computador.")


Desktop = Annotated[None, Depends(desktop_only)]


class LanStatus(BaseModel):
    required: bool  # this client must pair before using the API
    paired: bool


class LanOut(BaseModel):
    enabled: bool  # saved choice
    running: bool  # what the current process is doing
    port: int
    urls: list[str]
    code: str | None


class LanIn(BaseModel):
    enabled: bool


class PairIn(BaseModel):
    code: str = Field(min_length=1, max_length=20)


def pairing_of(request: Request) -> PairingState | None:
    state: PairingState | None = getattr(request.app.state, "pairing", None)
    return state


@router.get("/status", response_model=LanStatus)
def status(request: Request) -> LanStatus:
    pairing = pairing_of(request)
    if pairing is None or is_loopback(request):
        return LanStatus(required=False, paired=True)
    return LanStatus(required=True, paired=pairing.valid(request.cookies.get(COOKIE)))


@router.get("", response_model=LanOut)
def get_lan(request: Request, _: Desktop) -> LanOut:
    saved = read_settings()
    pairing = pairing_of(request)
    ip = lan_ip()
    running = request.app.state.lan_enabled
    return LanOut(
        enabled=saved.lan_enabled,
        running=running,
        port=saved.lan_port,
        urls=[f"http://{ip}:{saved.lan_port}/"] if running and ip else [],
        code=pairing.code if pairing else None,
    )


@router.put("", response_model=LanOut)
def set_lan(body: LanIn, request: Request, _: Desktop) -> LanOut:
    saved = read_settings()
    if body.enabled != saved.lan_enabled:
        saved.lan_enabled = body.enabled
        if body.enabled and not saved.lan_secret:
            saved.lan_secret = new_secret()
        write_settings(saved)
    if body.enabled != request.app.state.lan_enabled:
        request.app.state.restart()
    return get_lan(request, None)


@router.post("/code")
def renew_code(request: Request, _: Desktop) -> dict[str, str | None]:
    pairing = pairing_of(request)
    if pairing is None:
        raise HTTPException(409, "O acesso pelo celular está desligado.")
    pairing.rotate(pairing.secret)
    return {"code": pairing.code}


@router.post("/unpair", status_code=204)
def unpair_all(request: Request, _: Desktop) -> Response:
    saved = read_settings()
    saved.lan_secret = new_secret()
    write_settings(saved)
    pairing = pairing_of(request)
    if pairing:
        pairing.rotate(saved.lan_secret)
    return Response(status_code=204)


@router.post("/pair", status_code=204)
def pair(body: PairIn, request: Request, response: Response) -> Response:
    pairing = pairing_of(request)
    if pairing is None:
        raise HTTPException(404, "O acesso pelo celular está desligado.")
    who = request.client.host if request.client else "unknown"
    if pairing.blocked(who):
        raise HTTPException(429, "Muitas tentativas. Espere um minuto e tente de novo.")
    if not pairing.try_pair(who, body.code):
        raise HTTPException(403, "Código incorreto.")
    reply = Response(status_code=204)
    reply.set_cookie(
        COOKIE,
        pairing.token(),
        max_age=365 * 24 * 3600,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return reply
