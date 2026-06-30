"""
Перенос данных Near: SQLite → PostgreSQL.

Запуск из каталога backend:

  py -m scripts.migrate_sqlite_to_postgres \\
    --source ./near.db \\
    --target postgresql+asyncpg://near:near@localhost:5432/near

Или только проверка (без записи):

  py -m scripts.migrate_sqlite_to_postgres --source ./near.db --target ... --dry-run

Перед переносом на целевой БД выполняется alembic upgrade head (отключить: --skip-alembic).
Повторный перенос: --truncate-target (очистит таблицы в PostgreSQL).
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import func, insert, select, text
from sqlalchemy.ext.asyncio import create_async_engine

import app.models  # noqa: F401
from app.db.base import Base

# Порядок с учётом внешних ключей
MIGRATION_TABLES: tuple[str, ...] = (
    "users",
    "kind_presets",
    "projects",
    "tasks",
    "comments",
    "task_links",
    "task_activities",
    "task_checklist_items",
    "user_workspace_stores",
    "project_members",
    "project_invites",
    "user_notifications",
    "support_tickets",
    "support_ticket_replies",
    "chat_channels",
    "chat_messages",
    "task_time_entries",
    "user_consent_logs",
)

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _normalize_sqlite_url(source: str) -> str:
    if source.startswith("sqlite"):
        return source
    path = Path(source)
    if not path.is_absolute():
        path = (BACKEND_DIR / path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"Файл SQLite не найден: {path}")
    return f"sqlite+aiosqlite:///{path.as_posix()}"


def _run_alembic(target_url: str) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = target_url
    print("Применяю миграции на целевой БД (alembic upgrade head)...")
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=env,
        check=True,
    )


async def _count_rows(engine, table_name: str) -> int:
    table = Base.metadata.tables[table_name]
    async with engine.connect() as conn:
        result = await conn.execute(select(func.count()).select_from(table))
        return int(result.scalar_one())


async def _truncate_target(engine) -> None:
    print("Очистка целевых таблиц (TRUNCATE CASCADE)...")
    async with engine.begin() as conn:
        for name in reversed(MIGRATION_TABLES):
            await conn.execute(text(f'TRUNCATE TABLE "{name}" RESTART IDENTITY CASCADE'))


async def _copy_table(src_engine, dst_engine, table_name: str, *, dry_run: bool) -> tuple[int, int]:
    table = Base.metadata.tables[table_name]
    async with src_engine.connect() as src_conn:
        result = await src_conn.execute(select(table))
        rows = [dict(row) for row in result.mappings().all()]

    if dry_run or not rows:
        return len(rows), 0

    async with dst_engine.begin() as dst_conn:
        await dst_conn.execute(insert(table), rows)
    return len(rows), len(rows)


async def migrate(
    source_url: str,
    target_url: str,
    *,
    dry_run: bool,
    skip_alembic: bool,
    truncate_target: bool,
) -> int:
    missing = [t for t in MIGRATION_TABLES if t not in Base.metadata.tables]
    if missing:
        raise RuntimeError(f"Таблицы не зарегистрированы в metadata: {missing}")

    if not skip_alembic and not dry_run:
        _run_alembic(target_url)

    src_engine = create_async_engine(source_url)
    dst_engine = create_async_engine(target_url)

    try:
        if truncate_target and not dry_run:
            await _truncate_target(dst_engine)

        print(f"{'[dry-run] ' if dry_run else ''}Источник: {source_url}")
        print(f"{'[dry-run] ' if dry_run else ''}Цель:    {target_url}")
        print()

        total_src = 0
        total_dst = 0
        mismatches: list[str] = []

        for table_name in MIGRATION_TABLES:
            src_n, dst_n = await _copy_table(src_engine, dst_engine, table_name, dry_run=dry_run)
            total_src += src_n
            if not dry_run:
                pg_n = await _count_rows(dst_engine, table_name)
                if pg_n != src_n:
                    mismatches.append(f"{table_name}: sqlite={src_n}, postgres={pg_n}")
                print(f"  {table_name}: {src_n} → {pg_n}")
            else:
                print(f"  {table_name}: {src_n} строк")
            total_dst += dst_n

        print()
        if dry_run:
            print(f"Итого строк в SQLite: {total_src}")
            print("Запись не выполнялась (--dry-run).")
        else:
            print(f"Скопировано строк: {total_dst}")
            if mismatches:
                print("ОШИБКА: расхождение счётчиков:", file=sys.stderr)
                for line in mismatches:
                    print(f"  - {line}", file=sys.stderr)
                return 1
            print("Перенос завершён успешно.")
            print()
            print("Дальше: укажите в backend/.env")
            print(f"  DATABASE_URL={target_url}")
        return 0
    finally:
        await src_engine.dispose()
        await dst_engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Перенос данных Near: SQLite → PostgreSQL")
    parser.add_argument(
        "--source",
        default="./near.db",
        help="Путь к near.db или sqlite+aiosqlite:///... (по умолчанию ./near.db)",
    )
    parser.add_argument(
        "--target",
        default=os.environ.get(
            "TARGET_DATABASE_URL",
            "postgresql+asyncpg://near:near@localhost:5432/near",
        ),
        help="URL PostgreSQL (postgresql+asyncpg://...)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Только подсчёт строк, без записи")
    parser.add_argument("--skip-alembic", action="store_true", help="Не запускать alembic upgrade head")
    parser.add_argument(
        "--truncate-target",
        action="store_true",
        help="Очистить таблицы PostgreSQL перед копированием",
    )
    args = parser.parse_args()

    try:
        source_url = _normalize_sqlite_url(args.source)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        print(
            "Создайте SQLite-БД локально (alembic upgrade head + регистрация) "
            "или укажите --source с путём к файлу.",
            file=sys.stderr,
        )
        sys.exit(1)

    if not args.target.startswith("postgresql"):
        print("Целевая БД должна быть PostgreSQL (postgresql+asyncpg://...)", file=sys.stderr)
        sys.exit(1)

    code = asyncio.run(
        migrate(
            source_url,
            args.target,
            dry_run=args.dry_run,
            skip_alembic=args.skip_alembic,
            truncate_target=args.truncate_target,
        ),
    )
    sys.exit(code)


if __name__ == "__main__":
    main()
