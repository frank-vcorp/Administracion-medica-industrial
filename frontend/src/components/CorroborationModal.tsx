'use client'
/**
 * Modal de Corroboración de Identidad antes del Check-In.
 * Sprint 1 Recepción Operativa: selector de tipo de documento, captura frontal,
 * reverso opcional, reutilización de última evidencia válida, comentario operativo
 * obligatorio en excepción o discrepancia, cierre orquestado en una sola acción.
 * @id IMPL-20260519-10
 * @spec context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md
 */

import { useState, useTransition, useRef } from 'react'
import {
  IDENTITY_DOCUMENT_TYPES,
  IDENTITY_EXCEPTION_REASONS,
  type IdentityDocumentType,
  type IdentityEvidenceMode,
  type IdentityExceptionReason,
} from '@/lib/reception-corroboration'
import {
  closeReceptionCorroboration,
} from '@/actions/appointment.actions'
import { useRouter } from 'next/navigation'

// ── Etiquetas de catálogos ──────────────────────────────────────────────────
const DOC_TYPE_LABELS: Record<string, string> = {
  INE:                       '🪪 INE (preferido)',
  PASAPORTE:                 '🛂 Pasaporte',
  LICENCIA:                  '🚗 Licencia de conducir',
  OTRA_IDENTIFICACION_OFICIAL: '📄 Otra identificación oficial',
}

const EXCEPTION_REASON_LABELS: Record<string, string> = {
  SIN_DOCUMENTO_PRESENTE:   'Sin documento presente',
  FALLA_CAMARA_O_DISPOSITIVO: 'Falla de cámara o dispositivo',
  EVIDENCIA_NO_LEGIBLE:     'Evidencia no legible',
  DISCREPANCIA_DE_IDENTIDAD: 'Discrepancia de identidad',
  OTRO:                     'Otro',
}

// ── Interfaces ──────────────────────────────────────────────────────────────
interface WorkerData {
  id: string
  firstName: string
  lastName: string
  universalId: string | null
  phone: string | null
  email: string | null
  dob: Date | null
  company: { id: string; name: string } | null
  jobPosition: { id: string; name: string } | null
  lastIdentityDocumentType: string | null
  lastIdentityFrontFileUrl: string | null
  lastIdentityBackFileUrl: string | null
  lastIdentityVerifiedAt: Date | null
}

interface AppointmentData {
  id: string
  expedientId: string | null
  scheduledAt: Date | string
  worker: WorkerData
  company: { id: string; name: string } | null
  branch: { id: string; name: string } | null
}

interface Props {
  appointment: AppointmentData
  onClose: () => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function CorroborationModal({ appointment, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // ── Nombre
  const worker = appointment.worker
  const [corroboratedFirstName, setCorroboratedFirstName] = useState(worker.firstName)
  const [corroboratedLastName, setCorroboratedLastName] = useState(worker.lastName)

  // ── Modo de evidencia: 'NEW_CAPTURE' | 'REUSED_PREVIOUS' | 'EXCEPTION_WITHOUT_CAPTURE'
  const [evidenceMode, setEvidenceMode] = useState<IdentityEvidenceMode>('NEW_CAPTURE')

  // ── Tipo de documento
  const [documentType, setDocumentType] = useState<IdentityDocumentType>('INE')

  // ── Capturas
  const [frontDataUrl, setFrontDataUrl] = useState<string | null>(null)
  const [backDataUrl, setBackDataUrl] = useState<string | null>(null)
  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)

  // ── Reutilización de última evidencia
  const [reuseConfirmed, setReuseConfirmed] = useState(false)

  // ── Excepción
  const [exceptionReason, setExceptionReason] = useState<IdentityExceptionReason | ''>('')
  const [exceptionComment, setExceptionComment] = useState('')

  const scheduled = new Date(appointment.scheduledAt)
  const hasLastEvidence = !!worker.lastIdentityFrontFileUrl

  const nameChanged =
    corroboratedFirstName.trim() !== worker.firstName ||
    corroboratedLastName.trim() !== worker.lastName

  async function handleFrontFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setFrontDataUrl(dataUrl)
  }

  async function handleBackFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setBackDataUrl(dataUrl)
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await closeReceptionCorroboration({
        appointmentId: appointment.id,
        workerId: worker.id,
        correctedFirstName: nameChanged ? corroboratedFirstName : undefined,
        correctedLastName: nameChanged ? corroboratedLastName : undefined,
        evidenceMode,
        documentType: evidenceMode !== 'EXCEPTION_WITHOUT_CAPTURE' ? documentType : undefined,
        frontFileDataUrl: evidenceMode === 'NEW_CAPTURE' ? (frontDataUrl ?? undefined) : undefined,
        backFileDataUrl: evidenceMode === 'NEW_CAPTURE' ? (backDataUrl ?? undefined) : undefined,
        reuseLastEvidence: evidenceMode === 'REUSED_PREVIOUS' ? reuseConfirmed : undefined,
        exceptionReason: evidenceMode === 'EXCEPTION_WITHOUT_CAPTURE' ? (exceptionReason as IdentityExceptionReason) || undefined : undefined,
        exceptionComment: evidenceMode === 'EXCEPTION_WITHOUT_CAPTURE' ? exceptionComment : undefined,
      })

      if (result.success) {
        onClose()
        router.push(`/events/${result.medicalEvent?.id}`)
      } else {
        setError(result.error || 'Error en el cierre de recepción.')
      }
    })
  }

  // ── Validación local: ¿puede confirmar? ─────────────────────────────────
  const canConfirm = (() => {
    if (evidenceMode === 'NEW_CAPTURE') return !!frontDataUrl
    if (evidenceMode === 'REUSED_PREVIOUS') return reuseConfirmed
    if (evidenceMode === 'EXCEPTION_WITHOUT_CAPTURE') {
      return !!exceptionReason && exceptionComment.trim().length >= 5
    }
    return false
  })()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="bg-amber-500 px-8 py-6 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🪪</span>
            <div>
              <h2 className="text-lg font-black">Corroboración de Identidad</h2>
              <p className="text-amber-100 text-xs font-medium">Verifica la identidad antes del check-in · Sprint 1 Recepción Operativa</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-8 space-y-6">

          {/* Datos del evento */}
          <section className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Evento</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Empresa</p>
                <p className="text-sm font-medium text-slate-700">{worker.company?.name || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Puesto</p>
                <p className="text-sm font-medium text-slate-700">{worker.jobPosition?.name || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Expediente</p>
                <p className="text-sm font-mono font-bold text-slate-700">{appointment.expedientId || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Hora Cita</p>
                <p className="text-sm font-medium text-slate-700">
                  {scheduled.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </section>

          {/* Corrección de nombre */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                Identidad — corrobora contra identificación presentada
              </p>
              {nameChanged && (
                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                  ✏️ Nombre modificado
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Nombre(s)</label>
                <input
                  type="text"
                  value={corroboratedFirstName}
                  onChange={e => setCorroboratedFirstName(e.target.value)}
                  placeholder="Nombre(s) según identificación"
                  className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 rounded-xl text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Apellidos</label>
                <input
                  type="text"
                  value={corroboratedLastName}
                  onChange={e => setCorroboratedLastName(e.target.value)}
                  placeholder="Apellidos según identificación"
                  className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 rounded-xl text-sm outline-none"
                />
              </div>
            </div>
            <div className="bg-slate-100 rounded-xl p-3 ring-1 ring-slate-200 flex gap-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Fecha de Nacimiento</p>
                <p className="text-sm font-medium text-slate-700">
                  {worker.dob
                    ? new Date(worker.dob).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '— sin registro'}
                </p>
              </div>
              {worker.universalId && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">ID Universal</p>
                  <p className="text-xs font-mono text-slate-500">{worker.universalId}</p>
                </div>
              )}
            </div>
          </section>

          {/* Modo de evidencia */}
          <section className="space-y-3">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Evidencia de identificación</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { mode: 'NEW_CAPTURE' as IdentityEvidenceMode, icon: '📷', label: 'Captura nueva', disabled: false },
                { mode: 'REUSED_PREVIOUS' as IdentityEvidenceMode, icon: '♻️', label: 'Reutilizar última', disabled: !hasLastEvidence },
                { mode: 'EXCEPTION_WITHOUT_CAPTURE' as IdentityEvidenceMode, icon: '⚠️', label: 'Sin captura normal', disabled: false },
              ]).map(({ mode, icon, label, disabled }) => (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => setEvidenceMode(mode)}
                  className={`p-3 rounded-2xl text-xs font-bold text-center transition-all border-2 ${
                    evidenceMode === mode
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : disabled
                        ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
                  }`}
                >
                  <div className="text-xl mb-1">{icon}</div>
                  {label}
                  {mode === 'REUSED_PREVIOUS' && !hasLastEvidence && (
                    <div className="text-[9px] text-slate-400 mt-0.5">Sin historial</div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* ── Captura nueva ─────────────────────────────────────────────── */}
          {evidenceMode === 'NEW_CAPTURE' && (
            <section className="space-y-4 border-t border-slate-100 pt-4">
              {/* Tipo de documento */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Tipo de documento</label>
                <select
                  value={documentType}
                  onChange={e => setDocumentType(e.target.value as IdentityDocumentType)}
                  className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 rounded-xl text-sm outline-none"
                >
                  {IDENTITY_DOCUMENT_TYPES.map(t => (
                    <option key={t} value={t}>{DOC_TYPE_LABELS[t] ?? t}</option>
                  ))}
                </select>
                {documentType === 'INE' && (
                  <p className="text-[10px] text-amber-600 mt-1 font-medium">✓ INE — será privilegiada como referencia principal</p>
                )}
              </div>

              {/* Frente del documento */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  Frente del documento <span className="text-red-500">*</span>
                </label>
                {frontDataUrl ? (
                  <div className="relative">
                    <img src={frontDataUrl} alt="Frente" className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => { setFrontDataUrl(null); if (frontInputRef.current) frontInputRef.current.value = '' }}
                      className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center"
                    >✕</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 cursor-pointer bg-slate-50 transition-colors">
                    <span className="text-2xl">📁</span>
                    <span className="text-xs text-slate-500 mt-1">Seleccionar imagen del frente</span>
                    <input ref={frontInputRef} type="file" accept="image/*" className="hidden" onChange={handleFrontFileChange} />
                  </label>
                )}
              </div>

              {/* Reverso — opcional */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  Reverso del documento <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                {backDataUrl ? (
                  <div className="relative">
                    <img src={backDataUrl} alt="Reverso" className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => { setBackDataUrl(null); if (backInputRef.current) backInputRef.current.value = '' }}
                      className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center"
                    >✕</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-16 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-300 cursor-pointer bg-slate-50 transition-colors">
                    <span className="text-xl">🔄</span>
                    <span className="text-xs text-slate-400 mt-0.5">Agregar reverso (opcional)</span>
                    <input ref={backInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackFileChange} />
                  </label>
                )}
              </div>
            </section>
          )}

          {/* ── Reutilizar última evidencia ──────────────────────────────── */}
          {evidenceMode === 'REUSED_PREVIOUS' && hasLastEvidence && (
            <section className="space-y-3 border-t border-slate-100 pt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-blue-700">Última identificación válida disponible</p>
                <div className="flex gap-3">
                  <div>
                    <p className="text-[10px] text-blue-500 font-bold uppercase">Tipo</p>
                    <p className="text-sm font-medium text-blue-800">{DOC_TYPE_LABELS[worker.lastIdentityDocumentType ?? ''] ?? worker.lastIdentityDocumentType ?? '—'}</p>
                  </div>
                  {worker.lastIdentityVerifiedAt && (
                    <div>
                      <p className="text-[10px] text-blue-500 font-bold uppercase">Verificada</p>
                      <p className="text-sm font-medium text-blue-800">
                        {new Date(worker.lastIdentityVerifiedAt).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  )}
                </div>
                {worker.lastIdentityFrontFileUrl && (
                  <img
                    src={worker.lastIdentityFrontFileUrl}
                    alt="Última evidencia"
                    className="w-full h-24 object-cover rounded-xl border border-blue-200"
                  />
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reuseConfirmed}
                    onChange={e => setReuseConfirmed(e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-xs font-bold text-blue-700">Confirmo que esta evidencia sigue siendo válida para el ingreso de hoy</span>
                </label>
              </div>
            </section>
          )}

          {/* ── Excepción / comentario operativo ────────────────────────── */}
          {evidenceMode === 'EXCEPTION_WITHOUT_CAPTURE' && (
            <section className="space-y-4 border-t border-slate-100 pt-4">
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <p className="text-xs font-bold text-orange-700">Comentario operativo obligatorio</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">
                    Motivo <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={exceptionReason}
                    onChange={e => setExceptionReason(e.target.value as IdentityExceptionReason)}
                    className="w-full bg-white ring-1 ring-orange-200 focus:ring-2 focus:ring-orange-400 border-none p-3 rounded-xl text-sm outline-none"
                  >
                    <option value="">— Seleccionar motivo —</option>
                    {IDENTITY_EXCEPTION_REASONS.map(r => (
                      <option key={r} value={r}>{EXCEPTION_REASON_LABELS[r] ?? r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">
                    Comentario operativo <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={exceptionComment}
                    onChange={e => setExceptionComment(e.target.value)}
                    placeholder="Describe la situación específica de este ingreso..."
                    rows={3}
                    className="w-full bg-white ring-1 ring-orange-200 focus:ring-2 focus:ring-orange-400 border-none p-3 rounded-xl text-sm outline-none resize-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">{exceptionComment.trim().length}/5 mín. · El ingreso continuará sin bloqueo.</p>
                </div>
              </div>
            </section>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 font-medium">
              ⚠️ {error}
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-3 p-6 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !canConfirm}
            className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-6 rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? '⏳ Procesando...' : '✅ Confirmar y Hacer Check-In'}
          </button>
        </div>
      </div>
    </div>
  )
}

