'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import {
  getEventSurveyPrefill,
  submitSatisfactionSurvey,
} from '@/actions/satisfaction.actions'
import { LikertDotScale, LikertFaceScale } from '@/components/satisfaction/LikertFaceScale'

type Prefill = {
  eventId: string
  nombre: string
  apellidos: string
  empresa: string
  alreadySubmitted: boolean
}

function SatisfactionFormInner() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('event') ?? ''
  const isKiosk = searchParams.get('mode') === 'kiosk'
  const channelParam = searchParams.get('channel')
  const channel =
    channelParam === 'TABLET' || channelParam === 'WHATSAPP_LINK'
      ? channelParam
      : 'DIRECT'

  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [turno, setTurno] = useState('')
  const [overall, setOverall] = useState<number | null>(null)
  const [qTrato, setQTrato] = useState<number | null>(null)
  const [qEscucha, setQEscucha] = useState<number | null>(null)
  const [qResolucion, setQResolucion] = useState<number | null>(null)
  const [qEspera, setQEspera] = useState<number | null>(null)
  const [qLimpieza, setQLimpieza] = useState<number | null>(null)
  const [qPrivacidad, setQPrivacidad] = useState<number | null>(null)
  const [recomienda, setRecomienda] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) return
    void getEventSurveyPrefill(eventId).then((res) => {
      if (res.success) setPrefill(res.data)
      else setError(res.error)
    })
  }, [eventId])

  const submit = async () => {
    if (!eventId || !prefill) {
      setError('Falta el expediente de la visita')
      return
    }
    const scores = [overall, qTrato, qEscucha, qResolucion, qEspera, qLimpieza, qPrivacidad, recomienda]
    if (scores.some((s) => s == null) || !turno.trim()) {
      setError('Completa turno y todas las calificaciones (1–5)')
      return
    }

    setLoading(true)
    setError(null)
    const res = await submitSatisfactionSurvey({
      eventId,
      turno: turno.trim(),
      overall: overall!,
      qTrato: qTrato!,
      qEscucha: qEscucha!,
      qResolucion: qResolucion!,
      qEspera: qEspera!,
      qLimpieza: qLimpieza!,
      qPrivacidad: qPrivacidad!,
      recomienda: recomienda!,
      comentario: comentario.trim() || undefined,
      channel,
    })
    setLoading(false)
    if (!res.success) {
      setError(res.error ?? 'No se pudo enviar la encuesta')
      return
    }
    setDone(true)
  }

  if (!eventId) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
        Enlace inválido — falta el identificador del expediente.
      </p>
    )
  }

  if (done || prefill?.alreadySubmitted) {
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

  if (!prefill) {
    return <p className="text-center text-sm text-slate-500">Cargando encuesta…</p>
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${
        isKiosk ? 'p-8' : 'p-6'
      }`}
      data-testid="ami-satisfaction-form"
    >
      <h2 className="text-xl font-bold text-slate-800">Encuesta de satisfacción AMI</h2>
      <p className="mt-2 text-sm text-slate-600">
        Califica del 1 (nada satisfecho) al 5 (totalmente satisfecho).
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-slate-700">Nombre</span>
          <input
            readOnly
            value={prefill.nombre}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Apellidos</span>
          <input
            readOnly
            value={prefill.apellidos}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Empresa</span>
          <input
            readOnly
            value={prefill.empresa}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Turno</span>
          <input
            value={turno}
            onChange={(e) => setTurno(e.target.value)}
            placeholder="Ej. Matutino, Vespertino…"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            data-testid="satisfaction-turno"
          />
        </label>
      </div>

      <div className="mt-6 space-y-6">
        <LikertFaceScale label="Satisfacción general" value={overall} onChange={setOverall} />
        <LikertDotScale label="Trato — respeto y amabilidad" value={qTrato} onChange={setQTrato} />
        <LikertDotScale label="Trato — escucha" value={qEscucha} onChange={setQEscucha} />
        <LikertDotScale label="Solución — resolución clara" value={qResolucion} onChange={setQResolucion} />
        <LikertDotScale label="Solución — tiempo de espera" value={qEspera} onChange={setQEspera} />
        <LikertDotScale label="Espacio — limpieza" value={qLimpieza} onChange={setQLimpieza} />
        <LikertDotScale label="Espacio — privacidad" value={qPrivacidad} onChange={setQPrivacidad} />
        <LikertDotScale label="¿Recomendarías nuestros servicios?" value={recomienda} onChange={setRecomienda} />
      </div>

      <label className="mt-6 block text-sm font-medium text-slate-700">
        Comentarios (opcional)
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={4}
          maxLength={2000}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={loading}
        data-testid="satisfaction-submit"
        className="mt-5 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
      >
        {loading ? 'Enviando…' : 'Enviar encuesta'}
      </button>
    </div>
  )
}

function SatisfactionPageShell() {
  const searchParams = useSearchParams()
  const isKiosk = searchParams.get('mode') === 'kiosk'

  return (
    <div
      className={`min-h-screen bg-slate-50 px-4 ${isKiosk ? 'py-6' : 'py-10'}`}
      data-testid="satisfaction-page"
    >
      <div className={`mx-auto space-y-6 ${isKiosk ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">
            Soluciones Médico Empresariales
          </p>
          <h1 className="text-2xl font-black text-slate-900">Tu opinión importa</h1>
        </div>
        <SatisfactionFormInner />
      </div>
    </div>
  )
}

export default function SatisfactionSurveyPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-slate-500 py-10">Cargando…</p>}>
      <SatisfactionPageShell />
    </Suspense>
  )
}
