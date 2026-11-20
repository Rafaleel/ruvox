import json
import logging
import os
from pathlib import Path
from tempfile import mkstemp

from platformdirs import user_data_path
from pydantic import BaseModel, SecretStr


def data_dir() -> Path:
    override = os.getenv("RUVOX_DATA_DIR")
    return Path(override).expanduser() if override else user_data_path("ruvox")


class Settings(BaseModel):
    api_key: SecretStr | None = None
    model: str = "claude-sonnet-5-5"
    lan_enabled: bool = False  # serve the phone on the local network (Phase 4)
    lan_port: int = 8787  # stable, so the phone can bookmark the address
    lan_secret: str | None = (
        None  # signs the pairing cookie; rotating it unpairs everyone
    )


def read_settings() -> Settings:
    path = data_dir() / "config.json"
    if not path.exists():
        return Settings()
    try:
        return Settings.model_validate_json(path.read_bytes())
    except ValueError:
        # A corrupt file must not take the app down; behave as unconfigured (offline mode).
        logging.getLogger(__name__).warning("ignoring unreadable %s", path)
        return Settings()


def effective_settings() -> Settings:
    settings = read_settings()
    if key := os.getenv("ANTHROPIC_API_KEY"):
        settings.api_key = SecretStr(key)
    if model := os.getenv("RUVOX_LLM_MODEL"):
        settings.model = model
    return settings


def write_settings(settings: Settings) -> None:
    directory = data_dir()
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temporary = mkstemp(dir=directory)
    try:
        with os.fdopen(fd, "w") as stream:
            key = settings.api_key.get_secret_value() if settings.api_key else None
            json.dump(
                {
                    "model": settings.model,
                    "api_key": key,
                    "lan_enabled": settings.lan_enabled,
                    "lan_port": settings.lan_port,
                    "lan_secret": settings.lan_secret,
                },
                stream,
            )
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, directory / "config.json")
    finally:
        Path(temporary).unlink(missing_ok=True)
