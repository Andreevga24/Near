"""Допустимые значения поля Project.kind (сценарий доски)."""

from enum import StrEnum


class ProjectKind(StrEnum):
    development = "development"
    operations_support = "operations_support"
    marketing_campaigns = "marketing_campaigns"
    hr_recruiting = "hr_recruiting"
    training = "training"
    onboarding = "onboarding"
    crm_sales = "crm_sales"
    procurement = "procurement"
    product_roadmap = "product_roadmap"
    content_editorial = "content_editorial"
    events = "events"
    goals_kpi = "goals_kpi"
    strategy = "strategy"
    personal = "personal"
    general = "general"


DEFAULT_PROJECT_KIND = ProjectKind.general
