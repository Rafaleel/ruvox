import httpx
import pytest

from app.agents.providers import PROVIDERS, ProviderError, list_models, parse_models


def mock_client(handler: httpx.MockTransport) -> httpx.Client:
    return httpx.Client(transport=handler)


def test_openai_keeps_only_chat_and_reasoning_models() -> None:
    payload = {
        "object": "list",
        "data": [
            {"id": "gpt-4o", "object": "model"},
            {"id": "o3-mini", "object": "model"},
            {"id": "chatgpt-4o-latest", "object": "model"},
            {"id": "text-embedding-3-small"},
            {"id": "whisper-1"},
            {"id": "tts-1"},
            {"id": "dall-e-3"},
            {"id": "omni-moderation-latest"},
            {"id": "gpt-4o-realtime-preview"},
            {"id": "gpt-4o-audio-preview"},
            {"id": "gpt-image-1"},
            {"id": "davinci-002"},
            {"id": "gpt-4o-transcribe"},
        ],
    }
    assert [m.id for m in parse_models("openai", payload)] == [
        "chatgpt-4o-latest",
        "gpt-4o",
        "o3-mini",
    ]


def test_groq_drops_speech_and_guard_models_and_inactive_ones() -> None:
    payload = {
        "data": [
            {"id": "llama-3.3-70b-versatile", "active": True},
            {"id": "whisper-large-v3", "active": True},
            {"id": "meta-llama/llama-guard-4-12b", "active": True},
            {"id": "playai-tts", "active": True},
            {"id": "old-model", "active": False},
            {"id": "openai/gpt-oss-20b"},
        ]
    }
    assert [m.id for m in parse_models("groq", payload)] == [
        "llama-3.3-70b-versatile",
        "openai/gpt-oss-20b",
    ]


def test_anthropic_uses_display_names() -> None:
    payload = {
        "data": [
            {
                "type": "model",
                "id": "claude-sonnet-5-5",
                "display_name": "Claude Sonnet 5.5",
            }
        ]
    }
    (model,) = parse_models("anthropic", payload)
    assert (model.id, model.label) == ("claude-sonnet-5-5", "Claude Sonnet 5.5")


def test_unexpected_payloads_are_reported_in_portuguese() -> None:
    with pytest.raises(ProviderError, match="formato inesperado"):
        parse_models("openai", {"nope": 1})


def test_each_provider_is_called_with_its_own_authentication() -> None:
    seen: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen[request.url.host] = request
        return httpx.Response(
            200, json={"data": [{"id": "claude-x"}, {"id": "gpt-x"}, {"id": "llama-x"}]}
        )

    client = mock_client(httpx.MockTransport(handler))
    list_models("anthropic", "sk-ant", client=client)
    list_models("openai", "sk-oa", client=client)
    list_models("groq", "gsk-g", client=client)
    anthropic = seen["api.anthropic.com"]
    assert (
        anthropic.headers["x-api-key"] == "sk-ant"
        and anthropic.headers["anthropic-version"] == "2023-06-01"
    )
    assert seen["api.openai.com"].headers["authorization"] == "Bearer sk-oa"
    assert seen["api.groq.com"].url.path == "/openai/v1/models"
    assert seen["api.groq.com"].headers["authorization"] == "Bearer gsk-g"


def test_anthropic_models_are_paged() -> None:
    pages = [
        {"data": [{"id": "claude-a"}], "has_more": True, "last_id": "claude-a"},
        {"data": [{"id": "claude-b"}], "has_more": False, "last_id": "claude-b"},
    ]
    requested: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested.append(dict(request.url.params))
        return httpx.Response(200, json=pages[len(requested) - 1])

    models = list_models(
        "anthropic", "k", client=mock_client(httpx.MockTransport(handler))
    )
    assert [m.id for m in models] == ["claude-a", "claude-b"]
    assert requested[1]["after_id"] == "claude-a"


@pytest.mark.parametrize(
    ("status", "expected"),
    [
        (401, "foi recusada"),
        (403, "foi recusada"),
        (429, "limitou o uso"),
        (500, r"erro \(500\)"),
    ],
)
def test_http_errors_are_explained(status: int, expected: str) -> None:
    client = mock_client(httpx.MockTransport(lambda r: httpx.Response(status, json={})))
    with pytest.raises(ProviderError, match=expected) as caught:
        list_models("openai", "k", client=client)
    assert caught.value.status == status


def test_a_network_failure_is_a_clear_message() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    with pytest.raises(ProviderError, match="Confira a internet"):
        list_models("groq", "k", client=mock_client(httpx.MockTransport(handler)))


def test_the_labels_say_who_owns_the_key() -> None:
    assert {p.id: (p.label, p.maker) for p in PROVIDERS.values()} == {
        "anthropic": ("Anthropic", "Claude"),
        "openai": ("OpenAI", "ChatGPT"),
        "groq": ("Groq", "Groq"),
    }
