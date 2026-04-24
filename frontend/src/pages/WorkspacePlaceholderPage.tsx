/**
 * Заглушки разделов из бокового меню (рыбный текст до появления реального функционала).
 */

import { Link, useParams } from 'react-router-dom'

const SECTIONS: Record<
  string,
  {
    title: string
    lead: string
    body: string[]
  }
> = {
  company: {
    title: 'Моя компания',
    lead: 'Карточка организации, сотрудники и политики доступа — всё это появится здесь позже.',
    body: [
      'Съешь ещё этих мягких французских булок, да выпей чаю. Каждый день практикуем ретроспективу по процессам, чтобы не потерять нить между спринтами и календарём поставок.',
      'Пока раздел демонстрационный: данные вымышлены, кнопки не сохраняют ничего на сервере.',
    ],
  },
  messenger: {
    title: 'Мессенджер',
    lead: 'Общие каналы и личные диалоги в одном окне рядом с задачами.',
    body: [
      'Лорем ипсум долор сит амет — классический набор букв для проверки интерлиньяжа. Уведомления о новых сообщениях будут дублироваться в ленту событий.',
      'Интеграция с WebSocket и push — в планах следующих итераций.',
    ],
  },
  feed: {
    title: 'Лента событий',
    lead: 'Хронология действий по проектам и задачам.',
    body: [
      '14:02 — задача «Проверить отчёт» переведена в статус «Готово». 13:40 — создан проект «Демо-карусель». События ниже сгенерированы как пример вёрстки.',
      'Фильтры по типу события и проекту появятся в следующей версии макета.',
    ],
  },
  reports: {
    title: 'Отчёты',
    lead: 'Выгрузки и дашборды по загрузке команды и срокам.',
    body: [
      'Диаграмма «выполнено к сроку» за квартал пока отображает случайные проценты для демонстрации сетки и подписей осей.',
      'Экспорт в CSV и PDF запланирован после стабилизации API агрегатов.',
    ],
  },
  billing: {
    title: 'Лицензия и оплаты',
    lead: 'Тариф, счета и история платежей.',
    body: [
      'Текущий план: «Near — демо». Следующее списание не выполняется: это страница-заглушка без привязки к платёжному провайдеру.',
      'Для корпоративных клиентов здесь же появится выставление счетов и акты.',
    ],
  },
  support: {
    title: 'Поддержка и новости',
    lead: 'База знаний, тикеты и дайджест обновлений продукта.',
    body: [
      'Значок «+2» в меню означал бы непрочитанные статьи — сейчас это декоративный счётчик для макета.',
      'Напишите нам на support@example.local — почта вымышлена, письма не доставляются.',
    ],
  },
}

const VALID_IDS = new Set(Object.keys(SECTIONS))

export function WorkspacePlaceholderPage() {
  const { sectionId } = useParams<{ sectionId: string }>()
  const id = sectionId ?? ''
  const cfg = VALID_IDS.has(id) ? SECTIONS[id] : null

  if (!cfg) {
    return (
      <div>
        <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
          ← К проектам
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-white">Раздел не найден</h1>
        <p className="mt-2 text-slate-400">Проверьте ссылку в боковом меню.</p>
      </div>
    )
  }

  return (
    <div>
      <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
        ← К проектам
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-white">{cfg.title}</h1>
      <p className="mt-3 max-w-2xl text-slate-300">{cfg.lead}</p>
      <div className="mt-8 max-w-2xl space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        {cfg.body.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-slate-400">
            {p}
          </p>
        ))}
      </div>
      <p className="mt-8 text-xs text-slate-600">Раздел-заглушка · V0.0.2</p>
    </div>
  )
}
