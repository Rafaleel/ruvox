import json

import pytest
from fastapi.testclient import TestClient

from app.agents.llm import LLMUnavailable, Ping
from app.agents.providers import ModelInfo, ProviderError
from app.api import settings as settings_api
from app.api.sessions import llm_dependency
from tests.fakes import FakeLLM


@pytest.fixture(autouse=True)
def no_env_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "GROQ_API_KEY",
        "RUVOX_LLM_MODEL",
        "RUVOX_LLM_PROVIDER",
    ):
        monkeypatch.delenv(name, raising=False)


def providers(client: TestClient) -> dict[str, dict[str, object]]:
    return {p["id"]: p for p in client.get("/api/settings").json()["providers"]}


def test_defaults_list_the_three_providers_with_labels(client: TestClient) -> None:
    body = client.get("/api/settings").json()
    assert body["active_provider"] == "anthropic" and body["llm_ready"] is False
    by_id = providers(client)
    assert list(by_id) == ["anthropic", "openai", "groq"]
    assert (by_id["anthropic"]["label"], by_id["anthropic"]["maker"]) == (
        "Anthropic",
        "Claude",
    )
    assert (by_id["openai"]["label"], by_id["openai"]["maker"]) == ("OpenAI", "ChatGPT")
    assert by_id["groq"]["label"] == "Groq"
    assert by_id["anthropic"]["model"] == "claude-sonnet-5-5"  # the only default
    assert by_id["openai"]["model"] == "" and by_id["groq"]["model"] == ""
    assert all(not p["has_key"] for p in by_id.values())


def test_keys_are_per_provider_and_write_only(client: TestClient) -> None:
    client.put(
        "/api/settings", json={"providers": {"openai": {"api_key": " sk-secret "}}}
    )
    by_id = providers(client)
    assert by_id["openai"]["has_key"] is True and by_id["groq"]["has_key"] is False
    assert "sk-secret" not in client.get("/api/settings").text
    client.put(
        "/api/settings", json={"providers": {"openai": {"model": "chosen-model"}}}
    )
    assert providers(client)["openai"]["has_key"] is True  # the key is kept
    assert providers(client)["openai"]["model"] == "chosen-model"
    removed = client.put(
        "/api/settings", json={"providers": {"openai": {"api_key": ""}}}
    )
    openai = next(p for p in removed.json()["providers"] if p["id"] == "openai")
    assert openai["has_key"] is False


def test_active_provider_and_readiness(client: TestClient) -> None:
    client.put(
        "/api/settings",
        json={
            "active_provider": "groq",
            "providers": {"groq": {"api_key": "gsk-x", "model": "m1"}},
        },
    )
    body = client.get("/api/settings").json()
    assert body["active_provider"] == "groq" and body["llm_ready"] is True
    client.put("/api/settings", json={"providers": {"groq": {"model": ""}}})
    assert (
        client.get("/api/settings").json()["llm_ready"] is False
    )  # a key alone is not enough


def test_env_key_is_reported_per_provider(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "gsk-env")
    by_id = providers(client)
    assert by_id["groq"]["has_key"] and by_id["groq"]["key_from_env"]
    assert not by_id["openai"]["key_from_env"]


def test_validation(client: TestClient) -> None:
    assert (
        client.put("/api/settings", json={"active_provider": "skynet"}).status_code
        == 422
    )
    assert (
        client.put(
            "/api/settings", json={"providers": {"skynet": {"api_key": "x"}}}
        ).status_code
        == 422
    )
    assert (
        client.put(
            "/api/settings", json={"providers": {"openai": {"api_key": "x" * 401}}}
        ).status_code
        == 422
    )


def test_claude_models_are_listed_before_a_key_but_others_need_one(
    client: TestClient,
) -> None:
    builtin = client.post("/api/settings/providers/anthropic/models").json()
    assert builtin["source"] == "builtin"
    assert [m["id"] for m in builtin["models"]] == [
        "claude-opus-5-5",
        "claude-sonnet-5-5",
        "claude-haiku-5-5",
        "claude-fable-5-2",
    ]
    needs = client.post("/api/settings/providers/openai/models")
    assert needs.status_code == 409 and "chave da OpenAI" in needs.json()["detail"]
    assert client.post("/api/settings/providers/skynet/models").status_code == 422


def test_models_come_from_the_provider_with_the_typed_or_saved_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[tuple[str, str]] = []

    def fake_list(provider_id: str, key: str) -> list[ModelInfo]:
        seen.append((provider_id, key))
        return [ModelInfo("zeta-1", "zeta-1"), ModelInfo("alpha-2", "alpha-2")]

    monkeypatch.setattr(settings_api, "list_models", fake_list)
    typed = client.post(
        "/api/settings/providers/openai/models", json={"api_key": " sk-typed "}
    ).json()
    assert typed["source"] == "live" and [m["id"] for m in typed["models"]] == [
        "zeta-1",
        "alpha-2",
    ]
    client.put("/api/settings", json={"providers": {"groq": {"api_key": "gsk-saved"}}})
    client.post("/api/settings/providers/groq/models")
    assert seen == [("openai", "sk-typed"), ("groq", "gsk-saved")]


def test_a_refused_key_is_a_400_with_a_portuguese_message_never_a_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def refuse(provider_id: str, key: str) -> list[ModelInfo]:
        raise ProviderError(
            "A chave da OpenAI foi recusada. Confira se ela está certa.", 401
        )

    monkeypatch.setattr(settings_api, "list_models", refuse)
    response = client.post(
        "/api/settings/providers/openai/models", json={"api_key": "bad"}
    )
    assert response.status_code == 400 and "recusada" in response.json()["detail"]


def use_llm(client: TestClient, llm: FakeLLM | None) -> None:
    overrides = client.app.dependency_overrides  # type: ignore[attr-defined]
    overrides[llm_dependency] = lambda: llm


def test_connection_test_for_the_active_or_a_given_provider(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    use_llm(client, None)
    assert client.post("/api/settings/test-llm").json()["ok"] is False
    use_llm(client, FakeLLM(Ping(ok=True, message="pong")))
    assert client.post("/api/settings/test-llm").json()["ok"] is True
    use_llm(client, FakeLLM(LLMUnavailable("down", "A chave da API foi recusada.")))
    failed = client.post("/api/settings/test-llm").json()
    assert failed == {"ok": False, "message": "A chave da API foi recusada."}
    chosen: list[str] = []

    def fake_get_llm(engine: object, provider_id: str | None = None) -> FakeLLM:
        chosen.append(provider_id or "")
        return FakeLLM(Ping(ok=True, message="pong"))

    monkeypatch.setattr(settings_api, "get_llm", fake_get_llm)
    assert (
        client.post("/api/settings/test-llm", json={"provider": "groq"}).json()["ok"]
        is True
    )
    assert chosen == ["groq"]


def test_the_config_file_never_leaks_through_the_api(client: TestClient) -> None:
    client.put(
        "/api/settings", json={"providers": {"anthropic": {"api_key": "sk-ant-zzz"}}}
    )
    assert "sk-ant-zzz" not in json.dumps(client.get("/api/settings").json())
