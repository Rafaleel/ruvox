"""The AI providers Ruvox can talk to, and how to list the models a key can use.

Model names are never typed by hand or guessed: for every provider the list comes from the
provider's own models endpoint, using the learner's key. Only Claude also has a small
built-in list (names taken from Anthropic's published model table), used before a key
exists so the first choice still makes sense.
"""

from collections.abc import Mapping
from dataclasses import dataclass

import httpx

from app.config import PROVIDER_IDS

TIMEOUT_SECONDS = 15.0
ANTHROPIC_VERSION = "2023-06-01"


@dataclass(frozen=True)
class Provider:
    id: str
    label: str  # shown next to the key: who the key belongs to
    maker: str  # the assistant's brand
    models_url: str
    base_url: str
    key_url: str  # where the learner creates a key
    key_example: str


PROVIDERS: dict[str, Provider] = {
    "anthropic": Provider(
        id="anthropic",
        label="Anthropic",
        maker="Claude",
        models_url="https://api.anthropic.com/v1/models",
        base_url="https://api.anthropic.com",
        key_url="https://console.anthropic.com/settings/keys",
        key_example="sk-ant-...",
    ),
    "openai": Provider(
        id="openai",
        label="OpenAI",
        maker="ChatGPT",
        models_url="https://api.openai.com/v1/models",
        base_url="https://api.openai.com/v1",
        key_url="https://platform.openai.com/api-keys",
        key_example="sk-...",
    ),
    "groq": Provider(
        id="groq",
        label="Groq",
        maker="Groq",
        models_url="https://api.groq.com/openai/v1/models",
        base_url="https://api.groq.com",
        key_url="https://console.groq.com/keys",
        key_example="gsk_...",
    ),
}
assert tuple(PROVIDERS) == PROVIDER_IDS

# Claude model ids from Anthropic's published table (id, display name).
BUILTIN_MODELS: dict[str, list[tuple[str, str]]] = {
    "anthropic": [
        ("claude-opus-5-5", "Claude Opus 5.5"),
        ("claude-sonnet-5-5", "Claude Sonnet 5.5"),
        ("claude-haiku-5-5", "Claude Haiku 5.5"),
        ("claude-fable-5-2", "Claude Fable 5.2"),
    ]
}

# Ids returned by the OpenAI and Groq endpoints that are not chat models.
NOT_CHAT = (
    "embed", "whisper", "tts", "dall-e", "moderation", "realtime", "audio",
    "transcribe", "image", "davinci", "babbage", "search", "guard", "speech",
    "orpheus", "computer-use", "codex",
)  # fmt: skip


class ProviderError(Exception):
    """A models request failed; `user_message` is in Brazilian Portuguese."""

    def __init__(self, user_message: str, status: int | None = None) -> None:
        super().__init__(user_message)
        self.user_message = user_message
        self.status = status


@dataclass(frozen=True)
class ModelInfo:
    id: str
    label: str


def _headers(provider_id: str, api_key: str) -> dict[str, str]:
    if provider_id == "anthropic":
        return {"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION}
    return {"Authorization": f"Bearer {api_key}"}


def _is_chat_model(provider_id: str, entry: Mapping[str, object]) -> bool:
    model_id = str(entry.get("id", "")).lower()
    if provider_id == "anthropic":
        return model_id.startswith("claude")
    if any(word in model_id for word in NOT_CHAT):
        return False
    if provider_id == "groq":
        return entry.get("active", True) is not False
    # OpenAI lists many families; keep the chat and reasoning ones.
    return model_id.startswith(("gpt-", "chatgpt-", "o1", "o3", "o4", "o5"))


def parse_models(provider_id: str, payload: Mapping[str, object]) -> list[ModelInfo]:
    data = payload.get("data")
    if not isinstance(data, list):
        raise ProviderError("A resposta do provedor veio num formato inesperado.")
    found: dict[str, ModelInfo] = {}
    for entry in data:
        if not isinstance(entry, dict) or not _is_chat_model(provider_id, entry):
            continue
        model_id = str(entry["id"])
        label = str(entry.get("display_name") or model_id)
        found[model_id] = ModelInfo(model_id, label)
    return sorted(found.values(), key=lambda m: m.id)


def _explain(provider: Provider, status: int) -> str:
    if status in (401, 403):
        return f"A chave da {provider.label} foi recusada. Confira se ela está certa."
    if status == 429:
        return f"A {provider.label} limitou o uso agora. Tente de novo em instantes."
    return f"A {provider.label} respondeu com erro ({status}). Tente de novo."


def list_models(
    provider_id: str, api_key: str, *, client: httpx.Client | None = None
) -> list[ModelInfo]:
    """Chat models this key can use, straight from the provider's API."""
    provider = PROVIDERS[provider_id]
    own = client is None
    http = client or httpx.Client(timeout=TIMEOUT_SECONDS)
    try:
        models: list[ModelInfo] = []
        params: dict[str, str] = {"limit": "100"} if provider_id == "anthropic" else {}
        while True:
            response = http.get(
                provider.models_url,
                headers=_headers(provider_id, api_key),
                params=params,
            )
            if response.status_code != 200:
                raise ProviderError(
                    _explain(provider, response.status_code), response.status_code
                )
            body = response.json()
            if not isinstance(body, dict):
                raise ProviderError(
                    "A resposta do provedor veio num formato inesperado."
                )
            models += parse_models(provider_id, body)
            if (
                provider_id == "anthropic"
                and body.get("has_more")
                and body.get("last_id")
            ):
                params = {"limit": "100", "after_id": str(body["last_id"])}
                continue
            return sorted({m.id: m for m in models}.values(), key=lambda m: m.id)
    except httpx.HTTPError as exc:
        raise ProviderError(
            f"Não consegui falar com a {provider.label}. Confira a internet."
        ) from exc
    except ValueError as exc:  # body was not JSON
        raise ProviderError(
            "A resposta do provedor veio num formato inesperado."
        ) from exc
    finally:
        if own:
            http.close()


def builtin_models(provider_id: str) -> list[ModelInfo]:
    return [ModelInfo(i, name) for i, name in BUILTIN_MODELS.get(provider_id, [])]
