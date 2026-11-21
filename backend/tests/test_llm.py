import logging
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest
from sqlalchemy import Engine
from sqlmodel import Session, select

from app.agents import llm
from app.agents.llm import AgnoLLM, LLMUnavailable, Ping, cost_usd, get_llm, load_prompt
from app.models import LLMCall


class StubAgent:
    """Replaces agno's Agent so no test touches the network."""

    result: Any = None
    error: Exception | None = None

    def __init__(self, **_: Any) -> None: ...

    def run(self, _: str) -> Any:
        if self.error:
            raise self.error
        return self.result


def claude(db: Session) -> AgnoLLM:
    return AgnoLLM(
        cast(Engine, db.get_bind()), "anthropic", "sk-test", "claude-sonnet-5-5"
    )


def calls(db: Session) -> list[LLMCall]:
    return list(db.exec(select(LLMCall)))


def test_every_prompt_file_loads() -> None:
    names = sorted(p.stem for p in llm.PROMPTS.glob("*.md"))
    assert "ping" in names
    for name in names:
        assert load_prompt(name).strip()


def test_prompt_variables_are_substituted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "demo.md").write_text("Level: $level. Keep $unknown.")
    monkeypatch.setattr(llm, "PROMPTS", tmp_path)
    assert load_prompt("demo", level="beginner") == "Level: beginner. Keep $unknown."


def test_cost_uses_the_price_table() -> None:
    assert cost_usd("claude-sonnet-5-5", 1000, 500) == pytest.approx(0.007)
    assert cost_usd("some-future-model", 1000, 500) == 0.0


def test_successful_call_is_logged_with_cost_and_latency(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    StubAgent.error = None
    StubAgent.result = SimpleNamespace(
        content=Ping(ok=True, message="pong"),
        metrics=SimpleNamespace(input_tokens=1000, output_tokens=500),
    )
    monkeypatch.setattr(llm, "Agent", StubAgent)
    monkeypatch.setattr(llm, "Claude", lambda **_: object())
    caplog.set_level(logging.INFO, logger="ruvox.llm")
    answer = claude(db).run("ping", "ping", "hello", Ping)
    assert answer == Ping(ok=True, message="pong")
    (row,) = calls(db)
    assert (row.agent, row.model, row.ok) == (
        "ping",
        "anthropic:claude-sonnet-5-5",
        True,
    )
    assert (row.input_tokens, row.output_tokens) == (1000, 500)
    assert row.cost_usd == pytest.approx(0.007) and row.latency_ms >= 0
    assert "llm_call provider=anthropic agent=ping" in caplog.text


def test_api_failure_is_wrapped_and_recorded(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    StubAgent.error = TimeoutError("slow")
    monkeypatch.setattr(llm, "Agent", StubAgent)
    monkeypatch.setattr(llm, "Claude", lambda **_: object())
    with pytest.raises(LLMUnavailable, match="TimeoutError"):
        claude(db).run("ping", "ping", "hello", Ping)
    (row,) = calls(db)
    assert not row.ok and "TimeoutError" in row.error


def test_wrong_structure_is_rejected(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    StubAgent.error = None
    StubAgent.result = SimpleNamespace(content="plain text", metrics=None)
    monkeypatch.setattr(llm, "Agent", StubAgent)
    monkeypatch.setattr(llm, "Claude", lambda **_: object())
    with pytest.raises(LLMUnavailable, match="plain text"):
        claude(db).run("ping", "ping", "hello", Ping)


def test_no_key_means_offline_mode(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert get_llm(cast(Engine, db.get_bind())) is None
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-env")
    assert isinstance(get_llm(cast(Engine, db.get_bind())), AgnoLLM)


# Anthropic structured outputs reject these JSON-schema keywords with a 400, which the
# fallbacks would silently turn into "offline forever". Limits belong in the validators.
UNSUPPORTED_SCHEMA_KEYS = {
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "minLength",
    "maxLength",
    "pattern",
    "minItems",
    "maxItems",
    "uniqueItems",
}


def schema_keys(node: object) -> set[str]:
    if isinstance(node, dict):
        return set(node) | {
            key for value in node.values() for key in schema_keys(value)
        }
    if isinstance(node, list):
        return {key for value in node for key in schema_keys(value)}
    return set()


def test_agent_output_schemas_use_only_supported_keywords() -> None:
    from app.agents.corrector import Correction
    from app.agents.generator import GeneratedQuestions
    from app.agents.music import SongAnalysis
    from app.agents.planner import SessionPlan

    for model in (Ping, SessionPlan, GeneratedQuestions, Correction, SongAnalysis):
        assert not schema_keys(model.model_json_schema()) & UNSUPPORTED_SCHEMA_KEYS, (
            model
        )


def test_long_model_output_is_trimmed_by_the_validators() -> None:
    from app.agents.corrector import Correction
    from app.agents.music import SongAnalysis, VocabEntry, clean_analysis

    long = "а" * 400
    result = clean_analysis(
        SongAnalysis(
            vocabulary=[
                VocabEntry(
                    text="кот", lemma="кот", pronunciation_pt=long, meaning_pt=long
                ),
                VocabEntry(text=long, lemma=long, pronunciation_pt="x", meaning_pt="y"),
            ],
            expressions=[],
            grammar=[],
        ),
        "кот",
        {},
    )
    assert [e.text for e in result.entries] == ["кот"]
    assert (
        len(result.entries[0].meaning_pt) == 200
        and len(result.entries[0].pronunciation_pt) == 100
    )
    assert (
        Correction(
            correct=False, grade=9, explanation_pt="x", normalized_answer="y"
        ).grade
        == 9
    )


def test_a_rejected_key_gets_a_clear_portuguese_message(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    StubAgent.error = None
    # Agno hands an API failure back as text in `content` instead of raising.
    StubAgent.result = SimpleNamespace(
        content="Error code: 401 - {'error': {'message': 'invalid x-api-key'}}",
        metrics=None,
    )
    monkeypatch.setattr(llm, "Agent", StubAgent)
    monkeypatch.setattr(llm, "Claude", lambda **_: object())
    with pytest.raises(LLMUnavailable) as caught:
        claude(db).run("ping", "ping", "hello", Ping)
    assert "chave da API foi recusada" in caught.value.user_message
    assert "401" in str(caught.value)  # the raw detail is kept for the log


@pytest.mark.parametrize(
    ("detail", "expected"),
    [
        ("Error code: 403 - permission_error", "permissão"),
        ("Error code: 404 - not_found_error: model", "modelo não está disponível"),
        ("Error code: 429 - rate_limit_error", "sobrecarregada"),
        ("Connection error.", "Sem conexão"),
        ("Request timed out.", "Sem conexão"),
        ("Error code: 400 - invalid_request_error", "recusou o pedido"),
        ("something odd", "Não foi possível falar com o modelo"),
    ],
)
def test_friendly_error_messages(detail: str, expected: str) -> None:
    from app.agents.llm import friendly_error

    assert expected in friendly_error(detail)


def test_redact_removes_keys_and_key_shapes() -> None:
    from app.agents.llm import redact

    text = "Incorrect API key provided: abc-secret-value. Try sk-ant-api03-XYZ or gsk_abcdef12345"
    cleaned = redact(text, "abc-secret-value")
    assert (
        "abc-secret-value" not in cleaned
        and "sk-ant" not in cleaned
        and "gsk_" not in cleaned
    )
    assert redact("plain text") == "plain text"
