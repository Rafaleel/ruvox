import os

from fastapi import APIRouter
from pydantic import SecretStr

from app.agents.llm import LLMUnavailable, Ping
from app.api.sessions import Llm
from app.config import Settings, effective_settings, read_settings, write_settings
from app.models.schemas import LLMTestOut, SettingsIn, SettingsOut

router = APIRouter(prefix="/api/settings", tags=["settings"])


def current() -> SettingsOut:
    settings = effective_settings()
    return SettingsOut(
        has_key=bool(settings.api_key and settings.api_key.get_secret_value()),
        key_from_env=bool(os.getenv("ANTHROPIC_API_KEY")),
        model=settings.model,
    )


@router.get("", response_model=SettingsOut)
def get_settings() -> SettingsOut:
    return current()


@router.put("", response_model=SettingsOut)
def put_settings(body: SettingsIn) -> SettingsOut:
    stored: Settings = read_settings()
    if body.api_key is not None:
        stored.api_key = (
            SecretStr(body.api_key.strip()) if body.api_key.strip() else None
        )
    if body.model is not None:
        stored.model = body.model.strip()
    write_settings(stored)
    return current()


@router.post("/test-llm", response_model=LLMTestOut)
def test_llm(llm: Llm) -> LLMTestOut:
    if llm is None:
        return LLMTestOut(
            ok=False, message="Nenhuma chave da API configurada (modo offline)."
        )
    try:
        llm.run("ping", "ping", "ping", Ping)
    except LLMUnavailable as exc:
        return LLMTestOut(
            ok=False, message=f"Não foi possível falar com o modelo: {exc}"
        )
    return LLMTestOut(ok=True, message="Conexão com o modelo funcionando.")
