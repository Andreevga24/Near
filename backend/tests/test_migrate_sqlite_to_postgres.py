"""Тест скрипта переноса SQLite → PostgreSQL."""

from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi_users.password import PasswordHelper
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models  # noqa: F401
from app.db.base import Base
from app.models.user import User

_BACKEND = Path(__file__).resolve().parent.parent
_PG_URL = os.environ.get(
    "TARGET_DATABASE_URL",
    "postgresql+asyncpg://near:near@localhost:5432/near",
)


def _can_connect_postgres() -> bool:
    try:
        import asyncpg  # noqa: F401
    except ImportError:
        return False
    return _PG_URL.startswith("postgresql")


@pytest_asyncio.fixture
async def sqlite_with_user(tmp_path: Path) -> Path:
    db_path = tmp_path / "migrate_src.db"
    url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        ph = PasswordHelper()
        session.add(
            User(
                id=uuid.uuid4(),
                email=f"migrate_{uuid.uuid4().hex[:8]}@example.com",
                hashed_password=ph.hash("TestPass123!"),
                is_active=True,
                is_superuser=False,
                is_verified=False,
            ),
        )
        await session.commit()

    await engine.dispose()
    return db_path


@pytest.mark.asyncio
@pytest.mark.skipif(not _can_connect_postgres(), reason="PostgreSQL не настроен")
async def test_migrate_sqlite_to_postgres(sqlite_with_user: Path) -> None:
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "scripts.migrate_sqlite_to_postgres",
            "--source",
            str(sqlite_with_user),
            "--target",
            _PG_URL,
            "--truncate-target",
        ],
        cwd=_BACKEND,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "users:" in proc.stdout
    assert "Перенос завершён успешно" in proc.stdout

    engine = create_async_engine(_PG_URL)
    async with engine.connect() as conn:
        result = await conn.execute(select(func.count()).select_from(User.__table__))
        assert int(result.scalar_one()) >= 1
    await engine.dispose()
