from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost/diney"

    @property
    def clean_database_url(self) -> str:
        """Strip sslmode & channel_binding from URL — asyncpg uses connect_args instead."""
        parsed = urlparse(self.DATABASE_URL)
        params = parse_qs(parsed.query)
        params.pop("sslmode", None)
        params.pop("channel_binding", None)
        clean_query = urlencode(params, doseq=True)
        return urlunparse(parsed._replace(query=clean_query))

    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"

    SMSBRIDGE_HOST: str = ""
    SMSBRIDGE_API_KEY: str = ""
    SMSBRIDGE_DEVICE_ID: str = ""

    STORAGE_BACKEND: str = "local"

    DEV_MODE: bool = True

    SEED_PHONE: str = "+91XXXXXXXXXX"

    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
