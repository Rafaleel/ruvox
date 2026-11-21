"""The single seam between Ruvox and the LLM provider.

Everything that needs a model goes through `StructuredLLM`. Tests use a fake; the app
uses `AgnoLLM` (every provider goes through Agno). A missing key or any failure surfaces as `LLMUnavailable` so callers
fall back to the no-LLM path (decision D11).
"""

import logging
import re
import time
from pathlib import Path
from string import Template
from typing import Any, Protocol, TypeVar

from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.models.groq import Groq
from agno.models.openai import OpenAIChat
from pydantic import BaseModel
from sqlalchemy import Engine
from sqlmodel import Session

from app.agents.providers import PROVIDERS
from app.config import effective_settings
from app.models import LLMCall

log = logging.getLogger("ruvox.llm")
PROMPTS = Path(__file__).parent / "prompts"
TIMEOUT_SECONDS = 20.0
MAX_TOKENS = 8192  # the music analysis can list 40 words

# USD per million tokens (input, output); first-party API list prices.
PRICES_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-opus-5-5": (4.0, 20.0),
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-fable-5-2": (8.0, 40.0),
}

T = TypeVar("T", bound=BaseModel)


KEY_LIKE = re.compile(r"\b(?:sk|gsk|pk)[-_][A-Za-z0-9_*.\-]{4,}")


def redact(text: str, *secrets: str | None) -> str:
    """Remove API keys from text before it is logged or stored. Providers sometimes quote
    the key they rejected, in full or partly masked."""
    for secret in secrets:
        if secret:
            text = text.replace(secret, "***")
    return KEY_LIKE.sub("***", text)


def friendly_error(detail: str, provider: str = "Anthropic") -> str:
    """A pt-BR explanation of an API failure; the raw detail stays in the log and table."""
    text = detail.lower()
    if (
        "401" in text
        or "authentication" in text
        or "invalid x-api-key" in text
        or "incorrect api key" in text
        or "invalid api key" in text
    ):
        return "A chave da API foi recusada. Confira a chave em Configurações."
    if "403" in text or "permission" in text:
        return "A chave não tem permissão para usar este modelo."
    if "404" in text or "not_found" in text or "not found" in text:
        return "Este modelo não está disponível para a sua chave. Troque o modelo em Configurações."
    if "429" in text or "529" in text or "rate" in text or "overloaded" in text:
        return "A API está sobrecarregada ou o limite de uso foi atingido. Tente de novo em instantes."
    if "timeout" in text or "timed out" in text or "connect" in text:
        return f"Sem conexão com a API da {provider}. Confira a internet."
    if "400" in text or "invalid_request" in text:
        return "A API recusou o pedido. O detalhe está no registro do app."
    return "Não foi possível falar com o modelo agora."


class LLMUnavailable(RuntimeError):
    """No key, a timeout, an API error or an unusable answer."""

    def __init__(
        self, detail: str, user_message: str | None = None, provider: str = "Anthropic"
    ) -> None:
        super().__init__(detail)
        self.user_message = user_message or friendly_error(detail, provider)


class Ping(BaseModel):
    ok: bool
    message: str


class StructuredLLM(Protocol):
    def run(self, agent: str, prompt: str, user_input: str, schema: type[T]) -> T:
        """Run the named prompt file against the input and return a validated schema."""
        ...


def load_prompt(name: str, **variables: str) -> str:
    """Prompts are versioned `.md` files; `$name` placeholders are substituted."""
    text = (PROMPTS / f"{name}.md").read_text(encoding="utf-8")
    return Template(text).safe_substitute(variables)


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    price_in, price_out = PRICES_PER_MTOK.get(model, (0.0, 0.0))
    return (input_tokens * price_in + output_tokens * price_out) / 1_000_000


# Which structured-output mode worked for a (provider, model): False = the provider's
# native structured output, True = JSON mode. Remembered so a failing mode is tried once.
_working: dict[tuple[str, str], bool] = {}
_STATUS = re.compile(r"error code: (\d{3})")
_METHOD_WORDS = (
    "not support", "unsupported", "response_format", "json_schema", "tool", "function", "schema",
)  # fmt: skip


def method_problem(detail: str) -> bool:
    """Does this failure mean "this model cannot do that structured-output mode"?

    A refused key, a rate limit, a missing model, a server error or a timeout would fail
    the same way in the other mode, so they are never retried.
    """
    text = detail.lower()
    found = _STATUS.search(text)
    status = int(found[1]) if found else None
    if status in (401, 403, 404, 408, 429) or (status is not None and status >= 500):
        return False
    if any(word in text for word in ("timeout", "timed out", "connect", "api key")):
        return False
    return status == 400 or any(word in text for word in _METHOD_WORDS)


def build_model(
    provider_id: str, api_key: str, model: str, base_url: str | None = None
) -> Any:
    """The Agno model for a provider. No sampling parameters: reasoning models reject them."""
    if provider_id == "anthropic":
        params: dict[str, Any] = {"max_retries": 0}
        if base_url:
            params["base_url"] = base_url
        return Claude(
            id=model,
            api_key=api_key,
            timeout=TIMEOUT_SECONDS,
            max_tokens=MAX_TOKENS,
            client_params=params,
        )
    if provider_id == "openai":
        return OpenAIChat(
            id=model,
            api_key=api_key,
            base_url=base_url or PROVIDERS["openai"].base_url,
            timeout=TIMEOUT_SECONDS,
            max_retries=0,
            max_completion_tokens=MAX_TOKENS,
        )
    if provider_id == "groq":
        return Groq(
            id=model,
            api_key=api_key,
            base_url=base_url or PROVIDERS["groq"].base_url,
            timeout=int(TIMEOUT_SECONDS),
            max_retries=0,
            max_tokens=MAX_TOKENS,
        )
    raise ValueError(f"unknown provider: {provider_id}")


class AgnoLLM:
    """Every provider runs through Agno: one library, one way to ask for a structure."""

    def __init__(
        self,
        engine: Engine,
        provider_id: str,
        api_key: str,
        model: str,
        base_url: str | None = None,
    ) -> None:
        self.engine = engine
        self.provider_id = provider_id
        self.key = api_key
        self.model = model
        self.base_url = base_url
        self.label = PROVIDERS[provider_id].label

    def run(self, agent: str, prompt: str, user_input: str, schema: type[T]) -> T:
        started = time.perf_counter()
        tokens_in = tokens_out = 0
        error = ""
        try:
            result, tokens_in, tokens_out = self._invoke(prompt, user_input, schema)
            return result
        except LLMUnavailable as exc:
            error = str(exc)
            raise
        except Exception as exc:
            error = redact(f"{type(exc).__name__}: {exc}", self.key)[:300]
            raise LLMUnavailable(
                error, friendly_error(error, self.label), self.label
            ) from exc
        finally:
            self._record(agent, tokens_in, tokens_out, started, error)

    def _invoke(
        self, prompt: str, user_input: str, schema: type[T]
    ) -> tuple[T, int, int]:
        key = (self.provider_id, self.model)
        if key in _working:
            modes = [_working[key]]
        else:
            modes = [False] if self.provider_id == "anthropic" else [False, True]
        detail = "the model did not return the expected structure"
        tokens = (0, 0)
        for json_mode in modes:
            runner = Agent(
                model=build_model(
                    self.provider_id, self.key, self.model, self.base_url
                ),
                instructions=load_prompt(prompt),
                output_schema=schema,
                use_json_mode=json_mode,
            )
            result = runner.run(user_input)
            if result.metrics:
                tokens = (result.metrics.input_tokens, result.metrics.output_tokens)
            if isinstance(result.content, schema):
                _working[key] = json_mode
                return result.content, tokens[0], tokens[1]
            # Agno returns an API failure as plain text in `content` (status error).
            if isinstance(result.content, str):
                detail = redact(result.content, self.key)
            if not method_problem(detail):
                break
        raise LLMUnavailable(detail, friendly_error(detail, self.label), self.label)

    def _record(
        self, agent: str, tokens_in: int, tokens_out: int, started: float, error: str
    ) -> None:
        latency_ms = round((time.perf_counter() - started) * 1000)
        # Prices are only known for the Claude models in PRICES_PER_MTOK; others log cost 0.
        cost = cost_usd(self.model, tokens_in, tokens_out)
        log.info(
            "llm_call provider=%s agent=%s model=%s in=%d out=%d latency_ms=%d cost_usd=%.6f ok=%s",
            self.provider_id,
            agent,
            self.model,
            tokens_in,
            tokens_out,
            latency_ms,
            cost,
            not error,
        )
        with Session(self.engine) as db:
            db.add(
                LLMCall(
                    agent=agent,
                    model=f"{self.provider_id}:{self.model}",
                    input_tokens=tokens_in,
                    output_tokens=tokens_out,
                    latency_ms=latency_ms,
                    cost_usd=cost,
                    ok=not error,
                    error=error,
                )
            )
            db.commit()


def get_llm(engine: Engine, provider_id: str | None = None) -> StructuredLLM | None:
    """The model of `provider_id` (default: the active provider), or None when it has no
    key or no model chosen (offline mode)."""
    settings = effective_settings()
    provider_id = provider_id or settings.active_provider
    config = settings.provider(provider_id)
    if not config.api_key or not config.api_key.get_secret_value() or not config.model:
        return None
    return AgnoLLM(engine, provider_id, config.api_key.get_secret_value(), config.model)
