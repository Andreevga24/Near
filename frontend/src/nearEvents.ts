/** Событие: список проектов изменился локально (создание/удаление) — обновить сайдбар и т.п. */
export const NEAR_PROJECTS_CHANGED = 'near-projects-changed'

/** Событие: задачи изменились (доска) — пересчитать счётчики в сайдбаре. */
export const NEAR_TASKS_CHANGED = 'near-tasks-changed'

export function emitProjectsChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(NEAR_PROJECTS_CHANGED))
}

export function emitTasksChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(NEAR_TASKS_CHANGED))
}
