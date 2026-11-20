from collections import Counter
from pathlib import Path

import pytest
from pydantic import SecretStr
from sqlalchemy import inspect
from sqlmodel import Session, select

from app.config import Settings, read_settings, write_settings
from app.db import database_engine, run_migrations, seed
from app.models import Item, User


def test_migrate_and_seed_twice(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    engine = database_engine()
    for _ in range(2):
        run_migrations(engine)
        with Session(engine) as session:
            seed(session)
    assert set(inspect(engine).get_table_names()) == {
        "alembic_version",
        "user",
        "item",
        "song",
        "attempt",
        "question",
        "studysession",
        "reviewstate",
    }
    with Session(engine) as session:
        assert session.get(User, 1)
        letters = session.exec(select(Item)).all()
        assert len(letters) == len({item.text for item in letters}) == 33
        assert Counter(item.group for item in letters) == {1: 5, 2: 7, 3: 21}
    engine.dispose()


def test_settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("RUVOX_LLM_MODEL", raising=False)
    assert read_settings().api_key is None
    stored = Settings(api_key=SecretStr("test-only"), model="test-model")
    write_settings(stored)
    assert (tmp_path / "config.json").stat().st_mode & 0o777 == 0o600
    assert read_settings() == stored
    monkeypatch.setenv("ANTHROPIC_API_KEY", "override")
    assert read_settings().api_key == SecretStr("override")
