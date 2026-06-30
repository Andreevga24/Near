import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { fetchLegalMeta, type LegalMeta } from '../api/legal'
import { applyOperatorPlaceholders, LEGAL_DOCUMENTS, type LegalDocType } from '../legal/content.ru'

function isLegalDocType(v: string | undefined): v is LegalDocType {
  return v === 'privacy' || v === 'terms' || v === 'consent'
}

export function LegalDocumentPage() {
  const { docType } = useParams<{ docType: string }>()
  const [meta, setMeta] = useState<LegalMeta | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchLegalMeta()
      .then(setMeta)
      .catch(() => setError('Не удалось загрузить реквизиты оператора'))
  }, [])

  if (!isLegalDocType(docType)) {
    return (
      <div className="near-app-bg mx-auto max-w-3xl px-4 py-12 text-slate-400">
        <p>Документ не найден.</p>
        <Link to="/" className="near-link mt-4 inline-block">
          На главную
        </Link>
      </div>
    )
  }

  const doc = LEGAL_DOCUMENTS[docType]
  const operatorName = meta?.operator_name ?? '…'
  const operatorEmail = meta?.operator_email ?? '…'

  return (
    <div className="near-app-bg min-h-svh">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-300">
          ← На главную
        </Link>

        <header className="mt-6 border-b border-slate-800 pb-6">
          <h1 className="text-2xl font-semibold text-white">{doc.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{doc.subtitle}</p>
          {meta ? (
            <p className="mt-3 text-xs text-slate-500">
              Версия документа: {docType === 'consent' ? meta.consent_version : docType === 'privacy' ? meta.privacy_version : meta.terms_version}
            </p>
          ) : null}
        </header>

        <p className="near-alert-warn mt-6 text-sm">{doc.disclaimer}</p>
        {error ? <p className="near-alert-warn mt-4 text-sm">{error}</p> : null}

        <article className="prose-near mt-8 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-medium text-white/90">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
                {section.paragraphs.map((p) => (
                  <p key={p}>{applyOperatorPlaceholders(p, operatorName, operatorEmail)}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <nav className="mt-12 flex flex-wrap gap-4 border-t border-slate-800 pt-6 text-sm">
          <Link to="/legal/privacy" className="text-slate-400 hover:text-slate-200">
            Политика конфиденциальности
          </Link>
          <Link to="/legal/terms" className="text-slate-400 hover:text-slate-200">
            Пользовательское соглашение
          </Link>
          <Link to="/legal/consent" className="text-slate-400 hover:text-slate-200">
            Согласие на обработку ПДн
          </Link>
        </nav>
      </div>
    </div>
  )
}
