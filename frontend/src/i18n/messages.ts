export type Locale = 'ru' | 'en'
export type Theme = 'dark' | 'light'

export type MessageKey =
  | 'nav.home'
  | 'nav.projects'
  | 'nav.company'
  | 'nav.messenger'
  | 'nav.feed'
  | 'nav.reports'
  | 'nav.support'
  | 'nav.billing'
  | 'nav.settings'
  | 'nav.logout'
  | 'nav.sync'
  | 'nav.offline'
  | 'nav.syncNow'
  | 'nav.syncing'
  | 'nav.queueEmpty'
  | 'search.placeholder'
  | 'search.noResults'
  | 'search.projects'
  | 'search.tasks'
  | 'search.hint'
  | 'settings.appearance'
  | 'settings.language'
  | 'settings.theme'
  | 'settings.themeDark'
  | 'settings.themeLight'
  | 'common.loading'
  | 'board.newTask'
  | 'board.collapsePanel'
  | 'board.fieldHistory'
  | 'board.hotkeyNew'
  | 'board.hotkeyEsc'

const ru: Record<MessageKey, string> = {
  'nav.home': 'На главную',
  'nav.projects': 'Проекты',
  'nav.company': 'Моя компания',
  'nav.messenger': 'Мессенджер',
  'nav.feed': 'Лента событий',
  'nav.reports': 'Отчёты',
  'nav.support': 'Поддержка, Новости',
  'nav.billing': 'Лицензия и оплаты',
  'nav.settings': 'Настройки',
  'nav.logout': 'Выйти',
  'nav.sync': 'Синхронизация',
  'nav.offline': 'Оффлайн',
  'nav.syncNow': 'Синхронизировать сейчас',
  'nav.syncing': 'Синхронизация…',
  'nav.queueEmpty': 'Очередь пуста',
  'search.placeholder': 'Поиск проектов и задач…',
  'search.noResults': 'Ничего не найдено',
  'search.projects': 'Проекты',
  'search.tasks': 'Задачи',
  'search.hint': 'Поиск',
  'settings.appearance': 'Интерфейс',
  'settings.language': 'Язык',
  'settings.theme': 'Тема',
  'settings.themeDark': 'Тёмная',
  'settings.themeLight': 'Светлая',
  'common.loading': 'Загрузка…',
  'board.newTask': 'Новая задача',
  'board.collapsePanel': 'Свернуть панель',
  'board.fieldHistory': 'История названия и описания',
  'board.hotkeyNew': 'N — новая задача',
  'board.hotkeyEsc': 'Esc — свернуть панель',
}

const en: Record<MessageKey, string> = {
  'nav.home': 'Home',
  'nav.projects': 'Projects',
  'nav.company': 'My company',
  'nav.messenger': 'Messenger',
  'nav.feed': 'Activity feed',
  'nav.reports': 'Reports',
  'nav.support': 'Support & news',
  'nav.billing': 'License & billing',
  'nav.settings': 'Settings',
  'nav.logout': 'Log out',
  'nav.sync': 'Sync',
  'nav.offline': 'Offline',
  'nav.syncNow': 'Sync now',
  'nav.syncing': 'Syncing…',
  'nav.queueEmpty': 'Queue empty',
  'search.placeholder': 'Search projects and tasks…',
  'search.noResults': 'No results',
  'search.projects': 'Projects',
  'search.tasks': 'Tasks',
  'search.hint': 'Search',
  'settings.appearance': 'Appearance',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.themeDark': 'Dark',
  'settings.themeLight': 'Light',
  'common.loading': 'Loading…',
  'board.newTask': 'New task',
  'board.collapsePanel': 'Collapse panel',
  'board.fieldHistory': 'Title & description history',
  'board.hotkeyNew': 'N — new task',
  'board.hotkeyEsc': 'Esc — collapse panel',
}

export const messages: Record<Locale, Record<MessageKey, string>> = { ru, en }

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages.ru[key] ?? key
}
