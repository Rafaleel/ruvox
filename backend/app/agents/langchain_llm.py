"""OpenAI (ChatGPT) and Groq through LangChain, behind the same `StructuredLLM` seam.

LangChain keeps the provider differences small: both are chat models with
`with_structured_output`. Adding another provider is a new entry in `build_chat_model`.
"""

import time
from typing import Any, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel
from sqlalchemy import Engine
from sqlmodel import Session

from app.agents.llm import (
    TIMEOUT_SECONDS,
    LLMUnavailable,
    cost_usd,
    friendly_error,
    load_prompt,
    log,
)
from app.agents.providers import PROVIDERS
from app.models import LLMCall

T = TypeVar("T", bound=BaseModel)

# Structured-output method to try, in order. Models differ in what they support: a
# method a model rejects is skipped and the one that worked is remembered per model.
METHODS: dict[str, tuple[str, ...]] = {
    "openai": ("json_schema", "function_calling"),
    "groq": ("json_schema", "function_calling"),
}
_working: dict[tuple[str, str], str] = {}


def build_chat_model(
    provider_id: str, api_key: str, model: str, base_url: str | None = None
) -> Any:
    """A LangChain chat model. No sampling parameters: reasoning models reject them."""
    if provider_id == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=model,
            api_key=api_key,  # type: ignore[arg-type]
            base_url=base_url or PROVIDERS["openai"].base_url,
            timeout=TIMEOUT_SECONDS,
            max_retries=0,
        )
    if provider_id == "groq":
        from langchain_groq import ChatGroq

        return ChatGroq(
            model=model,
            api_key=api_key,  # type: ignore[arg-type]
            base_url=base_url or PROVIDERS["groq"].base_url,
            timeout=TIMEOUT_SECONDS,
            max_retries=0,
        )
    raise ValueError(f"unknown LangChain provider: {provider_id}")


class LangChainLLM:
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
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    def run(self, agent: str, prompt: str, user_input: str, schema: type[T]) -> T:
        started = time.perf_counter()
        tokens_in = tokens_out = 0
        error = ""
        try:
            chat = build_chat_model(
                self.provider_id, self.api_key, self.model, self.base_url
            )
            messages = [SystemMessage(load_prompt(prompt)), HumanMessage(user_input)]
            result, tokens_in, tokens_out = self._invoke(chat, messages, schema)
            return result
        except LLMUnavailable as exc:
            error = str(exc)
            raise
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"[:300]
            raise LLMUnavailable(error, friendly_error(str(exc))) from exc
        finally:
            self._record(agent, tokens_in, tokens_out, started, error)

    def _invoke(
        self, chat: Any, messages: list[Any], schema: type[T]
    ) -> tuple[T, int, int]:
        remembered = _working.get((self.provider_id, self.model))
        methods = [remembered] if remembered else list(METHODS[self.provider_id])
        last: Exception | None = None
        for method in methods:
            try:
                reply = chat.with_structured_output(
                    schema, method=method, include_raw=True
                ).invoke(messages)
            except Exception as exc:  # noqa: BLE001
                # a structured-output method this model does not support: try the next one
                last = exc
                continue
            parsed = reply.get("parsed")
            if isinstance(parsed, schema):
                _working[(self.provider_id, self.model)] = method
                usage = getattr(reply.get("raw"), "usage_metadata", None) or {}
                return (
                    parsed,
                    int(usage.get("input_tokens", 0)),
                    int(usage.get("output_tokens", 0)),
                )
            last = reply.get("parsing_error") or LLMUnavailable(
                "the model did not return the expected structure"
            )
        assert last is not None
        raise last

    def _record(
        self, agent: str, tokens_in: int, tokens_out: int, started: float, error: str
    ) -> None:
        latency_ms = round((time.perf_counter() - started) * 1000)
        # Prices are only known for the models in llm.PRICES_PER_MTOK; others log cost 0.
        cost = cost_usd(self.model, tokens_in, tokens_out)
        log.info(
            "llm_call provider=%s agent=%s model=%s in=%d out=%d latency_ms=%d cost_usd=%.6f ok=%s",
            self.provider_id, agent, self.model, tokens_in, tokens_out, latency_ms, cost, not error,
        )  # fmt: skip
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
