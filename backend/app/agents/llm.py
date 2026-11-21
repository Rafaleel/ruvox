"""The single seam between Ruvox and the LLM provider.

Everything that needs a model goes through `StructuredLLM`. Tests use a fake; the app
uses `AgnoLLM`. A missing key or any failure surfaces as `LLMUnavailable` so callers
fall back to the no-LLM path (decision D11).
"""

import logging
import re
import time
from pathlib import Path
from string import Template
from typing import Protocol, TypeVar

from agno.agent import Agent
from agno.models.anthropic import Claude
from pydantic import BaseModel
from sqlalchemy import Engine
from sqlmodel import Session

from app.config import Settings, effective_settings
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


class AgnoLLM:
    def __init__(self, engine: Engine, settings: Settings) -> None:
        self.engine = engine
        self.settings = settings
        self.key = settings.api_key.get_secret_value() if settings.api_key else None

    def run(self, agent: str, prompt: str, user_input: str, schema: type[T]) -> T:
        model = self.settings.model
        started = time.perf_counter()
        input_tokens = output_tokens = 0
        error = ""
        try:
            runner = Agent(
                model=Claude(
                    id=model,
                    api_key=self.settings.api_key.get_secret_value()
                    if self.settings.api_key
                    else None,
                    timeout=TIMEOUT_SECONDS,
                    max_tokens=MAX_TOKENS,
                    client_params={"max_retries": 0},
                ),
                instructions=load_prompt(prompt),
                output_schema=schema,
            )
            result = runner.run(user_input)
            if result.metrics:
                input_tokens = result.metrics.input_tokens
                output_tokens = result.metrics.output_tokens
            if not isinstance(result.content, schema):
                # Agno returns an API failure as plain text in `content` (status error).
                detail = (
                    result.content
                    if isinstance(result.content, str)
                    else "the model did not return the expected structure"
                )
                raise LLMUnavailable(redact(detail, self.key))
            return result.content
        except LLMUnavailable as exc:
            error = str(exc)
            raise
        except Exception as exc:
            error = redact(f"{type(exc).__name__}: {exc}", self.key)[:300]
            raise LLMUnavailable(error) from exc
        finally:
            self._record(agent, model, input_tokens, output_tokens, started, error)

    def _record(
        self,
        agent: str,
        model: str,
        tokens_in: int,
        tokens_out: int,
        started: float,
        error: str,
    ) -> None:
        latency_ms = round((time.perf_counter() - started) * 1000)
        cost = cost_usd(model, tokens_in, tokens_out)
        log.info(
            "llm_call agent=%s model=%s in=%d out=%d latency_ms=%d cost_usd=%.6f ok=%s",
            agent,
            model,
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
                    model=model,
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
    if provider_id == "anthropic":
        return AgnoLLM(
            engine, settings.model_copy(update={"active_provider": "anthropic"})
        )
    from app.agents.langchain_llm import LangChainLLM

    return LangChainLLM(
        engine, provider_id, config.api_key.get_secret_value(), config.model
    )
