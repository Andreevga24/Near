"""Security headers и rate limiting (in-memory, для одного инстанса)."""

from __future__ import annotations

import time
from collections import defaultdict
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings

# (method, path_prefix) -> (max_hits, window_seconds)
_RATE_RULES: tuple[tuple[str, str, int, int], ...] = (
    ("POST", "/login", 15, 60),
    ("POST", "/register", 5, 60),
    ("GET", "/public/", 120, 60),
    ("GET", "/users/resolve-emails", 30, 60),
)

_hits: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    if request.client:
        return request.client.host[:64]
    return "unknown"


def _rate_limit_key(request: Request) -> tuple[str, int, int] | None:
    path = request.url.path
    method = request.method.upper()
    for rule_method, prefix, limit, window in _RATE_RULES:
        if method == rule_method and path.startswith(prefix):
            return f"{rule_method}:{prefix}:{_client_ip(request)}", limit, window
    return None


def _is_allowed(key: str, limit: int, window: int) -> bool:
    now = time.monotonic()
    bucket = _hits[key]
    cutoff = now - window
    while bucket and bucket[0] < cutoff:
        bucket.pop(0)
    if len(bucket) >= limit:
        return False
    bucket.append(now)
    return True


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if settings.ENV == "production":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)
        rule = _rate_limit_key(request)
        if rule is not None:
            key, limit, window = rule
            if not _is_allowed(key, limit, window):
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Слишком много запросов. Повторите позже."},
                    headers={"Retry-After": str(window)},
                )
        return await call_next(request)
