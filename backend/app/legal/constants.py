"""Версии юридических документов и реквизиты оператора (шаблон — заменить перед продом)."""

from app.core.config import settings

PRIVACY_VERSION = "2026-06-26"
TERMS_VERSION = "2026-06-26"
CONSENT_VERSION = "2026-06-26"


def operator_name() -> str:
    return settings.LEGAL_OPERATOR_NAME


def operator_email() -> str:
    return settings.LEGAL_CONTACT_EMAIL
