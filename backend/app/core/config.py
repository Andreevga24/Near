"""
Настройки приложения из переменных окружения.
По умолчанию БД — локальный файл SQLite (см. DATABASE_URL).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Загрузка .env и переменных среды."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Async SQLAlchemy + aiosqlite (файл БД относительно текущего каталога при старте, обычно backend/)
    DATABASE_URL: str = "sqlite+aiosqlite:///./near.db"

    # JWT (подпись access_token). В проде задайте длинную случайную строку через .env
    JWT_SECRET: str = "near-dev-secret-change-me-use-openssl-rand-hex-32"
    JWT_LIFETIME_SECONDS: int = 60 * 60 * 24  # 24 часа


settings = Settings()
