import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from platformdirs import user_data_path
from pydantic import BaseModel, SecretStr


def data_dir() -> Path:
    override = os.getenv("RUVOX_DATA_DIR")
    return Path(override).expanduser() if override else user_data_path("ruvox")


class Settings(BaseModel):
    api_key: SecretStr | None = None
    model: str = "claude-sonnet-5-5"


def read_settings() -> Settings:
    path = data_dir() / "config.json"
    settings = (
        Settings.model_validate_json(path.read_bytes()) if path.exists() else Settings()
    )
    if key := os.getenv("ANTHROPIC_API_KEY"):
        settings.api_key = SecretStr(key)
    if model := os.getenv("RUVOX_LLM_MODEL"):
        settings.model = model
    return settings


def write_settings(settings: Settings) -> None:
    directory = data_dir()
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=directory, mode="w", delete=False) as tmp:
        try:
            json.dump(
                {
                    "model": settings.model,
                    "api_key": settings.api_key.get_secret_value()
                    if settings.api_key
                    else None,
                },
                tmp,
            )
            tmp.flush()
            os.replace(tmp.name, directory / "config.json")
        finally:
            Path(tmp.name).unlink(missing_ok=True)
