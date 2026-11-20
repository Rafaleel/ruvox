from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db import database_engine, run_migrations, seed
from app.main import create_app


@pytest.fixture(autouse=True)
def isolated_data_dir(
    tmp_path_factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """No test may ever touch the real user data directory or config.json."""
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path_factory.mktemp("data")))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("RUVOX_LLM_MODEL", raising=False)


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
    with TestClient(
        create_app(tmp_path / "no-web"),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),  # the desktop itself
    ) as c:
        yield c
