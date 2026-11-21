from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Item
from app.services.selection import SeedContentPlanner

NOW = datetime(2026, 11, 20, 12, tzinfo=UTC)
LYRIC = "Выдуманная песня про кота и про луну"  # invented text


def save_song(client: TestClient, words: list[tuple[str, str]]) -> int:
    song_id: int = client.post(
        "/api/songs", json={"title": "Песня", "text": LYRIC}
    ).json()["id"]
    entries = [
        {
            "text": text,
            "pronunciation_pt": "pro-nun-si-A",
            "meaning_pt": meaning,
            "excerpt": LYRIC,
        }
        for text, meaning in words
    ]
    saved = client.post(
        f"/api/songs/{song_id}/confirm", json={"entries": entries}
    ).json()
    assert saved["created"] == len(words)
    return song_id


WORDS = [
    ("кота", "gato"),
    ("луну", "lua"),
    ("песня", "canção"),
    ("про", "sobre"),
    ("и", "e"),
    ("выдуманная", "inventada"),
]


def test_song_session_only_uses_that_songs_words(client: TestClient) -> None:
    first = save_song(client, WORDS[:3])
    second = save_song(client, [("звезда", "estrela"), ("река", "rio")])
    body = client.post("/api/sessions", json={"size": 5, "song_id": first}).json()
    prompts = " ".join(q["prompt"] for q in body["questions"])
    assert body["questions"] and all(
        q["type"] == "word_to_meaning" for q in body["questions"]
    )
    assert "кота" in prompts and "звезда" not in prompts
    other = client.post("/api/sessions", json={"size": 5, "song_id": second}).json()
    assert {q["prompt"] for q in other["questions"]} == {
        "O que significa «звезда» (pro-nun-si-A)?",
        "O que significa «река» (pro-nun-si-A)?",
    }


def test_unknown_song_is_404(client: TestClient) -> None:
    assert client.post("/api/sessions", json={"song_id": 999}).status_code == 404


def test_song_without_items_has_nothing_to_practice(client: TestClient) -> None:
    song_id = client.post("/api/songs", json={"title": "x", "text": LYRIC}).json()["id"]
    assert client.post("/api/sessions", json={"song_id": song_id}).status_code == 409


def test_general_sessions_leave_song_words_out(client: TestClient, db: Session) -> None:
    save_song(client, WORDS)  # six song items, all due immediately
    with Session(client.app.state.engine) as session:  # type: ignore[attr-defined]
        picked = SeedContentPlanner(session).select(1, 10)
    assert picked and all(p.item.source != "song" for p in picked)
    with Session(client.app.state.engine) as session:  # type: ignore[attr-defined]
        song_only = SeedContentPlanner(session, song_id=1).select(1, 10)
    assert song_only and all(p.item.source == "song" for p in song_only)


def test_song_words_never_block_progress_unlocking(client: TestClient) -> None:
    save_song(client, WORDS[:2])
    assert client.get("/api/progress").json()["words_total"] == 50  # seed only
    with Session(client.app.state.engine) as session:  # type: ignore[attr-defined]
        assert session.get(Item, 1) is not None
