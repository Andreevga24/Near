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

export function prevKanbanColumn(current: string, columns: string[]): string {
  if (columns.length === 0) return current
  const idx = columns.indexOf(current)
  if (idx === -1) return columns[columns.length - 1]!
  return columns[(idx - 1 + columns.length) % columns.length]!
}

export function labelStatusColumn(status: string): string {
  return STATUS_COLUMN_LABELS[status] ?? status
}

export const STATUS_COLUMN_HINTS: Partial<Record<ProjectKind, Record<string, string>>> = {
  general: {
    todo: 'Сформулируйте результат и критерий готовности.',
    in_progress: 'Один следующий шаг — и в done.',
    done: 'Готово и проверено.',
  },
  development: {
    backlog: 'Идеи и заявки без оценки.',
    ready: 'Оценено, есть acceptance criteria.',
    in_progress: 'В работе (ветка/PR).',
    review: 'Ревью/QA перед релизом.',
    done: 'В проде / принято.',
  },
  operations_support: {
    new: 'Новые обращения. Зафиксируйте симптомы и контекст.',
    triaged: 'Приоритизация и разбор: кто/что/когда.',
    in_progress: 'В работе: диагностика, решение, коммуникация.',
    waiting: 'Ожидание внешнего ответа/условий.',
    resolved: 'Решено и подтверждено.',
  },
  marketing_campaigns: {
    idea: 'Гипотеза, цель и KPI кампании.',
    approval: 'Согласование бюджета, месседжей и каналов.',
    production: 'Креативы, лендинг, настройки аналитики.',
    launch: 'Запуск и мониторинг.',
    analytics: 'Разбор результатов и выводы.',
  },
  hr_recruiting: {
    sourced: 'Потенциальные кандидаты/отклики.',
    screening: 'Скрининг: требования и мотивация.',
    interview: 'Интервью и оценка.',
    offer: 'Оффер и переговоры.',
    closed: 'Закрыто (нанят/отказ).',
  },
  training: {
    planned: 'План обучения и цели.',
    materials: 'Подготовка материалов.',
    live: 'Проведение сессии.',
    homework: 'Домашка/проверка/обратная связь.',
    done: 'Завершено и задокументировано.',
  },
  onboarding: {
    pre_start: 'Подготовка до первого дня.',
    week_1: 'Доступы и первые задачи.',
    week_2: 'Самостоятельные задачи.',
    stabilization: 'Закрепление и улучшения.',
    done: 'Онбординг завершён.',
  },
  crm_sales: {
    lead: 'Новый лид: собрать контекст.',
    qualified: 'Квалификация: боль/бюджет/сроки.',
    proposal: 'Предложение и КП.',
    negotiation: 'Переговоры и условия.',
    won: 'Сделка закрыта успешно.',
    lost: 'Сделка проиграна: зафиксировать причину.',
  },
  procurement: {
    request: 'Запрос: требования и сроки.',
    approval: 'Согласование закупки и бюджета.',
    tender: 'Сбор предложений / тендер.',
    delivery: 'Поставка и приёмка.',
    closed: 'Закрыто и оформлено.',
  },
  product_roadmap: {
    discovery: 'Discovery: проблема, аудитория, гипотезы.',
    committed: 'В плане: объём и критерии.',
    building: 'В разработке: реализация и тесты.',
    shipped: 'Доставлено пользователям.',
    measuring: 'Измерение эффекта и итерации.',
  },
  content_editorial: {
    idea: 'Идея: тезисы и формат.',
    draft: 'Черновик текста/структуры.',
    editing: 'Редактура и фактчек.',
    publish_prep: 'Подготовка к публикации (SEO/обложка).',
    published: 'Опубликовано и распространено.',
  },
  events: {
    concept: 'Концепт: цель, аудитория, формат.',
    logistics: 'Локация, подрядчики, расписание.',
    promo: 'Промо и регистрации.',
    event_day: 'День события: контроль выполнения.',
    retrospective: 'Разбор, метрики, выводы.',
  },
  goals_kpi: {
    kpi_draft: 'Черновик цели и метрик.',
    active: 'В работе: регулярный трекинг.',
    at_risk: 'Риск: нужен план восстановления.',
    achieved: 'Достигнуто и зафиксировано.',
    missed: 'Не достигнуто: анализ причин.',
  },
  strategy: {
    hypothesis: 'Гипотеза направления.',
    analysis: 'Анализ данных и вариантов.',
    decision: 'Выбор решения и критерии успеха.',
    execution: 'Реализация инициатив.',
    monitoring: 'Мониторинг результатов.',
  },
  personal: {
    wishlist: 'Список желаний/идей.',
    in_progress: 'Делаю сейчас.',
    done: 'Сделано.',
  },
}

export function hintForStatus(kind: ProjectKind, status: string): string | null {
  return STATUS_COLUMN_HINTS[kind]?.[status] ?? null
}
