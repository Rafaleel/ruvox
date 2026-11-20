from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db import database_engine, run_migrations, seed
from app.main import create_app


@pytest.fixture
def db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Session]:
    """A migrated, seeded database in a throwaway data dir."""
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    engine = database_engine()
    run_migrations(engine)
    with Session(engine) as session:
        seed(session)
        yield session
    engine.dispose()


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    with TestClient(create_app(tmp_path / "no-web"), base_url="http://localhost") as c:
        yield c
