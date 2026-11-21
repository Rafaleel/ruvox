"""OpenAI and Groq through LangChain, against a fake chat-completions server on 127.0.0.1."""

import json
import threading
from collections.abc import Callable, Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, cast

import pytest
from pydantic import SecretStr
from sqlalchemy import Engine
from sqlmodel import Session, select

from app.agents import langchain_llm
from app.agents.langchain_llm import LangChainLLM
from app.agents.llm import AgnoLLM, LLMUnavailable, Ping, get_llm
from app.config import ProviderConfig, Settings, write_settings
from app.models import LLMCall


class FakeChatApi:
    def __init__(self) -> None:
        self.requests: list[tuple[str, dict[str, str], dict[str, Any]]] = []
        self.respond: Callable[[dict[str, Any]], tuple[int, dict[str, Any]]] = (
            self.ok_json
        )

    @staticmethod
    def completion(message: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": "chatcmpl-1",
            "object": "chat.completion",
            "created": 1,
            "model": "fake",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", **message},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 11, "completion_tokens": 7, "total_tokens": 18},
        }

    def ok_json(self, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        return 200, self.completion(
            {"content": json.dumps({"ok": True, "message": "pong"})}
        )

    def ok_tool(self, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        call = {
            "id": "call_1",
            "type": "function",
            "function": {
                "name": "Ping",
                "arguments": json.dumps({"ok": True, "message": "pong"}),
            },
        }
        return 200, self.completion({"content": None, "tool_calls": [call]})


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[FakeChatApi, str]]:
    state = FakeChatApi()

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            body = json.loads(self.rfile.read(int(self.headers["content-length"])))
            state.requests.append(
                (self.path, {k.lower(): v for k, v in self.headers.items()}, body)
            )
            status, payload = state.respond(body)
            data = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_: object) -> None: ...

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setattr(langchain_llm, "_working", {})
    yield state, f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


def llm(db: Session, provider: str, base: str, model: str = "model-x") -> LangChainLLM:
    suffix = "/v1" if provider == "openai" else ""
    return LangChainLLM(
        cast(Engine, db.get_bind()), provider, "key-123", model, base_url=base + suffix
    )


def test_openai_uses_json_schema_without_sampling_parameters(
    db: Session, api: tuple[FakeChatApi, str]
) -> None:
    state, base = api
    assert llm(db, "openai", base, "gpt-test").run(
        "ping", "ping", "hello", Ping
    ) == Ping(ok=True, message="pong")
    path, headers, body = state.requests[0]
    assert (
        path == "/v1/chat/completions" and headers["authorization"] == "Bearer key-123"
    )
    assert body["model"] == "gpt-test"
    assert body["response_format"]["type"] == "json_schema"
    for forbidden in ("temperature", "top_p", "tools", "tool_choice"):
        assert forbidden not in body
    assert [m["role"] for m in body["messages"]] == ["system", "user"]
    assert body["messages"][1]["content"] == "hello"
    (row,) = db.exec(select(LLMCall)).all()
    assert (row.model, row.input_tokens, row.output_tokens, row.ok) == (
        "openai:gpt-test",
        11,
        7,
        True,
    )


def test_groq_goes_through_its_own_openai_compatible_path(
    db: Session, api: tuple[FakeChatApi, str]
) -> None:
    state, base = api
    result = llm(db, "groq", base, "llama-test").run("ping", "ping", "hello", Ping)
    assert result == Ping(ok=True, message="pong")
    path, headers, body = state.requests[0]
    assert (
        path == "/openai/v1/chat/completions"
        and headers["authorization"] == "Bearer key-123"
    )
    assert body["model"] == "llama-test"


def test_a_method_the_model_rejects_is_skipped_and_remembered(
    db: Session, api: tuple[FakeChatApi, str]
) -> None:
    state, base = api

    def picky(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        if "response_format" in body:
            return 400, {
                "error": {
                    "message": "response_format json_schema is not supported by this model"
                }
            }
        return state.ok_tool(body)

    state.respond = picky
    model = llm(db, "groq", base, "tool-only-model")
    assert model.run("ping", "ping", "hi", Ping) == Ping(ok=True, message="pong")
    assert len(state.requests) == 2 and "tools" in state.requests[1][2]
    model.run("ping", "ping", "hi again", Ping)
    assert (
        len(state.requests) == 3
    )  # the working method is remembered: no new failed attempt


def test_a_refused_key_becomes_a_clear_portuguese_message(
    db: Session, api: tuple[FakeChatApi, str]
) -> None:
    state, base = api
    state.respond = lambda body: (
        401,
        {
            "error": {
                "message": "Incorrect API key provided: key-123",
                "code": "invalid_api_key",
            }
        },
    )
    with pytest.raises(LLMUnavailable) as caught:
        llm(db, "openai", base).run("ping", "ping", "hi", Ping)
    assert "chave da API foi recusada" in caught.value.user_message
    (row,) = db.exec(select(LLMCall)).all()
    assert row.ok is False


def test_get_llm_picks_the_implementation_for_the_active_provider(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    write_settings(
        Settings(
            active_provider="openai",
            providers={
                "anthropic": ProviderConfig(
                    api_key=SecretStr("a"), model="claude-sonnet-5-5"
                ),
                "openai": ProviderConfig(api_key=SecretStr("o"), model="gpt-test"),
                "groq": ProviderConfig(api_key=SecretStr("g"), model=""),
            },
        )
    )
    engine = cast(Engine, db.get_bind())
    assert isinstance(get_llm(engine), LangChainLLM)
    assert isinstance(get_llm(engine, "anthropic"), AgnoLLM)
    assert get_llm(engine, "groq") is None  # a key without a chosen model stays offline
    monkeypatch.setenv("RUVOX_LLM_PROVIDER", "groq")
    assert get_llm(engine) is None


def test_a_refused_key_is_tried_once_and_never_stored(
    db: Session, api: tuple[FakeChatApi, str]
) -> None:
    state, base = api
    state.respond = lambda body: (
        401,
        {
            "error": {
                "message": "Incorrect API key provided: key-123. Also sk-proj-****cdef",
                "code": "invalid_api_key",
            }
        },
    )
    with pytest.raises(LLMUnavailable) as caught:
        llm(db, "openai", base).run("ping", "ping", "hi", Ping)
    assert len(state.requests) == 1  # a 401 is not a structured-output method problem
    (row,) = db.exec(select(LLMCall)).all()
    for text in (row.error, str(caught.value)):
        assert "key-123" not in text and "sk-proj" not in text and "***" in text


def test_a_server_error_or_a_limit_is_not_retried_with_another_method(
    db: Session, api: tuple[FakeChatApi, str]
) -> None:
    state, base = api
    state.respond = lambda body: (429, {"error": {"message": "Rate limit reached"}})
    with pytest.raises(LLMUnavailable):
        llm(db, "groq", base).run("ping", "ping", "hi", Ping)
    assert len(state.requests) == 1


def test_connection_errors_name_the_right_provider(db: Session) -> None:
    from app.agents.llm import friendly_error

    assert "OpenAI" in friendly_error("Connection error.", "OpenAI")
    assert "Groq" in friendly_error("Request timed out.", "Groq")
    assert "Anthropic" in friendly_error("Connection error.")
