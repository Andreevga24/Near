/**
 * Сценарии досок (поле project.kind) — совпадают с backend ProjectKind.
 */

export const PROJECT_KIND_VALUES = [
  'development',
  'operations_support',
  'marketing_campaigns',
  'hr_recruiting',
  'training',
  'onboarding',
  'crm_sales',
  'procurement',
  'product_roadmap',
  'content_editorial',
  'events',
  'goals_kpi',
  'strategy',
  'personal',
  'general',
] as const

export type ProjectKind = (typeof PROJECT_KIND_VALUES)[number]

export const PROJECT_KIND_LABEL: Record<ProjectKind, string> = {
  development: 'Разработка / IT',
  operations_support: 'Операции / поддержка',
  marketing_campaigns: 'Маркетинг / кампании',
  hr_recruiting: 'HR / найм',
  training: 'Обучение',
  onboarding: 'Внедрение (onboarding)',
  crm_sales: 'CRM / продажи',
  procurement: 'Закупки / тендеры',
  product_roadmap: 'Продукт / roadmap',
  content_editorial: 'Контент / редакция',
  events: 'События',
  goals_kpi: 'Цели / OKR или KPI',
  strategy: 'Стратегия / инициативы',
  personal: 'Личные цели',
  general: 'Общий / смешанный',
}

export const DEFAULT_PROJECT_KIND: ProjectKind = 'general'

export function isProjectKind(s: string | undefined | null): s is ProjectKind {
  if (s == null || s === '') return false
  return (PROJECT_KIND_VALUES as readonly string[]).includes(s)
}

export function labelProjectKind(kind: string | undefined | null): string {
  if (kind == null || kind === '') return PROJECT_KIND_LABEL.general
  return isProjectKind(kind) ? PROJECT_KIND_LABEL[kind] : kind
}

/** Короткий тег для бейджа в списке (как «CRM» в боковой панели). */
export const PROJECT_KIND_BADGE: Record<ProjectKind, string> = {
  development: 'IT',
  operations_support: 'OPS',
  marketing_campaigns: 'MKT',
  hr_recruiting: 'HR',
  training: 'LRN',
  onboarding: 'ONB',
  crm_sales: 'CRM',
  procurement: 'PRC',
  product_roadmap: 'PRD',
  content_editorial: 'EDT',
  events: 'EVT',
  goals_kpi: 'KPI',
  strategy: 'STR',
  personal: 'ME',
  general: 'MIX',
}

export function badgeProjectKind(kind: string | undefined | null): string {
  if (kind == null || kind === '') return PROJECT_KIND_BADGE.general
  return isProjectKind(kind) ? PROJECT_KIND_BADGE[kind] : kind.slice(0, 3).toUpperCase()
}
