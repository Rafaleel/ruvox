import subprocess
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from pydantic import SecretStr
from sqlalchemy import inspect
from sqlmodel import Session, select

from app.config import (
    ProviderConfig,
    Settings,
    effective_settings,
    read_settings,
    write_settings,
)
from app.db import database_engine, run_migrations, seed
from app.models import Item, User


def test_migrate_and_seed_twice(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    engine = database_engine()
    run_migrations(engine)
    with Session(engine) as session:
        seed(session)
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
        "llmcall",
        "userprofile",
    }
    with Session(engine) as session:
        assert session.get(User, 1)
        letters = session.exec(select(Item).where(Item.kind == "letter")).all()
        assert len(letters) == len({item.text for item in letters}) == 33
        assert Counter(item.group for item in letters) == {1: 5, 2: 7, 3: 21}
    engine.dispose()


def test_concurrent_first_launch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    startup = """
from app.db import database_engine, run_migrations, seed
from sqlmodel import Session
engine = database_engine()
run_migrations(engine)
with Session(engine) as session:
    seed(session)
"""

    def launch(_: int) -> None:
        subprocess.run([sys.executable, "-c", startup], check=True, timeout=15)

    with ThreadPoolExecutor(max_workers=3) as workers:
        list(workers.map(launch, range(3)))


def test_settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("RUVOX_LLM_MODEL", raising=False)
    assert read_settings().api_key is None
    stored = Settings(
        providers={
            "anthropic": ProviderConfig(
                api_key=SecretStr("test-only"), model="test-model"
            )
        }
    )
    write_settings(stored)
    assert (tmp_path / "config.json").stat().st_mode & 0o777 == 0o600
    assert read_settings() == stored
    monkeypatch.setenv("ANTHROPIC_API_KEY", "override")
    assert effective_settings().api_key == SecretStr("override")
    assert read_settings() == stored


def test_legacy_flat_settings_become_the_anthropic_provider(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    (tmp_path / "config.json").write_text(
        '{"model": "claude-haiku-5-5", "api_key": "sk-old", "lan_enabled": true}'
    )
    settings = read_settings()
    assert settings.active_provider == "anthropic" and settings.lan_enabled
    assert settings.model == "claude-haiku-5-5"
    assert settings.api_key == SecretStr("sk-old")
    write_settings(settings)  # rewritten in the new shape, nothing lost
    assert read_settings() == settings
    assert "providers" in (tmp_path / "config.json").read_text()


def test_environment_overrides_per_provider(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "sk-env-openai")
    monkeypatch.setenv("GROQ_API_KEY", "gsk-env")
    monkeypatch.setenv("RUVOX_LLM_PROVIDER", "groq")
    monkeypatch.setenv("RUVOX_LLM_MODEL", "some-groq-model")
    settings = effective_settings()
    assert settings.active_provider == "groq"
    assert (
        settings.api_key == SecretStr("gsk-env") and settings.model == "some-groq-model"
    )
    assert settings.provider("openai").api_key == SecretStr("sk-env-openai")
    assert (
        settings.provider("anthropic").model == "claude-sonnet-5-5"
    )  # the only default
    assert settings.provider("openai").model == ""  # never guessed
