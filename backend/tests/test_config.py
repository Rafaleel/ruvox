from pathlib import Path

import pytest

from app.config import read_settings


def test_corrupt_config_falls_back_to_defaults(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RUVOX_DATA_DIR", str(tmp_path))
    (tmp_path / "config.json").write_text("{bad")
    assert read_settings().model == "claude-sonnet-5-5"
