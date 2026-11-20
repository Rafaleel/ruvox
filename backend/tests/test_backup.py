import json
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import Attempt, Item, Question, ReviewState, Song, StudySession

LYRIC = "Про кота и про луну над домом"  # invented text


@pytest.fixture(autouse=True)
def no_env_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def populate(client: TestClient) -> None:
    song_id = client.post("/api/songs", json={"title": "Песня", "text": LYRIC}).json()[
        "id"
    ]
    entries = [
        {
            "text": "кота",
            "pronunciation_pt": "KO-ta",
            "meaning_pt": "gato",
            "excerpt": LYRIC,
        },
        {
            "text": "луну",
            "pronunciation_pt": "lu-NU",
            "meaning_pt": "lua",
            "excerpt": LYRIC,
        },
    ]
    client.post(f"/api/songs/{song_id}/confirm", json={"entries": entries})
    session = client.post("/api/sessions", json={"song_id": song_id, "size": 5}).json()
    for question in session["questions"]:
        client.post(
            f"/api/sessions/{session['session_id']}/answers",
            json={"question_id": question["id"], "answer": "x", "time_ms": 10},
        )
    client.post(f"/api/sessions/{session['session_id']}/finish")
    letters = client.post("/api/sessions", json={"size": 5, "mode": 5}).json()
    client.post(
        f"/api/sessions/{letters['session_id']}/answers",
        json={
            "question_id": letters["questions"][0]["id"],
            "answer": "knew",
            "time_ms": 1,
        },
    )


def counts(client: TestClient) -> dict[str, int]:
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        return {
            "songs": len(db.exec(select(Song)).all()),
            "song_items": len(db.exec(select(Item).where(Item.source == "song")).all()),
            "seed_items": len(db.exec(select(Item).where(Item.source == "seed")).all()),
            "review": len(db.exec(select(ReviewState)).all()),
            "sessions": len(db.exec(select(StudySession)).all()),
            "questions": len(db.exec(select(Question)).all()),
            "attempts": len(db.exec(select(Attempt)).all()),
        }


def test_export_reset_import_round_trip(client: TestClient) -> None:
    populate(client)
    before = counts(client)
    assert before["songs"] == 1 and before["song_items"] == 2 and before["attempts"] > 1
    mastery = client.get("/api/progress").json()
    exported = client.post("/api/backup/export")
    assert "attachment" in exported.headers["content-disposition"]
    backup: dict[str, Any] = exported.json()

    assert client.post("/api/data/reset").status_code == 204
    after_reset = counts(client)
    assert after_reset["songs"] == after_reset["review"] == after_reset["attempts"] == 0
    assert after_reset["seed_items"] == before["seed_items"] == 83

    restored = client.post("/api/backup/import", json=backup).json()
    assert restored["songs"] == 1 and restored["items"] == 2
    assert counts(client) == before
    assert client.get("/api/progress").json() == mastery
    song = client.get("/api/songs").json()[0]
    assert song["items"] == 2
    # question item ids point at real items again
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        valid = {i.id for i in db.exec(select(Item))}
        assert all(set(q.item_ids) <= valid for q in db.exec(select(Question)))


def test_import_survives_changed_item_ids(client: TestClient) -> None:
    populate(client)
    backup: dict[str, Any] = client.post("/api/backup/export").json()
    client.post("/api/data/reset")
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        # a new seed word shifts later ids
        db.add(
            Item(
                kind="word",
                text="ёж",
                pronunciation="iôj",
                meaning="ouriço",
                source="seed",
            )
        )
        db.commit()
    assert client.post("/api/backup/import", json=backup).status_code == 200
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        letter_states = db.exec(
            select(ReviewState, Item).join(Item, Item.id == ReviewState.item_id)  # type: ignore[arg-type]
        ).all()
        assert any(item.source == "seed" for _, item in letter_states)


def test_a_broken_backup_changes_nothing(client: TestClient) -> None:
    populate(client)
    before = counts(client)
    backup: dict[str, Any] = client.post("/api/backup/export").json()
    del backup["attempts"]
    bad = client.post("/api/backup/import", json=backup)
    assert bad.status_code == 422 and "corrompido" in bad.json()["detail"]
    assert counts(client) == before
    wrong_version = client.post("/api/backup/import", json={"version": 99})
    assert (
        wrong_version.status_code == 422
        and "compatível" in wrong_version.json()["detail"]
    )
    assert counts(client) == before


def test_export_never_contains_the_api_key(client: TestClient) -> None:
    client.put("/api/settings", json={"api_key": "sk-ant-very-secret"})
    populate(client)
    text = client.post("/api/backup/export").text
    assert "sk-ant" not in text and "api_key" not in text
    assert json.loads(text)["version"] == 1


def test_reset_keeps_settings(client: TestClient) -> None:
    client.put(
        "/api/settings", json={"api_key": "sk-keep", "model": "claude-haiku-5-5"}
    )
    populate(client)
    client.post("/api/data/reset")
    settings = client.get("/api/settings").json()
    assert settings["has_key"] is True and settings["model"] == "claude-haiku-5-5"
