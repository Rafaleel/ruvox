import json
from pathlib import Path

import pytest
from sqlmodel import Session, col, select

from app.db import ROOT, database_engine, run_migrations, seed
from app.models import Item


def test_word_seed_matches_content_and_is_idempotent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    expected = json.loads((ROOT / "app/data/words.json").read_text(encoding="utf-8"))
    assert len(expected) == len({word["text"] for word in expected}) == 50
    engine = database_engine()
    run_migrations(engine)
    with Session(engine) as session:
        seed(session)
        seed(session)
        letters = set(session.exec(select(Item.text).where(Item.kind == "letter")))
        words = session.exec(
            select(Item).where(Item.kind == "word").order_by(col(Item.id))
        ).all()
        assert len(words) == 50
        for word, entry in zip(words, expected, strict=True):
            assert word.model_dump(include=set(entry)) == entry
            assert word.source == "seed" and 1 <= word.difficulty <= 3
            assert (
                word.meaning.strip()
                and word.pronunciation.strip()
                and word.text.strip()
            )
            assert set(word.text.upper()) <= letters | set(" ?-")
    engine.dispose()
