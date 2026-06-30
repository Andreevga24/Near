"""Схемы юридических документов и регистрации с согласием."""

from pydantic import BaseModel, Field, field_validator


class LegalMetaRead(BaseModel):
    privacy_version: str
    terms_version: str
    consent_version: str
    operator_name: str
    operator_email: str


class RegisterWithConsent(BaseModel):
    email: str = Field(..., max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    accept_privacy: bool
    accept_terms: bool
    privacy_version: str = Field(..., min_length=1, max_length=32)
    terms_version: str = Field(..., min_length=1, max_length=32)

    @field_validator("accept_privacy", "accept_terms")
    @classmethod
    def must_accept(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Требуется согласие")
        return v


class DeleteAccountBody(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)
    confirmation: str = Field(..., min_length=1, max_length=32)

    @field_validator("confirmation")
    @classmethod
    def must_confirm(cls, v: str) -> str:
        if v.strip().upper() != "DELETE":
            raise ValueError('Введите DELETE для подтверждения')
        return v
