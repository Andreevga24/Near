/**
 * Пресеты колонок по project.kind — синхронно с backend/app/constants/board_presets.py.
 */

import type { ProjectKind } from './projectKinds'

export const BOARD_STATUS_PRESETS: Record<ProjectKind, readonly string[]> = {
  development: ['backlog', 'ready', 'in_progress', 'review', 'done'],
  operations_support: ['new', 'triaged', 'in_progress', 'waiting', 'resolved'],
  marketing_campaigns: ['idea', 'approval', 'production', 'launch', 'analytics'],
  hr_recruiting: ['sourced', 'screening', 'interview', 'offer', 'closed'],
  training: ['planned', 'materials', 'live', 'homework', 'done'],
  onboarding: ['pre_start', 'week_1', 'week_2', 'stabilization', 'done'],
  crm_sales: ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
  procurement: ['request', 'approval', 'tender', 'delivery', 'closed'],
  product_roadmap: ['discovery', 'committed', 'building', 'shipped', 'measuring'],
  content_editorial: ['idea', 'draft', 'editing', 'publish_prep', 'published'],
  events: ['concept', 'logistics', 'promo', 'event_day', 'retrospective'],
  goals_kpi: ['kpi_draft', 'active', 'at_risk', 'achieved', 'missed'],
  strategy: ['hypothesis', 'analysis', 'decision', 'execution', 'monitoring'],
  personal: ['wishlist', 'in_progress', 'done'],
  general: ['todo', 'in_progress', 'done'],
}

export const STATUS_COLUMN_LABELS: Record<string, string> = {
  todo: 'К выполнению',
  wishlist: 'Хочу сделать',
  in_progress: 'В работе',
  done: 'Готово',
  backlog: 'Бэклог',
  ready: 'Готово к работе',
  review: 'Ревью',
  new: 'Новые',
  triaged: 'Разобрано',
  waiting: 'Ожидание',
  resolved: 'Решено',
  idea: 'Идея',
  approval: 'Согласование',
  production: 'Производство',
  launch: 'Запуск',
  analytics: 'Аналитика',
  sourced: 'Отклики',
  screening: 'Скрининг',
  interview: 'Интервью',
  offer: 'Оффер',
  closed: 'Закрыто',
  planned: 'Запланировано',
  materials: 'Материалы',
  live: 'Проведение',
  homework: 'Домашка / проверка',
  pre_start: 'До старта',
  week_1: 'Неделя 1',
  week_2: 'Неделя 2',
  stabilization: 'Стабилизация',
  lead: 'Лид',
  qualified: 'Квалификация',
  proposal: 'Предложение',
  negotiation: 'Переговоры',
  won: 'Выиграно',
  lost: 'Проиграно',
  request: 'Заявка',
  tender: 'Тендер / КП',
  delivery: 'Поставка',
  discovery: 'Discovery',
  committed: 'В плане',
  building: 'В разработке',
  shipped: 'В проде',
  measuring: 'Измерение эффекта',
  draft: 'Черновик',
  editing: 'Редактура',
  publish_prep: 'К публикации',
  published: 'Опубликовано',
  concept: 'Концепт',
  logistics: 'Логистика',
  promo: 'Продвижение',
  event_day: 'День события',
  retrospective: 'Разбор',
  kpi_draft: 'Черновик цели',
  active: 'Активно',
  at_risk: 'В зоне риска',
  achieved: 'Достигнуто',
  missed: 'Не достигнуто',
  hypothesis: 'Гипотеза',
  analysis: 'Анализ',
  decision: 'Решение',
  execution: 'Выполнение',
  monitoring: 'Мониторинг',
}

export function presetStatusesForKind(kind: ProjectKind): readonly string[] {
  return BOARD_STATUS_PRESETS[kind] ?? BOARD_STATUS_PRESETS.general
}

export function firstStatusForKind(kind: ProjectKind): string {
  const p = presetStatusesForKind(kind)
  return p[0] ?? 'todo'
}

export function orderedBoardColumns(kind: ProjectKind, tasks: { status: string }[]): string[] {
  const preset = [...presetStatusesForKind(kind)]
  const seen = new Set(preset)
  const extras = [...new Set(tasks.map((t) => t.status))].filter((s) => !seen.has(s)).sort()
  return [...preset, ...extras]
}

export function nextKanbanColumn(current: string, columns: string[]): string {
  if (columns.length === 0) return current
  const idx = columns.indexOf(current)
  if (idx === -1) return columns[0]!
  return columns[(idx + 1) % columns.length]!
}

export function labelStatusColumn(status: string): string {
  return STATUS_COLUMN_LABELS[status] ?? status
}
