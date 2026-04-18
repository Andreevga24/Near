"""
Порядок колонок канбана по project.kind.
Синхронизировать с frontend/src/constants/boardPresets.ts.
"""

from app.constants.project_kinds import ProjectKind

BOARD_STATUS_PRESETS: dict[str, tuple[str, ...]] = {
    ProjectKind.development.value: ("backlog", "ready", "in_progress", "review", "done"),
    ProjectKind.operations_support.value: ("new", "triaged", "in_progress", "waiting", "resolved"),
    ProjectKind.marketing_campaigns.value: ("idea", "approval", "production", "launch", "analytics"),
    ProjectKind.hr_recruiting.value: ("sourced", "screening", "interview", "offer", "closed"),
    ProjectKind.training.value: ("planned", "materials", "live", "homework", "done"),
    ProjectKind.onboarding.value: ("pre_start", "week_1", "week_2", "stabilization", "done"),
    ProjectKind.crm_sales.value: ("lead", "qualified", "proposal", "negotiation", "won", "lost"),
    ProjectKind.procurement.value: ("request", "approval", "tender", "delivery", "closed"),
    ProjectKind.product_roadmap.value: ("discovery", "committed", "building", "shipped", "measuring"),
    ProjectKind.content_editorial.value: ("idea", "draft", "editing", "publish_prep", "published"),
    ProjectKind.events.value: ("concept", "logistics", "promo", "event_day", "retrospective"),
    ProjectKind.goals_kpi.value: ("kpi_draft", "active", "at_risk", "achieved", "missed"),
    ProjectKind.strategy.value: ("hypothesis", "analysis", "decision", "execution", "monitoring"),
    ProjectKind.personal.value: ("wishlist", "in_progress", "done"),
    ProjectKind.general.value: ("todo", "in_progress", "done"),
}


def preset_for_kind(kind: str | None) -> tuple[str, ...]:
    if not kind:
        return BOARD_STATUS_PRESETS[ProjectKind.general.value]
    return BOARD_STATUS_PRESETS.get(kind, BOARD_STATUS_PRESETS[ProjectKind.general.value])


def first_status_for_kind(kind: str | None) -> str:
    return preset_for_kind(kind)[0]
