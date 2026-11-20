from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    anthropic_api_key: str = ""
    ruvox_llm_model: str = "claude-sonnet-5-5"
    ruvox_database_url: str = "sqlite:///./ruvox.db"


settings = Settings()
