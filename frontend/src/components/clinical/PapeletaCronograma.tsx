/**
 * @fileoverview Vista admin-only del cronograma operativo persistente de papeleta.
 * Muestra la línea de tiempo del evento con filtros básicos y formulario de incidencias.
 * No visible para roles clínicos generales.
 * @id IMPL-20260507-08
 * @spec context/SPECs/SPEC_ARCH-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md
 * @backup context/checkpoints/CHK_IMPL-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md
 */
"use client"

import { useState, useTransition } from "react"
import { addAdminIncidence } from "@/actions/timeline.actions"

// --- Tipos ---

type TimelineEntryType =
  | 'STUDY_STARTED'
  | 'SAMPLE_TAKEN'
  | 'RESULT_REGISTERED'
  | 'STUDY_COMPLETED'
  | 'MEDICAL_EXAM_SAVED'
  | 'ADMIN_INCIDENCE'

type TimelineEntry = {
  id: string
  entryType: TimelineEntryType
  area: string
  title: string
  description: string | null
  occurredAt: string
  createdAt: string
  createdBy: {
    id: string
    fullName: string
    role: string
  } | null
}

interface PapeletaCronogramaProps {
  eventId: string
  initialEntries: TimelineEntry[]
}

// --- Configuración visual por tipo ---

const TYPE_LABELS: Record<TimelineEntryType, string> = {
  STUDY_STARTED:      'Estudio iniciado',
  SAMPLE_TAKEN:       'Pendiente de resultado de prueba de laboratorio',
  RESULT_REGISTERED:  'Pendiente de Reporte de aptitud',
  STUDY_COMPLETED:    'Estudio completado',
  MEDICAL_EXAM_SAVED: 'Examen médico',
  ADMIN_INCIDENCE:    'Incidencia',
}

const TYPE_ICON: Record<TimelineEntryType, string> = {
  STUDY_STARTED:      '▶',
  SAMPLE_TAKEN:       '🧪',
  RESULT_REGISTERED:  '📊',
  STUDY_COMPLETED:    '✅',
  MEDICAL_EXAM_SAVED: '🩺',
  ADMIN_INCIDENCE:    '⚠️',
}

const TYPE_BADGE: Record<TimelineEntryType, string> = {
  STUDY_STARTED:      'bg-blue-100 text-blue-700',
  SAMPLE_TAKEN:       'bg-purple-100 text-purple-700',
  RESULT_REGISTERED:  'bg-teal-100 text-teal-700',
  STUDY_COMPLETED:    'bg-emerald-100 text-emerald-700',
  MEDICAL_EXAM_SAVED: 'bg-indigo-100 text-indigo-700',
  ADMIN_INCIDENCE:    'bg-amber-100 text-amber-700',
}

const CLINICAL_TIMEZONE = 'America/Mexico_City'

// --- Opciones del formulario de incidencias ---

const INCIDENCE_PRESETS = [
  { value: 'Paciente en espera prolongada',   area: 'recepción' },
  { value: 'Equipo no disponible',             area: 'laboratorio' },
  { value: 'Muestra pendiente de repetir',     area: 'laboratorio' },
  { value: 'Reprogramación interna',           area: 'general' },
  { value: 'Requiere seguimiento operativo',   area: 'general' },
] as const

// --- Helpers ---

function formatTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: CLINICAL_TIMEZONE,
    })
  } catch {
    return '—'
  }
}

function formatDatetime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: CLINICAL_TIMEZONE,
    })
  } catch {
    return '—'
  }
}

// --- Componente principal ---

/**
 * ARCH-20260507-08: Cronograma persistente de papeleta — solo administradores.
 */
export default function PapeletaCronograma({
  eventId,
  initialEntries,
}: PapeletaCronogramaProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>(initialEntries)
  const [filterType, setFilterType] = useState<TimelineEntryType | 'ALL'>('ALL')
  const [filterArea, setFilterArea] = useState<string>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formArea, setFormArea] = useState('general')
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Áreas únicas para el filtro
  const uniqueAreas = Array.from(new Set(entries.map(e => e.area).filter(Boolean)))

  // Filtrado cliente
  const filtered = entries.filter(e => {
    const matchType = filterType === 'ALL' || e.entryType === filterType
    const matchArea = filterArea === 'ALL' || e.area === filterArea
    return matchType && matchArea
  })

  // Hitos resumen: primer y último
  const firstEntry = entries.at(0)
  const lastEntry  = entries.at(-1)
  const incidenceCount = entries.filter(e => e.entryType === 'ADMIN_INCIDENCE').length
  const completedCount = entries.filter(e => e.entryType === 'STUDY_COMPLETED' || e.entryType === 'MEDICAL_EXAM_SAVED').length

  function handlePreset(value: string, area: string) {
    setFormTitle(value)
    setFormArea(area)
  }

  function handleSubmit() {
    setFormError(null)
    if (!formTitle.trim()) {
      setFormError('El título de la incidencia es obligatorio.')
      return
    }
    startTransition(async () => {
      const result = await addAdminIncidence(eventId, {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        area: formArea.trim() || 'general',
      })
      if (!result.success) {
        setFormError(result.error ?? 'Error al registrar incidencia.')
        return
      }
      // Optimistic: agregar localmente
      const newEntry: TimelineEntry = {
        id: `temp-${Date.now()}`,
        entryType: 'ADMIN_INCIDENCE',
        area: formArea.trim() || 'general',
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: null,
      }
      setEntries(prev => [...prev, newEntry])
      setFormTitle('')
      setFormDesc('')
      setFormArea('general')
      setShowForm(false)
    })
  }

  return (
    <div className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
      {/* Cabecera admin */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-600 font-bold text-[11px] uppercase tracking-wide">
            🗂 Cronograma Operativo
          </span>
          <span className="bg-amber-200 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
            ADMIN
          </span>
          {entries.length > 0 && (
            <span className="text-amber-600 text-[11px]">{entries.length} movimientos</span>
          )}
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Incidencia'}
        </button>
      </div>

      {/* Resumen de hitos */}
      {entries.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Inicio</div>
            <div className="text-[11px] font-semibold text-slate-700">
              {firstEntry ? formatTime(firstEntry.occurredAt) : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Último mov.</div>
            <div className="text-[11px] font-semibold text-slate-700">
              {lastEntry ? formatTime(lastEntry.occurredAt) : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Completados</div>
            <div className="text-[11px] font-semibold text-emerald-700">{completedCount}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Incidencias</div>
            <div className={`text-[11px] font-semibold ${incidenceCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
              {incidenceCount}
            </div>
          </div>
        </div>
      )}

      {/* Formulario de incidencia manual */}
      {showForm && (
        <div className="px-4 py-3 border-b border-amber-100 bg-amber-50/50">
          <p className="text-[11px] font-semibold text-amber-800 mb-2">Registrar incidencia manual</p>
          {/* Presets rápidos */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {INCIDENCE_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => handlePreset(p.value, p.area)}
                className="text-[10px] border border-amber-300 text-amber-700 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors"
              >
                {p.value}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Título *</label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Ej: Equipo no disponible"
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Área</label>
              <input
                type="text"
                value={formArea}
                onChange={e => setFormArea(e.target.value)}
                placeholder="Ej: laboratorio"
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>
          <div className="mb-2">
            <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Descripción (opcional)</label>
            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              rows={2}
              placeholder="Detalle adicional de la incidencia..."
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
            />
          </div>
          {formError && (
            <p className="text-[11px] text-red-600 mb-2">{formError}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[11px] font-semibold px-4 py-1.5 rounded-lg transition-colors"
          >
            {isPending ? 'Registrando…' : 'Registrar incidencia'}
          </button>
        </div>
      )}

      {/* Filtros */}
      {entries.length > 1 && (
        <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Filtrar:</span>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as TimelineEntryType | 'ALL')}
            className="text-[11px] border border-slate-200 rounded px-2 py-0.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-400"
          >
            <option value="ALL">Todos los tipos</option>
            {(Object.keys(TYPE_LABELS) as TimelineEntryType[]).map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          {uniqueAreas.length > 1 && (
            <select
              value={filterArea}
              onChange={e => setFilterArea(e.target.value)}
              className="text-[11px] border border-slate-200 rounded px-2 py-0.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-400"
            >
              <option value="ALL">Todas las áreas</option>
              {uniqueAreas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Línea de tiempo */}
      <div className="px-4 py-3">
        {filtered.length === 0 ? (
          <p className="text-[12px] text-slate-400 text-center py-4">
            {entries.length === 0
              ? 'Sin movimientos registrados aún. Se registrarán automáticamente al avanzar los estudios.'
              : 'Ningún movimiento coincide con los filtros.'}
          </p>
        ) : (
          <ol className="relative border-l border-slate-200 ml-2 space-y-3">
            {filtered.map((entry, i) => (
              <li key={entry.id} className="ml-4">
                {/* Punto de la línea */}
                <span
                  className={`absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-white ${
                    entry.entryType === 'ADMIN_INCIDENCE'
                      ? 'bg-amber-400'
                      : entry.entryType === 'STUDY_COMPLETED' || entry.entryType === 'MEDICAL_EXAM_SAVED'
                      ? 'bg-emerald-400'
                      : 'bg-teal-400'
                  }`}
                  style={{ marginTop: i === 0 ? '2px' : undefined }}
                />
                <div className="flex flex-wrap items-start gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400 mt-0.5 shrink-0">
                    {formatDatetime(entry.occurredAt)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[entry.entryType]}`}
                  >
                    <span>{TYPE_ICON[entry.entryType]}</span>
                    <span>{TYPE_LABELS[entry.entryType]}</span>
                  </span>
                  {entry.area && entry.area !== 'general' && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      {entry.area}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-slate-700 font-medium mt-0.5 leading-tight">
                  {entry.title}
                </p>
                {entry.description && (
                  <p className="text-[11px] text-slate-500 mt-0.5">{entry.description}</p>
                )}
                {entry.createdBy && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Registrado por {entry.createdBy.fullName}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
