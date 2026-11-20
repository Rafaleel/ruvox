from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.main import app
from app.models import Item, ItemKind
from app.services.seed import ALPHABET, seed_alphabet


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


def test_alphabet_has_33_unique_letters_in_3_groups() -> None:
    letters = [letter for letter, _, _ in ALPHABET]
    assert len(letters) == 33
    assert len(set(letters)) == 33
    assert {group for _, _, group in ALPHABET} == {1, 2, 3}


def test_seed_is_idempotent(session: Session) -> None:
    assert seed_alphabet(session) == 33
    assert seed_alphabet(session) == 0
    rows = session.exec(select(Item).where(Item.kind == ItemKind.LETTER)).all()
    assert len(rows) == 33


def test_health() -> None:
    assert TestClient(app).get("/health").json() == {"status": "ok"}
