'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { submitSatisfactionSurvey } from '@/actions/satisfaction.actions'

function SatisfactionForm() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('event') ?? undefined
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (score == null) {
      setError('Selecciona una calificación del 1 al 10')
      return
    }
    setLoading(true)
    setError(null)
    const res = await submitSatisfactionSurvey({
      eventId,
      score,
      comment: comment.trim() || undefined,
    })
    setLoading(false)
    if (!res.success) {
      setError(res.error ?? 'No se pudo enviar la encuesta')
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="text-4xl">🙏</p>
        <h2 className="mt-3 text-xl font-bold text-slate-800">¡Gracias por tu opinión!</h2>
        <p className="mt-2 text-sm text-slate-600">
          Tu calificación nos ayuda a mejorar la atención en Soluciones Médico Empresariales.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-800">Encuesta de satisfacción</h2>
      <p className="mt-2 text-sm text-slate-600">
        ¿Cómo calificarías tu atención hoy? (1 = muy mala, 10 = excelente)
      </p>

      <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setScore(value)}
            className={`rounded-xl border py-2 text-sm font-bold transition ${
              score === value
                ? 'border-violet-500 bg-violet-600 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-200'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-sm font-medium text-slate-700">
        Comentarios (opcional)
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          placeholder="Cuéntanos qué podemos mejorar…"
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={loading}
        className="mt-5 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
      >
        {loading ? 'Enviando…' : 'Enviar encuesta'}
      </button>
    </div>
  )
}

export default function SatisfactionSurveyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">
            Soluciones Médico Empresariales
          </p>
          <h1 className="text-2xl font-black text-slate-900">Tu opinión importa</h1>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-slate-500">Cargando…</p>}>
          <SatisfactionForm />
        </Suspense>
      </div>
    </div>
  )
}
