"""
Создание пользователя в БД (хеш пароля как у FastAPI Users).

Запуск из каталога backend (миграции: alembic upgrade head; для SQLite файл БД создаётся автоматически):

  .venv\\Scripts\\python.exe -m scripts.create_user <email> <password>

Пример:

  .venv\\Scripts\\python.exe -m scripts.create_user user@example.com "MySecretPass"
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import func, select

from app.db.session import AsyncSessionLocal
from app.models.user import User
from fastapi_users.password import PasswordHelper


async def main(email: str, password: str) -> None:
    email_norm = email.strip().lower()

    async with AsyncSessionLocal() as session:
        res = await session.execute(
            select(User).where(func.lower(User.email) == email_norm),
        )
        if res.scalar_one_or_none() is not None:
            print(f"Пользователь уже существует: {email_norm}", file=sys.stderr)
            return

        ph = PasswordHelper()
        user = User(
            email=email_norm,
            hashed_password=ph.hash(password),
            is_active=True,
            is_superuser=False,
            is_verified=False,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        print(f"OK id={user.id} email={user.email}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(
            "Использование: python -m scripts.create_user <email> <password>",
            file=sys.stderr,
        )
        sys.exit(2)
    asyncio.run(main(sys.argv[1], sys.argv[2]))
