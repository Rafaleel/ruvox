import json
import logging
import os
from pathlib import Path
from tempfile import mkstemp
from typing import Any

from platformdirs import user_data_path
from pydantic import BaseModel, SecretStr, model_validator


def data_dir() -> Path:
    override = os.getenv("RUVOX_DATA_DIR")
    return Path(override).expanduser() if override else user_data_path("ruvox")


PROVIDER_IDS = ("anthropic", "openai", "groq")
KEY_ENV = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "groq": "GROQ_API_KEY",
}
# Only Claude has a default: its model ids are known. For the other providers the user
# picks one from the list the provider itself returns, so a name is never guessed.
DEFAULT_MODELS = {"anthropic": "claude-sonnet-5-5", "openai": "", "groq": ""}


class ProviderConfig(BaseModel):
    api_key: SecretStr | None = None
    model: str = ""


class Settings(BaseModel):
    active_provider: str = "anthropic"
    providers: dict[str, ProviderConfig] = {}
    lan_enabled: bool = False  # serve the phone on the local network (Phase 4)
    lan_port: int = 8787  # stable, so the phone can bookmark the address
    lan_secret: str | None = (
        None  # signs the pairing cookie; rotating it unpairs everyone
    )

    @model_validator(mode="before")
    @classmethod
    def from_legacy(cls, data: Any) -> Any:
        """Settings written before multi-provider support had one flat key and model."""
        if isinstance(data, dict) and ("api_key" in data or "model" in data):
            data = dict(data)
            providers = dict(data.get("providers") or {})
            claude = dict(providers.get("anthropic") or {})
            claude.setdefault("api_key", data.pop("api_key", None))
            claude.setdefault("model", data.pop("model", "") or "")
            data.pop("api_key", None)
            data.pop("model", None)
            providers["anthropic"] = claude
            data["providers"] = providers
        return data

    def provider(self, provider_id: str) -> ProviderConfig:
        stored = self.providers.get(provider_id) or ProviderConfig()
        return ProviderConfig(
            api_key=stored.api_key,
            model=stored.model or DEFAULT_MODELS.get(provider_id, ""),
        )

    @property
    def api_key(self) -> SecretStr | None:
        return self.provider(self.active_provider).api_key

    @property
    def model(self) -> str:
        return self.provider(self.active_provider).model


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
    """Saved settings with environment overrides (keys per provider, model, provider)."""
    settings = read_settings()
    for provider_id, env_name in KEY_ENV.items():
        if key := os.getenv(env_name):
            stored = settings.providers.get(provider_id) or ProviderConfig()
            settings.providers[provider_id] = stored.model_copy(
                update={"api_key": SecretStr(key)}
            )
    provider = os.getenv("RUVOX_LLM_PROVIDER")
    if provider in PROVIDER_IDS and provider:
        settings.active_provider = provider
    if model := os.getenv("RUVOX_LLM_MODEL"):
        stored = settings.providers.get(settings.active_provider) or ProviderConfig()
        settings.providers[settings.active_provider] = stored.model_copy(
            update={"model": model}
        )
    return settings


def write_settings(settings: Settings) -> None:
    directory = data_dir()
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temporary = mkstemp(dir=directory)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(
                {
                    "active_provider": settings.active_provider,
                    "providers": {
                        provider_id: {
                            "api_key": config.api_key.get_secret_value()
                            if config.api_key
                            else None,
                            "model": config.model,
                        }
                        for provider_id, config in settings.providers.items()
                    },
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
