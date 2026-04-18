"""
Вспомогательные функции для обработчиков исключений БД.
"""

from sqlalchemy.exc import IntegrityError


def postgres_sqlstate(exc: BaseException | None) -> str | None:
    """Извлекает SQLSTATE из цепочки исключений (asyncpg / psycopg)."""
    current: BaseException | None = exc
    while current is not None:
        code = getattr(current, "sqlstate", None) or getattr(current, "pgcode", None)
        if code:
            return str(code)
        current = current.__cause__ or current.__context__
    return None


def integrity_error_detail(exc: IntegrityError) -> str:
    """Сообщение по коду PostgreSQL или тексту SQLite."""
    code = postgres_sqlstate(getattr(exc, "orig", None) or exc)
    if code == "23505":
        return "Запись с такими уникальными полями уже существует (часто — этот email уже зарегистрирован)."
    if code == "23503":
        return "Связанная сущность не найдена (например, указан несуществующий исполнитель задачи)."
    msg = str(getattr(exc, "orig", None) or exc).lower()
    if "unique" in msg and "constraint" in msg:
        return "Запись с такими уникальными полями уже существует (часто — этот email уже зарегистрирован)."
    if "foreign key" in msg:
        return "Связанная сущность не найдена (например, указан несуществующий исполнитель задачи)."
    return "Операция нарушает ограничения базы данных."
