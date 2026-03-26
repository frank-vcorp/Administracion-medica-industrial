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
 */
"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateEventTestStatus, uploadEventTestFile } from "@/actions/event-test.actions"
import ExamenMedicoEstudio from "@/components/clinical/ExamenMedicoEstudio"
import SomatometriaStudy from "@/components/clinical/studies/SomatometriaStudy"
import AgudezaVisualStudy from "@/components/clinical/studies/AgudezaVisualStudy"
import StudyAIPrediagnosisPanel from "@/components/clinical/StudyAIPrediagnosisPanel"
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

  // --- Vista Resumen (entrada al workspace) ---
  if (!activeTestId) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <WorkerHeader
          workerInfo={workerInfo}
          completedCount={completedCount}
          totalCount={localTests.length}
        />
        <div className="p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Estudios de la Papeleta</h2>
          <p className="text-sm text-slate-500 mb-5">
            Selecciona un estudio para abrirlo en su vista de trabajo.
          </p>

          {localTests.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-10">
              No hay estudios registrados en esta papeleta.
            </p>
          )}

          <div className="space-y-3">
            {localTests.map((test) => (
              <button
                key={test.id}
                onClick={() => setActiveTestId(test.id)}
                className="w-full text-left bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl px-5 py-4 transition-all group"
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
        <nav className="hidden md:flex flex-col w-56 border-r border-slate-200 bg-slate-50 pt-3 pb-4 shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 mb-2">
            Estudios
          </p>
          {localTests.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTestId(t.id); setUploadError('') }}
              className={`text-left px-4 py-3 border-l-2 transition-colors ${
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
        <div className="flex-1 p-6 min-w-0">
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
              apiUrl={apiUrl}
              onStatusChange={handleStatusChange}
              onFileUpload={handleFileUpload}
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
    <div className="px-5 py-4 bg-gradient-to-r from-teal-50 to-slate-50 border-b border-slate-200">
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
          <div className="w-9 h-9 bg-teal-500 text-white rounded-xl flex items-center justify-center text-base shrink-0">
            👤
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{workerInfo.name}</p>
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
          <div className="h-2 w-20 bg-slate-200 rounded-full overflow-hidden">
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
  apiUrl,
  onStatusChange,
  onFileUpload,
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
  apiUrl: string
  onStatusChange: (id: string, status: StudyStatus) => void
  onFileUpload: (id: string, file: File) => void
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
    <div className="space-y-6">

      {/* Encabezado del estudio */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-xl font-bold text-slate-800">{test.testNameSnapshot}</h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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

      {/* Flujo visible de laboratorio para no esconder la etapa de muestra */}
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

      {/* Sección: Upload atómico (estudios documentales: no Examen Médico, Somatometría ni Agudeza Visual) */}
      {!isMedico && !isSomato && !isAgudeza && (
        <div className="space-y-4">
          {/* Visor de archivo existente */}
          {test.fileUrl && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Archivo vinculado</p>
                  <p className="text-xs text-emerald-600 font-mono break-all">
                    {test.fileUrl.split('/').pop()}
                  </p>
                </div>
              </div>
              <a
                href={`${apiUrl}${test.fileUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shrink-0"
              >
                Ver archivo
              </a>
            </div>
          )}

          {/* Dropzone de upload */}
          {!readonly && (
            <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              isUploading ? 'border-teal-300 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
            }`}>
              <label className="cursor-pointer block">
                <span className="text-3xl block mb-2">
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
        </div>
      )}

      {/* IMPL-20260326-18: Panel de Prediagnóstico IA — se muestra cuando existe snapshot IA vigente
          y el estudio es elegible para IA según la matriz canónica. */}
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
            {/* Muestra tomada — útil para laboratorio y cualquier estudio que lo requiera */}
            {isLab && !sampleTracked && (test.status === 'PENDING' || test.status === 'IN_PROGRESS') && !isMedico && (
              <button
                onClick={() => onStatusChange(test.id, 'SAMPLE_TAKEN')}
                disabled={isPending}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                🧪 Muestra tomada
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

      {/* Badge de solo lectura */}
      {readonly && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400">Vista de solo lectura — el expediente ya fue cerrado.</p>
        </div>
      )}
    </div>
  )
}
