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
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError

from app.errors import integrity_error_detail

# Импорт моделей регистрирует таблицы в metadata (Alembic / SQLAlchemy)
import app.models  # noqa: F401
from app.api.projects import router as projects_router
from app.api.tasks import router as tasks_router
from app.ws.router import router as ws_router
from app.auth.manager import auth_backend, current_active_user, fastapi_users
from app.db.session import engine
from app.models.user import User
from app.schemas.user import UserCreate, UserRead


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
)


@app.exception_handler(OperationalError)
async def handle_db_operational(_request: Request, _exc: OperationalError) -> JSONResponse:
    """Нет связи с БД (неверный DATABASE_URL, файл SQLite недоступен, сеть к серверу БД)."""
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Не удалось подключиться к базе данных. Проверьте DATABASE_URL в backend/.env "
                "(для SQLite по умолчанию файл ./near.db в каталоге backend), "
                "права на каталог и снова попробуйте запрос."
            ),
        },
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


# CORS: Vite dev / preview на localhost и 127.0.0.1 с любым портом
# На проде замените на конкретные домены фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Аутентификация (JWT): регистрация и вход на корневых путях по ТЗ ---
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="",
    tags=["auth"],
)

app.include_router(projects_router)
app.include_router(tasks_router)
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
