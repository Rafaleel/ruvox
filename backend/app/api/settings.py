import os
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Request
from pydantic import SecretStr

from app.agents.llm import LLMUnavailable, Ping, get_llm
from app.agents.providers import (
    PROVIDERS,
    ProviderError,
    builtin_models,
    list_models,
)
from app.api.sessions import Llm
from app.config import (
    KEY_ENV,
    ProviderConfig,
    Settings,
    effective_settings,
    read_settings,
    write_settings,
)
from app.models.schemas import (
    LLMTestIn,
    LLMTestOut,
    ModelOption,
    ModelsIn,
    ModelsOut,
    ProviderOut,
    SettingsIn,
    SettingsOut,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


def current() -> SettingsOut:
    settings = effective_settings()
    providers = []
    for provider_id, provider in PROVIDERS.items():
        config = settings.provider(provider_id)
        providers.append(
            ProviderOut(
                id=provider_id,
                label=provider.label,
                maker=provider.maker,
                has_key=bool(config.api_key and config.api_key.get_secret_value()),
                key_from_env=bool(os.getenv(KEY_ENV[provider_id])),
                model=config.model,
                key_url=provider.key_url,
                key_example=provider.key_example,
            )
        )
    active = next(p for p in providers if p.id == settings.active_provider)
    return SettingsOut(
        active_provider=settings.active_provider,
        providers=providers,
        llm_ready=active.has_key and bool(active.model),
    )


def known_provider(provider_id: str) -> str:
    if provider_id not in PROVIDERS:
        raise HTTPException(422, "Provedor de IA desconhecido.")
    return provider_id


def _ensure_usable(stored: Settings) -> None:
    """The active AI needs a key and a model (environment keys count)."""
    provider_id = stored.active_provider
    effective = stored.model_copy(deep=True)
    if env_key := os.getenv(KEY_ENV[provider_id]):
        config = effective.provider(provider_id).model_copy(
            update={"api_key": SecretStr(env_key)}
        )
        effective.providers[provider_id] = config
    config = effective.provider(provider_id)
    if not (config.api_key and config.api_key.get_secret_value() and config.model):
        raise HTTPException(
            422,
            f"Salve a chave e escolha um modelo da {PROVIDERS[provider_id].label} "
            "antes de usar esta IA.",
        )


@router.get("", response_model=SettingsOut)
def get_settings() -> SettingsOut:
    return current()


@router.put("", response_model=SettingsOut)
def put_settings(body: SettingsIn) -> SettingsOut:
    stored = read_settings()
    for provider_id, change in body.providers.items():
        known_provider(provider_id)
        config = stored.providers.get(provider_id) or ProviderConfig()
        if change.api_key is not None:
            key = change.api_key.strip()
            config = config.model_copy(
                update={"api_key": SecretStr(key) if key else None}
            )
        if change.model is not None:
            config = config.model_copy(update={"model": change.model.strip()})
        stored.providers[provider_id] = config
    if body.active_provider is not None:
        stored.active_provider = known_provider(body.active_provider)
        _ensure_usable(stored)
    write_settings(stored)
    return current()


@router.post("/providers/{provider_id}/models", response_model=ModelsOut)
def provider_models(
    provider_id: str, body: Annotated[ModelsIn | None, Body()] = None
) -> ModelsOut:
    """The models this key can use, from the provider itself (never typed by hand)."""
    provider = PROVIDERS[known_provider(provider_id)]
    typed = ((body.api_key if body else None) or "").strip()
    saved = effective_settings().provider(provider_id).api_key
    key = typed or (saved.get_secret_value() if saved else "")
    if not key:
        if (
            provider_id == "anthropic"
        ):  # Claude ids are published: show them before a key
            return ModelsOut(
                models=[
                    ModelOption(id=m.id, label=m.label)
                    for m in builtin_models(provider_id)
                ],
                source="builtin",
            )
        raise HTTPException(409, f"Informe a chave da {provider.label} primeiro.")
    try:
        models = list_models(provider_id, key)
    except ProviderError as exc:
        # 400, never 401: the app treats 401 as "this phone must pair first".
        raise HTTPException(400, exc.user_message) from exc
    if not models:
        raise HTTPException(
            400,
            f"A {provider.label} não devolveu nenhum modelo de chat para esta chave.",
        )
    return ModelsOut(
        models=[ModelOption(id=m.id, label=m.label) for m in models], source="live"
    )


@router.post("/test-llm", response_model=LLMTestOut)
def test_llm(
    request: Request, llm: Llm, body: Annotated[LLMTestIn | None, Body()] = None
) -> LLMTestOut:
    if body is not None and body.provider is not None:
        known_provider(body.provider)
        llm = get_llm(request.app.state.engine, body.provider)
    if llm is None:
        return LLMTestOut(
            ok=False,
            message="Falta a chave ou o modelo deste provedor (modo offline).",
        )
    try:
        llm.run("ping", "ping", "ping", Ping)
    except LLMUnavailable as exc:
        return LLMTestOut(ok=False, message=exc.user_message)
    return LLMTestOut(ok=True, message="Conexão com o modelo funcionando.")
