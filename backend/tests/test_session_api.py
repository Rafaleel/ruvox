from typing import Any

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import Question, ReviewState


def start(client: TestClient, **body: object) -> dict[str, Any]:
    response = client.post("/api/sessions", json={"size": 5, **body})
    assert response.status_code == 200, response.text
    data: dict[str, Any] = response.json()
    return data


def truth(client: TestClient, question_id: int) -> Question:
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        question = db.get(Question, question_id)
        assert question is not None
        return question


def answer(
    client: TestClient, session_id: int, question_id: int, text: str, ms: int = 1000
) -> Any:
    return client.post(
        f"/api/sessions/{session_id}/answers",
        json={"question_id": question_id, "answer": text, "time_ms": ms},
    )


def test_full_session_for_a_new_learner(client: TestClient) -> None:
    session = start(client)
    assert session["source"] == "offline"
    questions = session["questions"]
    assert len(questions) == 5
    for question in questions:
        assert "answer" not in question and "explanation" not in question
        assert len(question["options"]) == 4

    for question in questions[:3]:
        right = truth(client, question["id"]).answer
        result = answer(client, session["session_id"], question["id"], right).json()
        assert result["correct"] and result["grade"] == 5
        assert result["correct_answer"] == right and result["requeued_question"] is None
    wrong = questions[3]
    miss = answer(client, session["session_id"], wrong["id"], "nope").json()
    assert not miss["correct"] and miss["grade"] == 1 and miss["explanation"]

    summary = client.post(f"/api/sessions/{session['session_id']}/finish").json()
    assert (summary["score"], summary["answered"], summary["correct"]) == (3, 4, 3)
    assert [i["id"] for i in summary["items_to_review"]] == wrong["item_ids"]
    assert (
        client.post(f"/api/sessions/{session['session_id']}/finish").json()["score"]
        == 3
    )


def test_review_state_is_updated_through_srs(client: TestClient) -> None:
    session = start(client)
    first = session["questions"][0]
    right = truth(client, first["id"]).answer
    answer(client, session["session_id"], first["id"], right, ms=9000)  # slow: grade 4
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        state = db.exec(select(ReviewState)).one()
        assert (state.item_id, state.repetitions, state.last_grade) == (
            first["item_ids"][0],
            1,
            4,
        )


def test_wrong_answers_are_requeued_at_most_twice(client: TestClient) -> None:
    session = start(client)
    question = session["questions"][0]
    seen = [question]
    for _ in range(3):
        result = answer(client, session["session_id"], seen[-1]["id"], "nope").json()
        if result["requeued_question"] is None:
            break
        seen.append(result["requeued_question"])
    assert len(seen) == 3
    assert {q["prompt"] for q in seen} == {question["prompt"]}
    assert len({q["id"] for q in seen}) == 3


def test_rejections(client: TestClient) -> None:
    session = start(client)
    sid, qid = session["session_id"], session["questions"][0]["id"]
    assert answer(client, sid, qid, "x").status_code == 200
    assert answer(client, sid, qid, "x").status_code == 409
    assert answer(client, 999, qid, "x").status_code == 404
    assert answer(client, sid, 99999, "x").status_code == 404
    other = start(client)
    assert answer(client, other["session_id"], qid, "x").status_code == 404
    client.post(f"/api/sessions/{sid}/finish")
    assert answer(client, sid, session["questions"][1]["id"], "x").status_code == 409
    assert client.post("/api/sessions/999/finish").status_code == 404


def test_validation_and_empty_modes(client: TestClient) -> None:
    assert client.post("/api/sessions", json={"mode": 7}).status_code == 422
    assert client.post("/api/sessions", json={"size": 2}).status_code == 422
    assert client.post("/api/sessions", json={"mode": 3}).status_code == 409


def test_progress_and_items(client: TestClient) -> None:
    progress = client.get("/api/progress").json()
    assert progress["due_count"] == 0
    assert [(g["group"], g["total"], g["learned"]) for g in progress["groups"]] == [
        (1, 5, 0),
        (2, 7, 0),
        (3, 21, 0),
    ]
    assert (progress["words_unlocked"], progress["words_total"]) == (0, 50)
    assert len(client.get("/api/items", params={"kind": "letter"}).json()) == 33
    assert len(client.get("/api/items", params={"kind": "word"}).json()) == 50
