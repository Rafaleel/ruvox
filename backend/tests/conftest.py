from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlmodel import Session

from app.db import database_engine, run_migrations, seed


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
