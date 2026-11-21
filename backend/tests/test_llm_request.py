"""What AgnoLLM really puts on the wire, checked against a local fake API server.

The newest models answer 400 to forced tool_choice and to non-default sampling, and
structured output must go through output_config.format. A wrong request shape would be
hidden by the offline fallbacks, so it is pinned here. The server is on 127.0.0.1.
"""

import json
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, cast

import pytest
from sqlalchemy import Engine
from sqlmodel import Session

from app.agents.corrector import Correction
from app.agents.llm import AgnoLLM, Ping


class FakeApi:
    def __init__(self) -> None:
        self.requests: list[tuple[str, dict[str, str], dict[str, Any]]] = []
        self.reply: dict[str, Any] = {"ok": True, "message": "pong"}


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeApi]:
    state = FakeApi()

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            body = json.loads(self.rfile.read(int(self.headers["content-length"])))
            state.requests.append((self.path, dict(self.headers), body))
            data = json.dumps(
                {
                    "id": "msg_1",
                    "type": "message",
                    "role": "assistant",
                    "model": body["model"],
                    "content": [{"type": "text", "text": json.dumps(state.reply)}],
                    "stop_reason": "end_turn",
                    "stop_sequence": None,
                    "usage": {"input_tokens": 10, "output_tokens": 5},
                }
            ).encode()
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_: object) -> None: ...

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setenv("ANTHROPIC_BASE_URL", f"http://127.0.0.1:{server.server_port}")
    yield state
    server.shutdown()


def llm(db: Session, model: str = "claude-sonnet-5-5") -> AgnoLLM:
    return AgnoLLM(cast(Engine, db.get_bind()), "anthropic", "sk-test", model)


def test_structured_output_uses_the_native_format_without_forbidden_parameters(
    db: Session, api: FakeApi
) -> None:
    assert llm(db).run("ping", "ping", "hello", Ping) == Ping(ok=True, message="pong")
    path, _, body = api.requests[0]
    assert path == "/v1/messages" and body["model"] == "claude-sonnet-5-5"
    assert body["output_config"]["format"]["type"] == "json_schema"
    for forbidden in ("tool_choice", "temperature", "top_p", "top_k", "tools"):
        assert forbidden not in body
    assert body["max_tokens"] == 8192
    assert body["messages"][0]["content"] and "Ruvox" in json.dumps(body["system"])


def test_a_typed_schema_round_trips(db: Session, api: FakeApi) -> None:
    api.reply = {
        "correct": False,
        "grade": 2,
        "explanation_pt": "Quase!",
        "normalized_answer": "zzz",
    }
    result = llm(db).run("corrector", "corrector", "{}", Correction)
    assert (result.grade, result.explanation_pt) == (2, "Quase!")
