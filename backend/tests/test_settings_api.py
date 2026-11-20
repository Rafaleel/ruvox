import pytest
from fastapi.testclient import TestClient

from app.agents.llm import LLMUnavailable, Ping
from app.api.sessions import llm_dependency
from tests.fakes import FakeLLM


@pytest.fixture(autouse=True)
def no_env_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("RUVOX_LLM_MODEL", raising=False)


def test_defaults_report_no_key(client: TestClient) -> None:
    assert client.get("/api/settings").json() == {
        "has_key": False,
        "key_from_env": False,
        "model": "claude-sonnet-5-5",
    }


def test_key_is_write_only_and_can_be_cleared(client: TestClient) -> None:
    saved = client.put(
        "/api/settings", json={"api_key": " sk-secret ", "model": "claude-haiku-5-5"}
    )
    assert saved.json() == {
        "has_key": True,
        "key_from_env": False,
        "model": "claude-haiku-5-5",
    }
    assert "sk-secret" not in client.get("/api/settings").text
    client.put(
        "/api/settings", json={"model": "claude-opus-5-5"}
    )  # leaves the key alone
    assert client.get("/api/settings").json()["has_key"] is True
    assert client.put("/api/settings", json={"api_key": ""}).json()["has_key"] is False


def test_env_key_is_reported(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-env")
    body = client.get("/api/settings").json()
    assert body["has_key"] and body["key_from_env"]


def test_validation(client: TestClient) -> None:
    assert client.put("/api/settings", json={"model": ""}).status_code == 422
    assert client.put("/api/settings", json={"api_key": "x" * 301}).status_code == 422


@pytest.mark.parametrize(
    ("llm", "ok"),
    [
        (None, False),
        (FakeLLM(Ping(ok=True, message="pong")), True),
        (FakeLLM(LLMUnavailable("timeout")), False),
    ],
)
def test_connection_test(client: TestClient, llm: FakeLLM | None, ok: bool) -> None:
    client.app.dependency_overrides[llm_dependency] = lambda: llm  # type: ignore[attr-defined]
    result = client.post("/api/settings/test-llm").json()
    assert result["ok"] is ok and result["message"]
