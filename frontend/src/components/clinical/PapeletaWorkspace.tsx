/**
 * @fileoverview Workspace dedicado de Papeleta de Estudios — Paso 3
 * Implementa el patrón de navegación por estudios sin listas expandibles ni
 * cajas globales SIM/NOVA. Cada estudio tiene su propia vista de trabajo.
 * @id IMPL-20260324-06
 * @backup context/checkpoints/CHK_IMPL-20260324-06-PAPELETA-WORKSPACE.md
 * @intervention ARCH-20260326-07
 * @see context/checkpoints/CHK_IMPL-ARCH-20260326-06.md
 * @intervention ARCH-20260326-10
 * @see context/checkpoints/CHK_IMPL-ARCH-20260326-06.md
 * @intervention ARCH-20260326-18
 * @see context/checkpoints/CHK_IMPL-20260326-18.md
 * @intervention ARCH-20260326-01
 * @see context/checkpoints/CHK_ARCH-20260326-01.md
 * @intervention ARCH-20260327-01
 * @see context/checkpoints/CHK_IMPL-20260327-01-WORKSPACE-IA-DOBLE-COLUMNA.md
 * @intervention ARCH-20260327-02
 * @see context/checkpoints/CHK_ARCH-20260327-02-MICROAJUSTES-WORKSPACE.md
 * @intervention ARCH-20260327-06
 * @see context/checkpoints/CHK_ARCH-20260327-06-CABECERA-UNIFICADA.md
 */
"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateEventTestStatus, uploadEventTestFile, regenerateStudyAI } from "@/actions/event-test.actions"
import ExamenMedicoEstudio from "@/components/clinical/ExamenMedicoEstudio"
import SomatometriaStudy from "@/components/clinical/studies/SomatometriaStudy"
import AgudezaVisualStudy from "@/components/clinical/studies/AgudezaVisualStudy"
import StudyAIPrediagnosisPanel from "@/components/clinical/StudyAIPrediagnosisPanel"
import StudyDocumentViewer from "@/components/clinical/StudyDocumentViewer"
import StudyExtractionRawPanel from "@/components/clinical/StudyExtractionRawPanel"
// IMPL-20260326-18: Helper central de elegibilidad IA (reemplaza reglas dispersas)
import { isAIEligibleEventTest, getAIWorkflowLabel, getCanonicalAIStudyType } from "@/lib/study-ai"

// --- Tipos locales ---

type StudyStatus = 'PENDING' | 'IN_PROGRESS' | 'SAMPLE_TAKEN' | 'RESULT_REGISTERED' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED'

type StudyTest = {
  id: string
  testNameSnapshot: string
  status: StudyStatus
  fileUrl: string | null
  resultNotes: string | null
  test?: {
    code?: string | null
    category?: { name: string } | null
  } | null
  // IMPL-20260326-18: Snapshot IA vigente serializado desde page.tsx
  aiSnapshot?: {
    prediagnosisSnapshotId: string
    snapshot: {
      id: string
      version: number
      clinicalState: string
      createdAt: string
      isSuperseded: boolean
      prediagnosisData: unknown
      doctorReviews: Array<{
        id: string
        doctorStatus: string
        doctorDiagnosis: string | null
        doctorNotes: string | null
        createdAt: string
      }>
    }
    existingReview: {
      id: string
      doctorStatus: string
      doctorDiagnosis: string | null
      doctorNotes: string | null
      createdAt: string
    } | null
  } | null
  // ARCH-20260326-05: Capa de extracción estructurada del estudio
  // ARCH-20260327-01: rawPayload agrega el structuredData completo para el panel raw
  extractionSnapshot?: {
    id: string
    version: number
    extractedData: unknown
    missingFields: unknown
    rawPayload?: unknown
  } | null
}

type WorkerInfo = {
  name: string
  position: string
  company: string
  profile: string
}

type MedicalExamData = {
  somatometryData?: Record<string, unknown> | null
  eyeAcuityData?: Record<string, unknown> | null
  physicalExamData?: Record<string, unknown> | null
} | null

interface PapeletaWorkspaceProps {
  eventId: string
  eventTests: StudyTest[]
  workerInfo: WorkerInfo
  readonly?: boolean
  apiUrl: string
  /** Datos del MedicalExam para heredar en el estudio Examen Médico (IMPL-20260325-01) */
  examData?: MedicalExamData
  /** IMPL-20260325-08: Snapshot del portal (PrefilledInvitation.module1Data) para mostrar en Examen Médico */
  prefilledData?: Record<string, unknown> | null
  /** ARCH-20260326-10: Resumen longitudinal maestro para fallback inline en Examen Médico */
  longitudinalData?: Record<string, unknown> | null
  /** ARCH-20260326-06: ID del trabajador para CTA hacia Historial Clínico desde Examen Médico */
  workerId?: string
  /** IMPL-20260326-18: ID del usuario que revisa el prediagnóstico IA (médico en sesión) */
  reviewerUserId?: string
}

// --- Labels y estilos para estados V1 ---

const STATUS_LABELS: Record<StudyStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  SAMPLE_TAKEN: 'Muestra tomada',
  RESULT_REGISTERED: 'Resultado registrado',
  COMPLETED: 'Completado',
  SKIPPED: 'Omitido',
  CANCELLED: 'Cancelado',
}

const STATUS_BADGE: Record<StudyStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SAMPLE_TAKEN: 'bg-purple-100 text-purple-700',
  RESULT_REGISTERED: 'bg-teal-100 text-teal-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  SKIPPED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
}

// --- Helpers de formularios dedicados (no IA) ---

function isExamenMedico(name: string) {
  const lower = name.toLowerCase().trim()
  return lower.includes('examen medico') || lower.includes('examen médico')
}

function isSomatometria(name: string) {
  const lower = name.toLowerCase().trim()
  return (
    lower.includes('somatometría') ||
    lower.includes('somatometria') ||
    lower.includes('signos vitales')
  )
}

function isAgudezaVisual(name: string) {
  const lower = name.toLowerCase().trim()
  return lower.includes('agudeza visual')
}

// Laboratorio: tiene flujo de muestra independiente del pipeline IA
function isLabTest(test: StudyTest) {
  const catName = test.test?.category?.name?.toLowerCase() || ''
  const testName = test.testNameSnapshot.toLowerCase()
  return (
    catName.includes('lab') ||
    catName.includes('laboratorio') ||
    catName.includes('laborat') ||
    testName.includes('biometría') ||
    testName.includes('biometria') ||
    testName.includes('orina') ||
    testName.includes('ego') ||
    testName.includes('sangre') ||
    testName.includes('sanguínea') ||
    testName.includes('sanguinea') ||
    testName.includes('química') ||
    testName.includes('quimica')
  )
}

function getStudyIcon(test: StudyTest): string {
  if (isExamenMedico(test.testNameSnapshot)) return '📋'
  if (isSomatometria(test.testNameSnapshot)) return '⚖️'
  if (isAgudezaVisual(test.testNameSnapshot)) return '👁️'
  // IMPL-20260326-18: íconos por type canónico del helper central
  const canonical = getCanonicalAIStudyType(test)
  if (canonical === 'Audiometria') return '🎧'
  if (canonical === 'Espirometria') return '💨'
  if (canonical === 'Campimetria') return '🗺️'
  if (canonical === 'Electrocardiograma') return '💓'
  if (canonical === 'RiesgoCardiovascular') return '🫀'
  if (canonical === 'Rayos_X') return '🔬'
  if (test.fileUrl) return '📄'
  if (isLabTest(test)) return '🧪'
  return '🔬'
}

// --- Componente principal ---

export default function PapeletaWorkspace({
  eventId,
  eventTests,
  workerInfo,
  readonly = false,
  apiUrl,
  examData = null,
  prefilledData = null,
  longitudinalData = null,
  workerId,
  reviewerUserId = 'system',
}: PapeletaWorkspaceProps) {
  const router = useRouter()
  const [activeTestId, setActiveTestId] = useState<string | null>(null)
  const [localTests, setLocalTests] = useState<StudyTest[]>(eventTests)
  const [isPending, startTransition] = useTransition()
  const [uploadError, setUploadError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  // IMPL-20260326-03: Estado para regeneración IA desde archivo existente
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')

  const activeTest = localTests.find(t => t.id === activeTestId) ?? null
  const completedCount = localTests.filter(t =>
    t.status === 'COMPLETED' || t.status === 'RESULT_REGISTERED'
  ).length

  useEffect(() => {
    setLocalTests(eventTests)
  }, [eventTests])

  // Actualizaciones optimistas del estado local
  function updateLocalStatus(id: string, status: StudyStatus) {
    setLocalTests(prev => prev.map(t => t.id === id ? { ...t, status } : t))
  }

  function updateLocalFile(id: string, fileUrl: string) {
    setLocalTests(prev =>
      prev.map(t => t.id === id ? { ...t, fileUrl, status: 'RESULT_REGISTERED' as StudyStatus } : t)
    )
  }

  const handleStatusChange = (testId: string, status: StudyStatus) => {
    startTransition(async () => {
      const res = await updateEventTestStatus(testId, status as Parameters<typeof updateEventTestStatus>[1], eventId)
      if (res.success) {
        updateLocalStatus(testId, status)
      }
    })
  }

  const handleFileUpload = async (testId: string, file: File) => {
    setIsUploading(true)
    setUploadError('')
    const formData = new FormData()
    formData.append('eventTestId', testId)
    formData.append('eventId', eventId)
    formData.append('file', file)
    const res = await uploadEventTestFile(formData)
    setIsUploading(false)
    if (res.success && res.fileUrl) {
      updateLocalFile(testId, res.fileUrl)
      router.refresh()
    } else {
      setUploadError(res.error || 'Error al subir archivo')
    }
  }

  // IMPL-20260326-03: Regenerar análisis IA desde archivo existente en fileUrl
  const handleRegenerateAI = async (testId: string) => {
    setIsRegenerating(true)
    setRegenError('')
    const res = await regenerateStudyAI(testId, eventId, reviewerUserId)
    setIsRegenerating(false)
    if (res.success) {
      router.refresh()
    } else {
      setRegenError(res.error || 'Error al regenerar análisis IA')
    }
  }

  // --- Vista Resumen (entrada al workspace) ---
  if (!activeTestId) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <WorkerHeader
          workerInfo={workerInfo}
          completedCount={completedCount}
          totalCount={localTests.length}
        />
        <div className="p-4">
          <h2 className="text-base font-bold text-slate-800 mb-0.5">Estudios de la Papeleta</h2>
          <p className="text-sm text-slate-500 mb-3">
            Selecciona un estudio para abrirlo en su vista de trabajo.
          </p>

          {localTests.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-10">
              No hay estudios registrados en esta papeleta.
            </p>
          )}

          <div className="space-y-2">
            {localTests.map((test) => (
              <button
                key={test.id}
                onClick={() => setActiveTestId(test.id)}
                className="w-full text-left bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl px-4 py-3 transition-all group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{getStudyIcon(test)}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm group-hover:text-teal-700 truncate">
                        {test.testNameSnapshot}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {test.test?.category?.name ||
                          (isExamenMedico(test.testNameSnapshot) ? 'Formulario clínico' : 'Estudio documental')}
                        {test.test?.code && ` · ${test.test.code}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_BADGE[test.status]}`}>
                      {STATUS_LABELS[test.status]}
                    </span>
                    <span className="text-slate-400 group-hover:text-teal-600 text-sm">→</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // --- Vista Workspace (estudio activo) ---
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Cabecera persistente con botón de regreso */}
      <WorkerHeader
        workerInfo={workerInfo}
        completedCount={completedCount}
        totalCount={localTests.length}
        onBack={() => { setActiveTestId(null); setUploadError('') }}
      />

      {/* Selector compacto móvil */}
      <div className="md:hidden border-b border-slate-200 px-4 py-3 bg-slate-50">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          Estudio activo
        </label>
        <select
          value={activeTestId}
          onChange={(e) => { setActiveTestId(e.target.value); setUploadError('') }}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500 outline-none"
        >
          {localTests.map(t => (
            <option key={t.id} value={t.id}>
              {t.testNameSnapshot} — {STATUS_LABELS[t.status]}
            </option>
          ))}
        </select>
      </div>

      {/* Layout desktop: sidebar + panel principal */}
      <div className="flex min-h-[480px]">

        {/* Sidebar de navegación lateral (solo desktop) */}
        <nav className="hidden md:flex flex-col w-44 border-r border-slate-200 bg-slate-50 pt-2 pb-3 shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
            Estudios
          </p>
          {localTests.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTestId(t.id); setUploadError('') }}
              className={`text-left px-3 py-2 border-l-2 transition-colors ${
                t.id === activeTestId
                  ? 'bg-white border-teal-500 text-teal-700'
                  : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-800'
              }`}
            >
              <p className="text-xs font-semibold truncate">{t.testNameSnapshot}</p>
              <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 ${STATUS_BADGE[t.status]}`}>
                {STATUS_LABELS[t.status]}
              </span>
            </button>
          ))}
        </nav>

        {/* Panel principal del estudio activo */}
        <div className="flex-1 p-4 min-w-0">
          {activeTest && (
            <StudyPanel
              test={activeTest}
              eventId={eventId}
              examData={examData}
              prefilledData={prefilledData}
              longitudinalData={longitudinalData}
              workerId={workerId}
              reviewerUserId={reviewerUserId}
              readonly={readonly}
              isPending={isPending}
              isUploading={isUploading}
              uploadError={uploadError}
              isRegenerating={isRegenerating}
              regenError={regenError}
              apiUrl={apiUrl}
              onStatusChange={handleStatusChange}
              onFileUpload={handleFileUpload}
              onRegenerateAI={handleRegenerateAI}
              onExamenMedicoStatusChange={(status) => {
                updateLocalStatus(activeTest.id, status as StudyStatus)
                router.refresh()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// --- ARCH-20260326-05: Helpers para renderizado legible de datos extraídos ---

function formatFieldLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim() || '—'
  if (Array.isArray(value)) return value.map((v) => formatFieldValue(v)).join(', ')
  return String(value)
}

function ExtractedDataRows({ data, depth = 0 }: { data: Record<string, unknown>; depth?: number }) {
  return (
    <>
      {Object.entries(data).map(([key, value]) => {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          return (
            <div key={key} className={depth > 0 ? 'pl-3' : ''}>
              <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider py-1.5 pt-2">
                {formatFieldLabel(key)}
              </p>
              <ExtractedDataRows data={value as Record<string, unknown>} depth={depth + 1} />
            </div>
          )
        }
        return (
          <div key={key} className="flex justify-between items-start gap-4 py-1 border-b border-sky-100 last:border-0">
            <span className="text-xs text-slate-500 shrink-0">{formatFieldLabel(key)}</span>
            <span className="text-xs text-slate-800 font-medium text-right break-all">
              {formatFieldValue(value)}
            </span>
          </div>
        )
      })}
    </>
  )
}

// --- ARCH-20260326-05: Panel de Valores Capturados (capa extractiva) ---

function CapturedValuesPanel({
  extractedData,
  missingFields,
  version,
}: {
  extractedData: Record<string, unknown> | null
  missingFields: string[] | null
  version: number
}) {
  const hasData = extractedData && Object.keys(extractedData).length > 0
  const hasMissing = Array.isArray(missingFields) && missingFields.length > 0
  if (!hasData && !hasMissing) return null

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sky-600 text-base">📊</span>
          <p className="text-sm font-bold text-sky-800">Valores capturados</p>
        </div>
        <span className="text-[10px] font-mono text-sky-500 bg-sky-100 px-2 py-0.5 rounded">
          v{version}
        </span>
      </div>

      {hasData && (
        <div>
          <ExtractedDataRows data={extractedData} />
        </div>
      )}

      {hasMissing && (
        <div className="pt-2 border-t border-sky-200">
          <p className="text-xs font-bold text-amber-700 mb-1.5">Campos no encontrados</p>
          <div className="flex flex-wrap gap-1.5">
            {missingFields!.map((field, i) => (
              <span
                key={i}
                className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200"
              >
                {formatFieldLabel(field)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Sub-componente: Cabecera persistente del workspace ---

function WorkerHeader({
  workerInfo,
  completedCount,
  totalCount,
  onBack,
}: {
  workerInfo: WorkerInfo
  completedCount: number
  totalCount: number
  onBack?: () => void
}) {
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className="px-4 py-2.5 bg-gradient-to-r from-teal-50 to-slate-50 border-b border-slate-200">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-teal-600 hover:text-teal-800 text-sm font-semibold mr-1 shrink-0"
            >
              ← Resumen
            </button>
          )}
          <div className="w-8 h-8 bg-teal-500 text-white rounded-xl flex items-center justify-center text-base shrink-0">
            👤
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">Workspace de estudios</p>
            <div className="flex gap-1.5 text-xs text-slate-500 flex-wrap mt-0.5">
              {workerInfo.position && (
                <span className="font-medium text-slate-700">{workerInfo.position}</span>
              )}
              {workerInfo.position && workerInfo.company && <span>·</span>}
              {workerInfo.company && <span>{workerInfo.company}</span>}
              {workerInfo.profile && (
                <>
                  <span>·</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium">
                    {workerInfo.profile}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Progreso general */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">
            {completedCount}/{totalCount} completados
          </span>
          <div className="h-2 w-16 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Sub-componente: Panel de trabajo del estudio seleccionado ---

function StudyPanel({
  test,
  eventId,
  examData,
  prefilledData,
  longitudinalData,
  workerId,
  reviewerUserId,
  readonly,
  isPending,
  isUploading,
  uploadError,
  isRegenerating,
  regenError,
  apiUrl,
  onStatusChange,
  onFileUpload,
  onRegenerateAI,
  onExamenMedicoStatusChange,
}: {
  test: StudyTest
  eventId: string
  examData: MedicalExamData
  prefilledData: Record<string, unknown> | null | undefined
  longitudinalData: Record<string, unknown> | null | undefined
  workerId: string | undefined
  reviewerUserId: string
  readonly: boolean
  isPending: boolean
  isUploading: boolean
  uploadError: string
  isRegenerating: boolean
  regenError: string
  apiUrl: string
  onStatusChange: (id: string, status: StudyStatus) => void
  onFileUpload: (id: string, file: File) => void
  onRegenerateAI: (id: string) => void
  onExamenMedicoStatusChange: (status: string) => void
}) {
  const isMedico = isExamenMedico(test.testNameSnapshot)
  const isSomato = isSomatometria(test.testNameSnapshot)
  const isAgudeza = isAgudezaVisual(test.testNameSnapshot)
  const isLab = isLabTest(test)
  // IMPL-20260326-18: Elegibilidad y type canónico desde helper central
  const aiLabel = getAIWorkflowLabel(test)
  const isAIEligible = isAIEligibleEventTest(test)
  const sampleTracked = isLab && ['SAMPLE_TAKEN', 'RESULT_REGISTERED', 'COMPLETED'].includes(test.status)
  const resultTracked = ['RESULT_REGISTERED', 'COMPLETED'].includes(test.status)

  return (
    <div className="space-y-4">

      {/* Encabezado del estudio */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{test.testNameSnapshot}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {test.test?.category?.name && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {test.test.category.name}
              </span>
            )}
            {test.test?.code && (
              <span className="text-xs font-mono text-slate-500">{test.test.code}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              isMedico ? 'bg-blue-50 text-blue-600' :
              isSomato ? 'bg-teal-50 text-teal-700' :
              isAgudeza ? 'bg-indigo-50 text-indigo-700' :
              isLab ? 'bg-purple-50 text-purple-700' :
              isAIEligible ? 'bg-teal-50 text-teal-700' :
              'bg-slate-50 text-slate-600'
            }`}>
              {isMedico ? '📋 Formulario' :
               isSomato ? '⚖️ Somatometría' :
               isAgudeza ? '👁️ Agudeza Visual' :
               isLab ? '🧪 Con muestra y resultado' :
               (aiLabel ?? '📄 Documental')}
            </span>
          </div>
        </div>
        <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${STATUS_BADGE[test.status]}`}>
          {STATUS_LABELS[test.status]}
        </span>
      </div>

      <hr className="border-slate-100" />

      {/* IMPL-20260326-04: Ocultar Trazabilidad IA cuando ya existe aiSnapshot (el panel reemplaza este aviso) */}
      {test.resultNotes && !test.aiSnapshot && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Trazabilidad IA</p>
          <p className="text-sm text-amber-900 mt-1">{test.resultNotes}</p>
        </div>
      )}

      {/* Sección: Somatometría (IMPL-20260325-05 — ARCH-20260325-05) */}
      {isSomato && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5">
            <span className="text-teal-600 text-base">⚖️</span>
            <div>
              <p className="text-sm font-bold text-teal-800">Somatometría — Formulario de Captura</p>
              <p className="text-xs text-teal-600">Registra peso, talla, signos vitales y calcula IMC.</p>
            </div>
          </div>
          <SomatometriaStudy
            eventId={eventId}
            eventTestId={test.id}
            initialData={(examData?.somatometryData as Record<string, unknown>) ?? null}
            readonly={readonly}
            onStatusChange={(status) => onExamenMedicoStatusChange(status)}
          />
        </div>
      )}

      {/* Sección: Agudeza Visual (IMPL-20260325-05 — ARCH-20260325-05) */}
      {isAgudeza && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
            <span className="text-indigo-600 text-base">👁️</span>
            <div>
              <p className="text-sm font-bold text-indigo-800">Agudeza Visual — Formulario de Captura</p>
              <p className="text-xs text-indigo-600">Registra visión lejana, cercana, corregida y pruebas complementarias.</p>
            </div>
          </div>
          <AgudezaVisualStudy
            eventId={eventId}
            eventTestId={test.id}
            initialData={(examData?.eyeAcuityData as Record<string, unknown>) ?? null}
            readonly={readonly}
            onStatusChange={(status) => onExamenMedicoStatusChange(status)}
          />
        </div>
      )}

      {/* Sección: Examen Médico (tipo formulario — IMPL-20260325-01) */}
      {isMedico && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
            <span className="text-blue-600 text-base">📋</span>
            <div>
              <p className="text-sm font-bold text-blue-800">Examen Médico — Formulario Clínico</p>
              <p className="text-xs text-blue-600">
                Completa las secciones: Módulo 1 → Exploración Física → Impresión / Aptitud
              </p>
            </div>
          </div>
          <ExamenMedicoEstudio
            eventId={eventId}
            eventTestId={test.id}
            examData={examData}
            prefilledData={prefilledData ?? null}
            longitudinalData={longitudinalData ?? null}
            readonly={readonly}
            workerId={workerId}
            onStatusChange={onExamenMedicoStatusChange}
          />
        </div>
      )}

      {/* ARCH-20260327-01: Estudios documentales — layout bifurcado de 2 columnas en desktop.
          Izquierda: dropzone, trazabilidad, extracción legible, prediagnóstico IA, acciones.
          Derecha: archivo vinculado, visor embebido, raw de extracción. */}
      {!isMedico && !isSomato && !isAgudeza && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ===== COLUMNA IZQUIERDA: OPERACIÓN CLÍNICA ===== */}
          <div className="space-y-3">

            {/* Flujo de laboratorio */}
            {isLab && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-purple-800">Flujo de laboratorio</p>
                    <p className="text-xs text-purple-600 mt-1">
                      Este estudio requiere seguimiento de muestra y resultado.
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${sampleTracked ? 'bg-purple-200 text-purple-800' : 'bg-white text-purple-700 border border-purple-200'}`}>
                    {sampleTracked ? '✓ Muestra tomada' : 'Muestra pendiente'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sampleTracked ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-500'}`}>
                    {sampleTracked ? '✓ 1. Muestra' : '1. Muestra'}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${resultTracked ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>
                    {resultTracked ? '✓ 2. Resultado' : '2. Resultado'}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${test.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    {test.status === 'COMPLETED' ? '✓ 3. Cierre' : '3. Cierre'}
                  </span>
                </div>

                {!readonly && !sampleTracked && (test.status === 'PENDING' || test.status === 'IN_PROGRESS') && (
                  <button
                    onClick={() => onStatusChange(test.id, 'SAMPLE_TAKEN')}
                    disabled={isPending}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    🧪 Registrar muestra tomada
                  </button>
                )}
              </div>
            )}

            {/* Dropzone de upload */}
            {!readonly && (
              <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                isUploading ? 'border-teal-300 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
              }`}>
                <label className="cursor-pointer block">
                  <span className="text-2xl block mb-1">
                    {isUploading ? '⏳' : '📎'}
                  </span>
                  <span className="text-sm font-medium text-slate-600">
                    {test.fileUrl ? 'Reemplazar archivo' : 'Subir resultado'}
                  </span>
                  <span className="block text-xs text-slate-400 mt-1">
                    PDF, PNG o JPG — máx. 20MB
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) onFileUpload(test.id, file)
                    }}
                  />
                </label>
                {isUploading && (
                  <p className="text-xs text-teal-600 mt-2 animate-pulse">Subiendo archivo...</p>
                )}
                {uploadError && (
                  <p className="text-xs text-red-500 mt-2">{uploadError}</p>
                )}
              </div>
            )}

            {/* Tarjeta de recuperación IA — archivo sin snapshot */}
            {isAIEligible && !test.aiSnapshot && test.fileUrl && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-amber-500 text-xl shrink-0">⚠️</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-amber-800">Análisis IA pendiente</p>
                    <p className="text-sm text-amber-700 mt-1">
                      El archivo fue cargado correctamente pero el análisis IA aún no se ejecutó
                      (o no se registraron snapshots). Puedes regenerarlo sin necesidad de volver a subir el archivo.
                    </p>
                    <p className="text-xs text-amber-600 font-mono mt-1 break-all">
                      {test.fileUrl.split('/').pop()}
                    </p>
                  </div>
                </div>
                {regenError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {regenError}
                  </p>
                )}
                {!readonly && (
                  <button
                    onClick={() => onRegenerateAI(test.id)}
                    disabled={isRegenerating}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    {isRegenerating ? '⏳ Generando IA...' : '🤖 Generar IA ahora'}
                  </button>
                )}
              </div>
            )}

            {/* Valores capturados (capa extractiva legible — separada del raw) */}
            {test.extractionSnapshot && (
              <CapturedValuesPanel
                extractedData={test.extractionSnapshot.extractedData as Record<string, unknown> | null}
                missingFields={test.extractionSnapshot.missingFields as string[] | null}
                version={test.extractionSnapshot.version}
              />
            )}

            {/* Panel de Prediagnóstico IA — separado visualmente del raw */}
            {isAIEligible && test.aiSnapshot && (
              <StudyAIPrediagnosisPanel
                prediagnosisSnapshotId={test.aiSnapshot.prediagnosisSnapshotId}
                snapshot={test.aiSnapshot.snapshot as unknown as Parameters<typeof StudyAIPrediagnosisPanel>[0]['snapshot']}
                reviewerUserId={reviewerUserId}
                eventId={eventId}
                existingReview={test.aiSnapshot.existingReview as unknown as Parameters<typeof StudyAIPrediagnosisPanel>[0]['existingReview']}
                readonly={readonly}
              />
            )}

            {/* Acciones de estado */}
            {!readonly && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cambiar estado
                </p>
                <div className="flex flex-wrap gap-2">
                  {test.status === 'PENDING' && (
                    <button
                      onClick={() => onStatusChange(test.id, 'IN_PROGRESS')}
                      disabled={isPending}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      ▶ Iniciar proceso
                    </button>
                  )}
                  {isLab && !sampleTracked && (test.status === 'PENDING' || test.status === 'IN_PROGRESS') && (
                    <button
                      onClick={() => onStatusChange(test.id, 'SAMPLE_TAKEN')}
                      disabled={isPending}
                      className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      🧪 Muestra tomada
                    </button>
                  )}
                  {(test.status !== 'COMPLETED' && test.status !== 'RESULT_REGISTERED') && (
                    <button
                      onClick={() => onStatusChange(test.id, 'RESULT_REGISTERED')}
                      disabled={isPending}
                      className="bg-teal-100 hover:bg-teal-200 text-teal-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      ✅ Resultado registrado
                    </button>
                  )}
                  {test.status !== 'COMPLETED' && (
                    <button
                      onClick={() => onStatusChange(test.id, 'COMPLETED')}
                      disabled={isPending}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      🏁 Completar estudio
                    </button>
                  )}
                </div>
                {isPending && (
                  <p className="text-xs text-slate-400 animate-pulse">Guardando...</p>
                )}
              </div>
            )}

            {/* Badge de solo lectura */}
            {readonly && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400">Vista de solo lectura — el expediente ya fue cerrado.</p>
              </div>
            )}
          </div>

          {/* ===== COLUMNA DERECHA: EVIDENCIA DOCUMENTAL ===== */}
          <div className="space-y-3 lg:sticky lg:top-4 self-start">

            {/* Archivo vinculado + visor embebido */}
            {test.fileUrl ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Archivo vinculado</p>
                <StudyDocumentViewer
                  fileUrl={`${apiUrl}${test.fileUrl}`}
                  fileName={test.fileUrl.split('/').pop() || 'archivo'}
                />
              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center">
                <span className="text-2xl block mb-1">📂</span>
                <p className="text-sm text-slate-400 font-medium">Sin archivo vinculado</p>
                <p className="text-xs text-slate-400 mt-1">Sube el resultado para visualizarlo aquí.</p>
              </div>
            )}

            {/* Panel raw de extracción — separado del prediagnóstico */}
            {test.extractionSnapshot ? (
              <StudyExtractionRawPanel
                rawPayload={test.extractionSnapshot.rawPayload}
                snapshotId={test.extractionSnapshot.id}
                version={test.extractionSnapshot.version}
              />
            ) : (
              <div className="bg-slate-900 rounded-xl px-4 py-3">
                <p className="text-xs font-mono text-slate-500">🔩 Sin snapshot de extracción disponible.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acciones y badge para estudios de formulario (Médico, Somatometría, Agudeza Visual) */}
      {(isMedico || isSomato || isAgudeza) && !readonly && (
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Cambiar estado
          </p>
          <div className="flex flex-wrap gap-2">
            {test.status === 'PENDING' && (
              <button
                onClick={() => onStatusChange(test.id, 'IN_PROGRESS')}
                disabled={isPending}
                className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                ▶ Iniciar proceso
              </button>
            )}
            {(test.status !== 'COMPLETED' && test.status !== 'RESULT_REGISTERED') && !isMedico && (
              <button
                onClick={() => onStatusChange(test.id, 'RESULT_REGISTERED')}
                disabled={isPending}
                className="bg-teal-100 hover:bg-teal-200 text-teal-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                ✅ Resultado registrado
              </button>
            )}
            {test.status !== 'COMPLETED' && (
              <button
                onClick={() => onStatusChange(test.id, 'COMPLETED')}
                disabled={isPending}
                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                🏁 Completar estudio
              </button>
            )}
          </div>
          {isPending && (
            <p className="text-xs text-slate-400 animate-pulse">Guardando...</p>
          )}
        </div>
      )}

      {(isMedico || isSomato || isAgudeza) && readonly && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400">Vista de solo lectura — el expediente ya fue cerrado.</p>
        </div>
      )}
    </div>
  )
}
