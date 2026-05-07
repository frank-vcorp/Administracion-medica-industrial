/**
 * @fileoverview Bloque de trazabilidad operativa ligera del evento médico.
 * Deriva visibilidad de avance, último movimiento y siguiente paso directamente
 * de los estados ya existentes de EventTest. No modifica el flujo clínico.
 * Las incidencias operativas se persisten en localStorage por eventId (V1, sin migración).
 * @id IMPL-20260507-07
 * @spec context/SPECs/SPEC_ARCH-20260507-07-TRAZABILIDAD-LIGERA-SIN-CAMBIAR-FLUJO.md
 * @backup context/checkpoints/CHK_IMPL-20260507-07-TRAZABILIDAD-LIGERA.md
 */
"use client"

import { useState, useEffect } from "react"

// Tipo mínimo compatible con StudyTest de PapeletaWorkspace (solo campos usados aquí)
type StudyStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SAMPLE_TAKEN'
  | 'RESULT_REGISTERED'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'CANCELLED'

type TrazTest = {
  id: string
  testNameSnapshot: string
  status: StudyStatus
}

const STATUS_LABELS: Record<StudyStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  SAMPLE_TAKEN: 'Muestra tomada',
  RESULT_REGISTERED: 'Resultado registrado',
  COMPLETED: 'Completado',
  SKIPPED: 'Omitido',
  CANCELLED: 'Cancelado',
}

/** Peso para determinar "más avanzado" sin timestamps */
const STATUS_WEIGHT: Record<StudyStatus, number> = {
  CANCELLED: 0,
  SKIPPED: 1,
  PENDING: 2,
  IN_PROGRESS: 3,
  SAMPLE_TAKEN: 4,
  RESULT_REGISTERED: 5,
  COMPLETED: 6,
}

const INCIDENCE_OPTIONS = [
  { value: 'EQUIPO_NO_DISPONIBLE', label: 'Equipo no disponible' },
  { value: 'PACIENTE_EN_ESPERA',   label: 'Paciente en espera prolongada' },
  { value: 'MUESTRA_REPETIR',      label: 'Muestra pendiente de repetir' },
  { value: 'SEGUIMIENTO_MANUAL',   label: 'Requiere seguimiento manual' },
] as const

type IncidenceValue = typeof INCIDENCE_OPTIONS[number]['value']

type Incidence = {
  type: IncidenceValue
  label: string
  testName?: string
  registeredAt: string
}

// --- Helpers ---------------------------------------------------------------

function getTimelineIcon(status: StudyStatus): string {
  if (status === 'COMPLETED')         return '✅'
  if (status === 'RESULT_REGISTERED') return '📊'
  if (status === 'SAMPLE_TAKEN')      return '🧪'
  if (status === 'IN_PROGRESS')       return '⏳'
  if (status === 'SKIPPED')           return '⏭️'
  if (status === 'CANCELLED')         return '❌'
  return '○'
}

function getTimelineBadge(status: StudyStatus): string {
  if (status === 'COMPLETED')         return 'bg-emerald-100 text-emerald-700'
  if (status === 'RESULT_REGISTERED') return 'bg-teal-100 text-teal-700'
  if (status === 'SAMPLE_TAKEN')      return 'bg-purple-100 text-purple-700'
  if (status === 'IN_PROGRESS')       return 'bg-blue-100 text-blue-700'
  if (status === 'SKIPPED')           return 'bg-slate-100 text-slate-500'
  if (status === 'CANCELLED')         return 'bg-red-100 text-red-500'
  return 'bg-slate-100 text-slate-400'
}

/** Detecta estudios de laboratorio por nombre (heurística ligera, sin importar isLabTest) */
function isLabByName(name: string): boolean {
  const n = name.toLowerCase()
  return (
    n.includes('sangre') || n.includes('sanguín') || n.includes('sanguinea') ||
    n.includes('biometría') || n.includes('biometria') ||
    n.includes('química') || n.includes('quimica') ||
    n.includes('glucosa') || n.includes('colesterol') ||
    n.includes('hemograma') || n.includes('orina') ||
    n.includes('ego') || n.includes('urin') ||
    n.includes('heces') || n.includes('copro') ||
    n.includes('laborat') || n.includes('lab ')
  )
}

// --- LocalStorage (incidencias V1) -----------------------------------------

function loadIncidences(eventId: string): Incidence[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`ami_inc_${eventId}`)
    return raw ? (JSON.parse(raw) as Incidence[]) : []
  } catch {
    return []
  }
}

function persistIncidences(eventId: string, items: Incidence[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`ami_inc_${eventId}`, JSON.stringify(items))
  } catch { /* silent */ }
}

// --- Componente principal ---------------------------------------------------

interface TraceabilidadLigeraProps {
  eventId: string
  /** Compatible con StudyTest[] de PapeletaWorkspace (superconjunto de TrazTest) */
  tests: TrazTest[]
  readonly?: boolean
}

/**
 * ARCH-20260507-07: Bloque compacto de trazabilidad operativa ligera.
 * Se monta encima del flujo existente como capa de observabilidad.
 */
export default function TraceabilidadLigera({
  eventId,
  tests,
  readonly = false,
}: TraceabilidadLigeraProps) {
  const [expanded, setExpanded]     = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [selType, setSelType]       = useState<IncidenceValue>(INCIDENCE_OPTIONS[0].value)
  const [selTestId, setSelTestId]   = useState('')
  const [incidences, setIncidences] = useState<Incidence[]>([])

  useEffect(() => {
    setIncidences(loadIncidences(eventId))
  }, [eventId])

  // --- Métricas derivadas ---------------------------------------------------

  const activeTests    = tests.filter(t => t.status !== 'CANCELLED' && t.status !== 'SKIPPED')
  const completedTests = tests.filter(t => t.status === 'COMPLETED' || t.status === 'RESULT_REGISTERED')
  const totalActive    = activeTests.length
  const progressPct    = totalActive > 0 ? Math.round((completedTests.length / totalActive) * 100) : 0
  const pendingCount   = activeTests.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length
  const allDone        = totalActive > 0 && pendingCount === 0

  // Último movimiento: test con estado más avanzado entre los que ya tienen actividad
  const withActivity = tests.filter(
    t => t.status !== 'PENDING' && t.status !== 'CANCELLED' && t.status !== 'SKIPPED'
  )
  const ultimoMovimiento = withActivity.length > 0
    ? withActivity.reduce(
        (best, t) => STATUS_WEIGHT[t.status] >= STATUS_WEIGHT[best.status] ? t : best,
        withActivity[0]
      )
    : null

  // Siguiente paso: primero EN_PROGRESO, si no el primer PENDIENTE
  const inProgress   = tests.find(t => t.status === 'IN_PROGRESS')
  const firstPending = tests.find(t => t.status === 'PENDING')
  const siguientePaso: TrazTest | null = inProgress ?? firstPending ?? null

  // Hitos cruzados: muestras de laboratorio ya tomadas (visibilidad para médico/otras áreas)
  const sampleHitos = tests.filter(
    t =>
      isLabByName(t.testNameSnapshot) &&
      ['SAMPLE_TAKEN', 'RESULT_REGISTERED', 'COMPLETED'].includes(t.status)
  )

  // Timeline operativa: ordenada por peso de estado (más avanzado primero)
  const timelineTests = [...tests].sort(
    (a, b) => STATUS_WEIGHT[b.status] - STATUS_WEIGHT[a.status]
  )

  // --- Manejadores de incidencias -------------------------------------------

  function addIncidence() {
    const option = INCIDENCE_OPTIONS.find(o => o.value === selType)
    if (!option) return
    const testName = selTestId
      ? tests.find(t => t.id === selTestId)?.testNameSnapshot
      : undefined
    const inc: Incidence = {
      type: selType,
      label: option.label,
      testName,
      registeredAt: new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
    const updated = [...incidences, inc]
    setIncidences(updated)
    persistIncidences(eventId, updated)
    setShowForm(false)
    setSelTestId('')
  }

  function removeIncidence(i: number) {
    const updated = incidences.filter((_, idx) => idx !== i)
    setIncidences(updated)
    persistIncidences(eventId, updated)
  }

  // --- Render ---------------------------------------------------------------

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mb-3">

      {/* ── Cabecera siempre visible ──────────────────────────────────────── */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm leading-none shrink-0">📍</span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight">
              Estado del evento
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-700">
                {allDone
                  ? '✅ Todos completados'
                  : `${completedTests.length}/${totalActive} completados`}
              </span>
              {!allDone && (
                <div className="h-1.5 w-16 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}
              {pendingCount > 0 && (
                <span className="text-[10px] text-amber-600 font-medium">
                  {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="text-[11px] text-slate-400 hover:text-slate-600 font-medium shrink-0 transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? 'Cerrar ▲' : 'Detalle ▼'}
        </button>
      </div>

      {/* ── Resumen compacto: último movimiento + siguiente paso ─────────── */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Último movimiento
          </p>
          {ultimoMovimiento ? (
            <>
              <p className="text-xs font-semibold text-slate-800 leading-tight truncate">
                {ultimoMovimiento.testNameSnapshot}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {STATUS_LABELS[ultimoMovimiento.status]}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin actividad aún</p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Siguiente paso
          </p>
          {siguientePaso ? (
            <>
              <p className="text-xs font-semibold text-teal-700 leading-tight truncate">
                {siguientePaso.testNameSnapshot}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {STATUS_LABELS[siguientePaso.status]}
              </p>
            </>
          ) : (
            <p className="text-xs text-emerald-600 font-semibold">Sin pendientes</p>
          )}
        </div>
      </div>

      {/* ── Hitos cruzados: muestras de laboratorio ya tomadas ───────────── */}
      {sampleHitos.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {sampleHitos.map(t => (
            <span
              key={t.id}
              className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium"
            >
              🧪 {t.testNameSnapshot}
            </span>
          ))}
        </div>
      )}

      {/* ── Incidencias activas (siempre visibles si existen) ────────────── */}
      {incidences.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {incidences.map((inc, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium"
            >
              ⚠️ {inc.label}
              {inc.testName && (
                <span className="text-amber-500">— {inc.testName}</span>
              )}
              {!readonly && (
                <button
                  onClick={() => removeIncidence(i)}
                  className="text-amber-400 hover:text-amber-700 ml-0.5 leading-none"
                  aria-label="Quitar incidencia"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Panel expandible: timeline + registro de incidencias ─────────── */}
      {expanded && (
        <div className="border-t border-slate-200 bg-white">

          {/* Timeline operativa */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Actividad operativa
            </p>
            <div className="space-y-2">
              {timelineTests.map(t => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <span className="text-sm leading-none shrink-0">
                    {getTimelineIcon(t.status)}
                  </span>
                  <span className="text-xs text-slate-700 flex-1 truncate">
                    {t.testNameSnapshot}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${getTimelineBadge(t.status)}`}
                  >
                    {STATUS_LABELS[t.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Registro de incidencias */}
          {!readonly && (
            <div className="border-t border-slate-100 px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Incidencias operativas
                </p>
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-0.5 rounded font-bold transition-colors"
                  >
                    + Registrar
                  </button>
                )}
              </div>

              {showForm && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <select
                    value={selType}
                    onChange={e => setSelType(e.target.value as IncidenceValue)}
                    className="w-full text-xs border border-amber-300 rounded px-2 py-1.5 bg-white outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    {INCIDENCE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <select
                    value={selTestId}
                    onChange={e => setSelTestId(e.target.value)}
                    className="w-full text-xs border border-amber-300 rounded px-2 py-1.5 bg-white outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="">Estudio relacionado (opcional)</option>
                    {tests.map(t => (
                      <option key={t.id} value={t.id}>{t.testNameSnapshot}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={addIncidence}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded font-bold transition-colors"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => { setShowForm(false); setSelTestId('') }}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {incidences.length === 0 && !showForm && (
                <p className="text-xs text-slate-400">Sin incidencias registradas.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
