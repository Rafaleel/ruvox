"""The single seam between Ruvox and the LLM provider.

Everything that needs a model goes through `StructuredLLM`. Tests use a fake; the app
uses `AgnoLLM`. A missing key or any failure surfaces as `LLMUnavailable` so callers
fall back to the no-LLM path (decision D11).
"""

import logging
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


class LLMUnavailable(RuntimeError):
    """No key, a timeout, an API error or an unusable answer."""


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
                raise LLMUnavailable("the model did not return the expected structure")
            return result.content
        except LLMUnavailable as exc:
            error = str(exc)
            raise
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"[:300]
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


def get_llm(engine: Engine) -> StructuredLLM | None:
    """The real LLM, or None when no API key is configured (offline mode)."""
    settings = effective_settings()
    if not settings.api_key or not settings.api_key.get_secret_value():
        return None
    return AgnoLLM(engine, settings)
