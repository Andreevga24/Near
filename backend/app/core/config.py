"""
Настройки приложения из переменных окружения.
По умолчанию БД — локальный файл SQLite (см. DATABASE_URL).
"""

from typing import Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "near-dev-secret-change-me-use-openssl-rand-hex-32"


class Settings(BaseSettings):
    """Загрузка .env и переменных среды."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENV: str = "development"

    # sqlite+aiosqlite:///./near.db  или  postgresql+asyncpg://user:pass@host:5432/near
    DATABASE_URL: str = "sqlite+aiosqlite:///./near.db"

    # Пул соединений PostgreSQL (для SQLite не используется)
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    JWT_SECRET: str = DEFAULT_JWT_SECRET
    JWT_LIFETIME_SECONDS: int = 60 * 60 * 8

    TASK_ARCHIVE_RETENTION_DAYS: int = 30

    CORS_ORIGINS: str = ""
    TRUSTED_HOSTS: str = ""
    RATE_LIMIT_ENABLED: bool = True

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    NOTIFICATION_EMAIL_FROM: str = ""

    DUE_REMINDER_HOURS: int = 24

    LEGAL_OPERATOR_NAME: str = "Оператор сервиса Near (укажите ИП/ООО)"
    LEGAL_CONTACT_EMAIL: str = "privacy@example.com"

    @model_validator(mode="after")
    def validate_production(self) -> Self:
        if self.ENV.lower() != "production":
            return self
        if self.JWT_SECRET == DEFAULT_JWT_SECRET or len(self.JWT_SECRET) < 32:
            raise ValueError(
                "В production задайте JWT_SECRET длиной ≥32 символов "
                "(openssl rand -hex 32). Дефолтный секрет запрещён.",
            )
        if not self.CORS_ORIGINS.strip():
            raise ValueError(
                "В production задайте CORS_ORIGINS — список доменов фронтенда через запятую.",
            )
        if "sqlite" in self.DATABASE_URL.lower():
            raise ValueError(
                "В production используйте PostgreSQL (postgresql+asyncpg://...), не SQLite.",
            )
        return self

    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip():
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

    def trusted_hosts_list(self) -> list[str]:
        if not self.TRUSTED_HOSTS.strip():
            return []
        return [h.strip() for h in self.TRUSTED_HOSTS.split(",") if h.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL.lower()


settings = Settings()
