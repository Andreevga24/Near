"""
Точка входа FastAPI-приложения Near.
Шаг 1: базовое API, CORS и проверка работоспособности.
Шаг 2: модели и сессия БД подключаются при импорте (см. app.models).
Шаг 3: JWT и эндпоинты /register, /login, /me (FastAPI Users).
Шаг 4: CRUD проектов и задач (только для владельца проекта).
Шаг 5: WebSocket /ws/{project_id} — рассылка при изменении задач.
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError

from app.core.config import settings
from app.errors import integrity_error_detail
from app.security.middleware import RateLimitMiddleware, SecurityHeadersMiddleware

# Импорт моделей регистрирует таблицы в metadata (Alembic / SQLAlchemy)
import app.models  # noqa: F401
from app.api.projects import router as projects_router
from app.api.tasks import router as tasks_router
from app.api.task_links import router as task_links_router
from app.api.focus import router as focus_router
from app.api.comments import router as comments_router
from app.api.timeline import router as timeline_router
from app.api.checklist import router as checklist_router
from app.api.presets import router as presets_router
from app.api.public import router as public_router
from app.api.workspace import router as workspace_router
from app.api.project_members import router as project_members_router
from app.api.feed import router as feed_router
from app.api.notifications import router as notifications_router
from app.api.reports import router as reports_router
from app.api.time import router as time_router
from app.api.gantt import router as gantt_router
from app.api.support import router as support_router
from app.api.messenger import router as messenger_router
from app.api.user_lookup import router as user_lookup_router
from app.api.search import router as search_router
from app.api.legal import router as legal_router
from app.ws.router import router as ws_router
from app.auth.manager import auth_backend, current_active_user, fastapi_users
from app.db.session import engine
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Корректно освобождаем пул соединений при остановке Uvicorn."""
    yield
    await engine.dispose()


# Создаём приложение с метаданными для OpenAPI / Swagger
app = FastAPI(
    title="Near API",
    description="Backend системы управления проектами Near",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)


@app.exception_handler(OperationalError)
async def handle_db_operational(_request: Request, _exc: OperationalError) -> JSONResponse:
    """Нет связи с БД (неверный DATABASE_URL, SQLite недоступен, PostgreSQL не отвечает)."""
    hint = (
        "Проверьте DATABASE_URL в backend/.env "
        "(SQLite: ./near.db; PostgreSQL: postgresql+asyncpg://...; "
        "локально: docker compose up -d postgres, см. docs/POSTGRES_MIGRATION.md)."
    )
    return JSONResponse(
        status_code=503,
        content={"detail": f"Не удалось подключиться к базе данных. {hint}"},
    )


@app.exception_handler(ProgrammingError)
async def handle_db_programming(_request: Request, exc: ProgrammingError) -> JSONResponse:
    """Частый случай: миграции не применены — таблицы users и т.д. отсутствуют."""
    raw = str(getattr(exc, "orig", exc) or exc).lower()
    if "does not exist" in raw or "undefinedcolumn" in raw or "no such table" in raw:
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    "Схема базы не создана. В каталоге backend выполните: alembic upgrade head."
                ),
            },
        )
    return JSONResponse(
        status_code=500,
        content={"detail": "Ошибка SQL при обращении к базе данных."},
    )


@app.exception_handler(IntegrityError)
async def handle_db_integrity(_request: Request, exc: IntegrityError) -> JSONResponse:
    """Нарушение ограничений БД: уникальный ключ, внешний ключ и т.д."""
    return JSONResponse(
        status_code=400,
        content={"detail": integrity_error_detail(exc)},
    )


# Security headers и rate limiting (до CORS)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# CORS: в production — только CORS_ORIGINS из env
_cors_kwargs: dict = {
    "allow_origins": settings.cors_origins_list(),
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": ["Authorization", "Content-Type", "Accept", "X-Requested-With"],
}
if not settings.is_production:
    _cors_kwargs["allow_origin_regex"] = r"http://(localhost|127\.0\.0\.1)(:\d+)?$"
app.add_middleware(CORSMiddleware, **_cors_kwargs)

_trusted = settings.trusted_hosts_list()
if _trusted:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=_trusted)

# --- Аутентификация (JWT): регистрация с согласием — app.api.legal ---
app.include_router(legal_router)
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(task_links_router)
app.include_router(focus_router)
app.include_router(comments_router)
app.include_router(timeline_router)
app.include_router(checklist_router)
app.include_router(presets_router)
app.include_router(public_router)
app.include_router(workspace_router)
app.include_router(project_members_router)
app.include_router(feed_router)
app.include_router(notifications_router)
app.include_router(reports_router)
app.include_router(time_router)
app.include_router(gantt_router)
app.include_router(support_router)
app.include_router(messenger_router)
app.include_router(user_lookup_router)
app.include_router(search_router)
app.include_router(ws_router)


@app.get("/me", response_model=UserRead, tags=["auth"])
async def read_me(user: User = Depends(current_active_user)) -> UserRead:
    """Текущий пользователь по Bearer JWT (Authorization: Bearer <token>)."""
    return UserRead.model_validate(user)


@app.get("/health", tags=["Служебное"])
async def health() -> dict[str, str]:
    """Простая проверка: API жив и отвечает."""
    return {"status": "ok", "service": "near-api"}


@app.get("/", tags=["Служебное"])
async def root() -> dict[str, str]:
    """Корневой маршрут — краткая подсказка."""
    return {"message": "Near API", "docs": "/docs"}
