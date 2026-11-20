from typing import Any

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.agents.corrector import Correction
from app.agents.llm import LLMUnavailable
from app.api.sessions import llm_dependency
from app.models import Question
from tests.fakes import FakeLLM


def start_typing(client: TestClient, llm: FakeLLM | None) -> tuple[int, int, str]:
    """Returns session id, first question id and the expected Cyrillic text."""
    overrides = client.app.dependency_overrides  # type: ignore[attr-defined]
    overrides[llm_dependency] = lambda: None  # the session itself is built offline
    response = client.post("/api/sessions", json={"mode": 4, "size": 5})
    overrides[llm_dependency] = lambda: llm
    assert response.status_code == 200, response.text
    body = response.json()
    question = body["questions"][0]
    assert question["input_kind"] == "text" and question["options"] == []
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        stored = db.get(Question, question["id"])
        assert stored is not None
        return body["session_id"], question["id"], stored.answer


def answer(client: TestClient, sid: int, qid: int, text: str) -> dict[str, Any]:
    response = client.post(
        f"/api/sessions/{sid}/answers",
        json={"question_id": qid, "answer": text, "time_ms": 100},
    )
    assert response.status_code == 200, response.text
    data: dict[str, Any] = response.json()
    return data


def correction(**changes: Any) -> Correction:
    base: dict[str, Any] = {
        "correct": False,
        "grade": 2,
        "explanation_pt": "Quase!",
        "normalized_answer": "zzz",
    }
    return Correction(**{**base, **changes})


def test_exact_answer_ignores_case_and_never_calls_the_model(
    client: TestClient,
) -> None:
    llm = FakeLLM()
    sid, qid, expected = start_typing(client, llm)
    result = answer(client, sid, qid, expected.lower())
    assert result["correct"] and result["grade"] == 5 and llm.calls == []


def test_a_model_cannot_turn_a_wrong_answer_into_a_right_one(
    client: TestClient,
) -> None:
    llm = FakeLLM(correction(correct=True, grade=5, normalized_answer="outra coisa"))
    sid, qid, _ = start_typing(client, llm)
    result = answer(client, sid, qid, "zzz")
    assert not result["correct"] and result["grade"] == 2
    assert result["explanation"] == "Quase!" and len(llm.calls) == 1


def test_corrector_confirming_the_expected_text_is_accepted(client: TestClient) -> None:
    sid, qid, expected = start_typing(client, None)
    llm = FakeLLM(correction(correct=True, grade=5, normalized_answer=expected))
    client.app.dependency_overrides[llm_dependency] = lambda: llm  # type: ignore[attr-defined]
    result = answer(client, sid, qid, f"  {expected}. ")
    assert (
        result["correct"] and result["grade"] == 4 and result["explanation"] == "Quase!"
    )


def test_without_a_model_a_wrong_typed_answer_is_grade_one(client: TestClient) -> None:
    sid, qid, expected = start_typing(client, None)
    result = answer(client, sid, qid, "zzz")
    assert (result["correct"], result["grade"]) == (False, 1)
    assert expected in result["explanation"]


def test_model_failure_falls_back_to_offline(client: TestClient) -> None:
    sid, qid, _ = start_typing(client, FakeLLM(LLMUnavailable("down")))
    result = answer(client, sid, qid, "zzz")
    assert (result["correct"], result["grade"]) == (False, 1)


def test_blank_answer_skips_the_model(client: TestClient) -> None:
    llm = FakeLLM()
    sid, qid, _ = start_typing(client, llm)
    assert answer(client, sid, qid, "   ")["grade"] == 1 and llm.calls == []
