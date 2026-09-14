from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str | None = None
    llm_model: str = "gpt-5-mini"
    sms_provider: str = "console"
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None
    database_url: str
    business_file: Path = Path("business.example.json")
    public_base_url: str = "http://localhost:8000"
    timezone: str = "America/Los_Angeles"
    quiet_hour_start: int = 20
    quiet_hour_end: int = 8
    history_limit: int = 30
    jwt_secret: str


@lru_cache
def get_settings() -> Settings:
    return Settings()

