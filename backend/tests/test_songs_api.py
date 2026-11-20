from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import Item, ReviewState

# Invented text only: never put real lyrics in tests or fixtures.
LYRICS = "Это моя выдуманная песня\nПро кота и про луну"


def add(client: TestClient, **body: object) -> dict:  # type: ignore[type-arg]
    payload = {"title": "Песня", "artist": "Никто", "text": LYRICS, **body}
    response = client.post("/api/songs", json=payload)
    assert response.status_code == 201, response.text
    data: dict = response.json()  # type: ignore[type-arg]
    return data


def test_create_list_get_delete(client: TestClient) -> None:
    song = add(client)
    assert (song["title"], song["items"], song["characters"]) == (
        "Песня",
        0,
        len(LYRICS),
    )
    assert [s["id"] for s in client.get("/api/songs").json()] == [song["id"]]
    detail = client.get(f"/api/songs/{song['id']}").json()
    assert detail["text"] == LYRICS
    assert "text" not in client.get("/api/songs").json()[0]
    assert client.delete(f"/api/songs/{song['id']}").status_code == 204
    assert client.get("/api/songs").json() == []
    assert client.get(f"/api/songs/{song['id']}").status_code == 404
    assert client.delete(f"/api/songs/{song['id']}").status_code == 404


def test_limits_and_validation(client: TestClient) -> None:
    too_long = client.post("/api/songs", json={"title": "x", "text": "а" * 20_001})
    assert too_long.status_code == 413 and "máximo" in too_long.json()["detail"]
    assert (
        client.post("/api/songs", json={"title": "x", "text": "а" * 20_000}).status_code
        == 201
    )
    assert client.post("/api/songs", json={"title": "", "text": "а"}).status_code == 422
    assert client.post("/api/songs", json={"title": "x", "text": ""}).status_code == 422


def test_deleting_a_song_removes_its_items_and_review_states(
    client: TestClient,
) -> None:
    song = add(client)
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        item = Item(
            kind="word",
            text="кот",
            pronunciation="kot",
            meaning="gato",
            source="song",
            song_id=song["id"],
        )
        db.add(item)
        db.flush()
        db.add(ReviewState(item_id=item.id or 0, next_review=datetime.now(UTC)))
        db.commit()
    assert client.get("/api/songs").json()[0]["items"] == 1
    client.delete(f"/api/songs/{song['id']}")
    with Session(client.app.state.engine) as db:  # type: ignore[attr-defined]
        assert db.exec(select(Item).where(Item.source == "song")).all() == []
        assert db.exec(select(ReviewState)).all() == []
        assert len(db.exec(select(Item).where(Item.source == "seed")).all()) == 83
