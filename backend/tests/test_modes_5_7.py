import json
from typing import Any

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.sessions import llm_dependency
from app.models import ReviewState
from tests.fakes import FakeLLM

LYRIC = "Про кота и про луну над домом"  # invented text


def start(client: TestClient, **body: Any) -> dict[str, Any]:
    response = client.post("/api/sessions", json=body)
    assert response.status_code == 200, response.text
    data: dict[str, Any] = response.json()
    return data


def answer(client: TestClient, sid: int, qid: int, text: str) -> Any:
    return client.post(
        f"/api/sessions/{sid}/answers",
        json={"question_id": qid, "answer": text, "time_ms": 100},
    )


def test_flashcards_reveal_the_card_and_are_self_graded(client: TestClient) -> None:
    session = start(client, mode=5, size=5)
    cards = session["questions"]
    assert len(cards) == 5 and all(
        c["input_kind"] == "flip" and c["options"] == [] for c in cards
    )
    assert all(c["reveal"] for c in cards) and all(len(c["prompt"]) == 1 for c in cards)
    knew = answer(client, session["session_id"], cards[0]["id"], "knew").json()
    assert (knew["correct"], knew["grade"], knew["requeued_question"]) == (
        True,
        4,
        None,
    )
    missed = answer(client, session["session_id"], cards[1]["id"], "missed").json()
    assert (missed["correct"], missed["grade"]) == (False, 1)
    assert missed["requeued_question"]["prompt"] == cards[1]["prompt"]
    assert (
        answer(client, session["session_id"], cards[2]["id"], "maybe").status_code
        == 422
    )


def test_pairs_round_grades_every_item_by_its_mistakes(client: TestClient) -> None:
    session = start(client, mode=6, size=5)
    (round_,) = session["questions"]  # a new learner has five letters: one round
    assert round_["input_kind"] == "pairs" and len(round_["pairs"]) == 5
    assert all(p["left"] and p["right"] for p in round_["pairs"])
    ids = [p["item_id"] for p in round_["pairs"]]
    result = answer(
        client, session["session_id"], round_["id"], json.dumps({str(ids[0]): 2})
    ).json()
    assert (result["correct"], result["grade"]) == (False, 2)
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        grades = {s.item_id: s.last_grade for s in db.exec(select(ReviewState))}
    assert grades[ids[0]] == 2 and all(grades[i] == 4 for i in ids[1:])


def test_clean_pairs_round_is_correct_and_bad_json_is_rejected(
    client: TestClient,
) -> None:
    session = start(client, mode=6, size=5)
    qid, sid = session["questions"][0]["id"], session["session_id"]
    assert answer(client, sid, qid, "not json").status_code == 422
    result = answer(client, sid, qid, "{}").json()
    assert (result["correct"], result["grade"]) == (True, 4)


def test_pairs_rounds_follow_the_session_size(client: TestClient) -> None:
    letters = client.get("/api/items", params={"kind": "letter"}).json()
    assert len(letters) == 33
    # a general mix of 10 asks for two rounds of up to six items; five new letters fit one
    assert len(start(client, mode=6, size=10)["questions"]) == 1


def save_song(client: TestClient) -> int:
    song_id: int = client.post(
        "/api/songs", json={"title": "Песня", "text": LYRIC}
    ).json()["id"]
    entries = [
        {"text": t, "pronunciation_pt": "pro-nun", "meaning_pt": m, "excerpt": LYRIC}
        for t, m in [("кота", "gato"), ("луну", "lua"), ("домом", "casa")]
    ]
    client.post(f"/api/songs/{song_id}/confirm", json={"entries": entries})
    return song_id


def test_cloze_blanks_the_word_in_a_song_excerpt(client: TestClient) -> None:
    song_id = save_song(client)
    session = start(client, mode=7, size=5, song_id=song_id)
    questions = session["questions"]
    assert len(questions) == 3
    for q in questions:
        assert (
            q["type"] == "cloze"
            and "____" in q["prompt"]
            and len(set(q["options"])) == 4
        )
    first = questions[0]

    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        from app.models import Question

        right = db.exec(select(Question).where(Question.id == first["id"])).one().answer
    assert right in first["options"]
    assert (
        answer(client, session["session_id"], first["id"], right).json()["correct"]
        is True
    )


def test_cloze_needs_song_excerpts(client: TestClient) -> None:
    assert client.post("/api/sessions", json={"mode": 7}).status_code == 409


def test_flashcards_and_cloze_never_call_the_model(client: TestClient) -> None:
    llm = FakeLLM()
    client.app.dependency_overrides[llm_dependency] = lambda: llm  # type: ignore[attr-defined]
    start(client, mode=5, size=5)
    start(client, mode=6, size=5)
    assert llm.calls == []
