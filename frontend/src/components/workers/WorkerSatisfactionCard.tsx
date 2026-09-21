'use client'

import { useState } from 'react'
import Link from 'next/link'

export type SatisfactionSurveyItem = {
  id: string
  eventId: string
  turno: string
  overall: number
  recomienda: number
  qTrato: number
  qEscucha: number
  qResolucion: number
  qEspera: number
  qLimpieza: number
  qPrivacidad: number
  comentario: string | null
  channel: string
  submittedAt: string
}

export type PendingSurveyItem = {
  eventId: string
  dischargedAt: string | null
}

const FACES = ['😞', '😕', '😐', '🙂', '😄']

interface Props {
  firstName: string
  lastName: string
  surveys: SatisfactionSurveyItem[]
  pendingSurveys: PendingSurveyItem[]
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function WorkerSatisfactionCard({
  firstName,
  lastName,
  surveys,
  pendingSurveys,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const fullName = `${firstName} ${lastName}`

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Encuestas de satisfacción</h3>
        {surveys.length > 0 && (
          <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-1 rounded-full font-bold uppercase tracking-widest">
            {surveys.length}
          </span>
        )}
      </div>

      {pendingSurveys.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {pendingSurveys.length} encuesta{pendingSurveys.length !== 1 ? 's' : ''} pendiente
          {pendingSurveys.length !== 1 ? 's' : ''} tras checkout
        </div>
      )}

      {surveys.length > 0 ? (
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {surveys.map((item) => {
            const expanded = expandedId === item.id
            return (
              <li
                key={item.id}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {FACES[item.overall - 1] ?? '⭐'} Turno {item.turno}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDateTime(item.submittedAt)} · Recomienda {item.recomienda}/5
                    </p>
                  </div>
                  <span className="text-xs font-bold text-violet-600">
                    {expanded ? '▲' : '▼'}
                  </span>
                </button>
                {expanded && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-t border-slate-200 pt-3">
                    <p>Trato: {item.qTrato}/5</p>
                    <p>Escucha: {item.qEscucha}/5</p>
                    <p>Resolución: {item.qResolucion}/5</p>
                    <p>Espera: {item.qEspera}/5</p>
                    <p>Limpieza: {item.qLimpieza}/5</p>
                    <p>Privacidad: {item.qPrivacidad}/5</p>
                    {item.comentario && (
                      <p className="col-span-2 italic text-slate-500">{item.comentario}</p>
                    )}
                    <Link
                      href={`/events/${item.eventId}`}
                      className="col-span-2 text-violet-600 font-bold hover:underline"
                    >
                      Ver expediente →
                    </Link>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm font-semibold text-slate-600">
            Sin encuestas registradas
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Se capturan al checkout de {fullName}.
          </p>
        </div>
      )}
    </div>
  )
}
