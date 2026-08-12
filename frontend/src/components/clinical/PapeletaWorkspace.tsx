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
 * @intervention ARCH-20260327-09
 * @see context/checkpoints/CHK_ARCH-20260327-09-METADATOS-EN-CABECERA-PRINCIPAL.md
 * @intervention ARCH-20260327-10
 * @see context/checkpoints/CHK_ARCH-20260327-10-PAPELETA-ELECTRONICA.md
 * @intervention ARCH-20260327-11
 * @see context/checkpoints/CHK_ARCH-20260327-11-ELIMINA-FRANJA-PAPELETA.md
 * @intervention IMPL-20260604-01
 * @backup context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md
 */
"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { StudyPresentationSchema } from "@/types/calibration"
import { updateEventTestStatus, uploadEventTestFile, regenerateStudyAI, clearEventTestFile } from "@/actions/event-test.actions"
import ExamenMedicoEstudio from "@/components/clinical/ExamenMedicoEstudio"
import SomatometriaStudy from "@/components/clinical/studies/SomatometriaStudy"
import AgudezaVisualStudy from "@/components/clinical/studies/AgudezaVisualStudy"
import StudyAIPrediagnosisPanel from "@/components/clinical/StudyAIPrediagnosisPanel"
import StudyDocumentViewer from "@/components/clinical/StudyDocumentViewer"
// IMPL-20260518-13: Renderer clínico general configurable por studyType
import ClinicalExtractionRenderer from "@/components/clinical/ClinicalExtractionRenderer"
// IMPL-20260326-18: Helper central de elegibilidad IA (reemplaza reglas dispersas)
import { isAIEligibleEventTest, getAIWorkflowLabel, getCanonicalAIStudyType } from "@/lib/study-ai"
// ARCH-20260507-07: Bloque de trazabilidad operativa ligera (sin cambiar flujo)
import TraceabilidadLigera from "@/components/clinical/TraceabilidadLigera"

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
    // ARCH-20260507-06: options para resolver sampleGroup (sampleType en MedicalTest.options)
    options?: unknown
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

// IMPL-20260630-02: rename de labels según doc Renombramiento de catálogos (líneas 67-73)
const STATUS_LABELS: Record<StudyStatus, string> = {
  PENDING: 'Pendiente de resultado de prueba',
  IN_PROGRESS: 'En proceso',
  SAMPLE_TAKEN: 'Pendiente de resultado de prueba de laboratorio',
  RESULT_REGISTERED: 'Pendiente de Reporte de aptitud',
  COMPLETED: 'Pendiente de envio',
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

// --- IMPL-20260516-04: Etapas del pipeline IA para progreso visual por hitos ---
// @id IMPL-20260516-04
// @backup context/checkpoints/CHK_IMPL-20260516-04.md

type UploadStageId = 'uploading' | 'classifying' | 'extracting' | 'prediagnosing' | 'saving'

const AI_PIPELINE_STAGES: { id: UploadStageId; label: string; pct: number }[] = [
  { id: 'uploading',     label: 'Subiendo archivo',                      pct: 10  },
  { id: 'classifying',   label: 'Clasificando estudio',                  pct: 25  },
  { id: 'extracting',    label: 'Extrayendo datos con Gemini',           pct: 50  },
  { id: 'prediagnosing', label: 'Generando prediagnóstico con MedGemma', pct: 80  },
  { id: 'saving',        label: 'Guardando resultado',                   pct: 100 },
]

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

/**
 * Extrae el schema persistido desde aiCalibration.presentation cuando existe.
 * @id IMPL-20260604-01
 * @backup context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md
 */
function getPersistedPresentationSchema(test: StudyTest): StudyPresentationSchema | null {
  const options = test.test?.options
  if (!options || typeof options !== 'object' || Array.isArray(options)) return null

  const aiCalibration =
    'aiCalibration' in options &&
    options.aiCalibration &&
    typeof options.aiCalibration === 'object' &&
    !Array.isArray(options.aiCalibration)
      ? (options.aiCalibration as Record<string, unknown>)
      : null

  const presentation =
    aiCalibration &&
    'presentation' in aiCalibration &&
    aiCalibration.presentation &&
    typeof aiCalibration.presentation === 'object' &&
    !Array.isArray(aiCalibration.presentation)
      ? (aiCalibration.presentation as Record<string, unknown>)
      : null

  if (!presentation || presentation.enabled === false) return null

  const schema = presentation.schema
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return null
  if (!Array.isArray((schema as Record<string, unknown>).sections)) return null

  return schema as StudyPresentationSchema
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

/**
 * ARCH-20260507-06: Resuelve el grupo de muestra de un estudio.
 * Fuente principal: test.options.sampleType.
 * Fallback: heurística por nombre del estudio.
 * Devuelve 'otro' cuando no hay grupo definido (sin propagación).
 */
function resolveSampleGroup(test: StudyTest): string {
  const opts = test.test?.options
  if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
    const sampleType = (opts as Record<string, unknown>).sampleType
    if (typeof sampleType === 'string' && sampleType.trim()) {
      return sampleType.trim().toLowerCase()
    }
  }
  const name = test.testNameSnapshot.toLowerCase()
  if (
    name.includes('sangre') || name.includes('sanguín') || name.includes('sanguinea') ||
    name.includes('biometría') || name.includes('biometria') ||
    name.includes('química') || name.includes('quimica') ||
    name.includes('glucosa') || name.includes('colesterol') ||
    name.includes('hemograma')
  ) return 'sangre'
  if (name.includes('orina') || name.includes('ego') || name.includes('urin')) return 'orina'
  if (name.includes('heces') || name.includes('copro')) return 'heces'
  return 'otro'
}

function getStudyIcon(test: StudyTest): string {  if (isExamenMedico(test.testNameSnapshot)) return '📋'
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
  workerInfo: _workerInfo,
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
  // IMPL-20260516-04: Etapa activa del pipeline IA para UX de progreso visual
  const [uploadStage, setUploadStage] = useState<UploadStageId | null>(null)
  const [regenStage, setRegenStage] = useState<UploadStageId | null>(null)
  // ARCH-20260518-04: Estado para limpieza de archivo y análisis
  const [isClearingStudy, setIsClearingStudy] = useState(false)
  const [clearStudyError, setClearStudyError] = useState('')

  const activeTest = localTests.find(t => t.id === activeTestId) ?? null
  const completedCount = localTests.filter(t =>
    t.status === 'COMPLETED' || t.status === 'RESULT_REGISTERED'
  ).length

  // ARCH-20260507-06: Determinar si la muestra del estudio activo ya fue tomada por grupo compartido
  const activeTestGroup = activeTest && isLabTest(activeTest) ? resolveSampleGroup(activeTest) : 'otro'
  const groupSampleTaken = activeTestGroup !== 'otro' && localTests.some(t =>
    t.id !== activeTest?.id &&
    resolveSampleGroup(t) === activeTestGroup &&
    (['SAMPLE_TAKEN', 'RESULT_REGISTERED', 'COMPLETED'] as StudyStatus[]).includes(t.status)
  )

  // ARCH-20260506-06: Somatometría y Agudeza Visual se ocultan del sidebar cuando
  // existe un Examen Médico (ahora viven como pestañas dentro de él).
  const hasExamenMedicoTest = localTests.some(t => isExamenMedico(t.testNameSnapshot))
  const somatometriaTest = localTests.find(t => isSomatometria(t.testNameSnapshot))
  const agudezaTest = localTests.find(t => isAgudezaVisual(t.testNameSnapshot))
  const visibleTests = hasExamenMedicoTest
    ? localTests.filter(t => !isSomatometria(t.testNameSnapshot) && !isAgudezaVisual(t.testNameSnapshot))
    : localTests

  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza state local con prop eventTests (controlled state pattern). */
  useEffect(() => {
    setLocalTests(eventTests)
  }, [eventTests])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Actualizaciones optimistas del estado local
  function updateLocalStatus(id: string, status: StudyStatus) {
    setLocalTests(prev => prev.map(t => t.id === id ? { ...t, status } : t))
  }

  // ARCH-20260518-04: actualización optimista con snapshot vigente (evita depender solo de router.refresh)
  function updateLocalFile(
    id: string,
    fileUrl: string,
    extractionSnapshot: StudyTest['extractionSnapshot'] | null = null
  ) {
    setLocalTests(prev =>
      prev.map(t => t.id === id ? {
        ...t,
        fileUrl,
        status: 'RESULT_REGISTERED' as StudyStatus,
        extractionSnapshot,
        aiSnapshot: null,
      } : t)
    )
  }

  const handleStatusChange = (testId: string, status: StudyStatus) => {
    startTransition(async () => {
      const res = await updateEventTestStatus(testId, status as Parameters<typeof updateEventTestStatus>[1], eventId)
      if (res.success) {
        // ARCH-20260507-06: Si SAMPLE_TAKEN, propagar localmente a hermanos del mismo grupo
        if (status === 'SAMPLE_TAKEN') {
          const triggerTest = localTests.find(t => t.id === testId)
          const group = triggerTest ? resolveSampleGroup(triggerTest) : 'otro'
          setLocalTests(prev => prev.map(t => {
            if (t.id === testId) return { ...t, status }
            if (
              group !== 'otro' &&
              resolveSampleGroup(t) === group &&
              (t.status === 'PENDING' || t.status === 'IN_PROGRESS')
            ) {
              return { ...t, status: 'SAMPLE_TAKEN' as StudyStatus }
            }
            return t
          }))
        } else {
          updateLocalStatus(testId, status)
        }
      }
    })
  }

  // IMPL-20260516-04: Avance progresivo de etapas mientras corre el pipeline IA
  // FIX-20260516-01: try/catch/finally robusto — sin promesas sin capturar ante ERR_NETWORK_CHANGED
  const handleFileUpload = async (testId: string, file: File) => {
    let currentStage: UploadStageId | null = 'uploading'
    setIsUploading(true)
    setUploadError('')
    setUploadStage('uploading')
    const t1 = setTimeout(() => { currentStage = 'classifying';   setUploadStage('classifying') },   3000)
    const t2 = setTimeout(() => { currentStage = 'extracting';    setUploadStage('extracting') },    7000)
    const t3 = setTimeout(() => { currentStage = 'prediagnosing'; setUploadStage('prediagnosing') }, 15000)
    const t4 = setTimeout(() => { currentStage = 'saving';        setUploadStage('saving') },        28000)
    const formData = new FormData()
    formData.append('eventTestId', testId)
    formData.append('eventId', eventId)
    formData.append('file', file)
    try {
      const res = await uploadEventTestFile(formData)
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4)
      if (res.success && res.fileUrl) {
        setUploadStage('saving')
        await new Promise<void>(r => setTimeout(r, 700))
        // ARCH-20260518-04: actualización optimista con snapshot si el action lo devuelve
        type UploadResWithSnapshot = typeof res & {
          extractionSnapshotData?: StudyTest['extractionSnapshot']
        }
        const resTyped = res as UploadResWithSnapshot
        updateLocalFile(testId, res.fileUrl, resTyped.extractionSnapshotData ?? null)
        router.refresh()
      } else {
        setUploadError(res.error || 'Error al subir archivo')
      }
    } catch (err) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4)
      const isNetworkError = err instanceof TypeError &&
        (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed'))
      console.error('[FIX-20260516-01][upload] Fallo en upload IA', {
        operacion: 'upload',
        eventId,
        eventTestId: testId,
        archivo: file.name,
        etapaVisible: currentStage,
        error: err instanceof Error ? err.message : String(err),
      })
      setUploadError(
        isNetworkError
          ? 'La carga o el procesamiento IA se interrumpieron por un cambio de red. Intenta nuevamente.'
          : 'Error al subir archivo. Intenta nuevamente.'
      )
    } finally {
      setUploadStage(null)
      setIsUploading(false)
    }
  }

  // IMPL-20260326-03 / IMPL-20260516-04: Regenerar análisis IA con progreso visual por etapas
  // FIX-20260516-01: try/catch/finally robusto — sin promesas sin capturar ante ERR_NETWORK_CHANGED
  const handleRegenerateAI = async (testId: string) => {
    let currentStage: UploadStageId | null = 'classifying'
    setIsRegenerating(true)
    setRegenError('')
    setRegenStage('classifying')
    const t1 = setTimeout(() => { currentStage = 'extracting';    setRegenStage('extracting') },    4000)
    const t2 = setTimeout(() => { currentStage = 'prediagnosing'; setRegenStage('prediagnosing') }, 10000)
    const t3 = setTimeout(() => { currentStage = 'saving';        setRegenStage('saving') },        22000)
    try {
      const res = await regenerateStudyAI(testId, eventId, reviewerUserId)
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      if (res.success) {
        setRegenStage('saving')
        await new Promise<void>(r => setTimeout(r, 700))
        router.refresh()
      } else {
        setRegenError(res.error || 'Error al regenerar análisis IA')
      }
    } catch (err) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      const isNetworkError = err instanceof TypeError &&
        (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed'))
      console.error('[FIX-20260516-01][regenerate] Fallo en regeneración IA', {
        operacion: 'regenerate',
        eventId,
        eventTestId: testId,
        etapaVisible: currentStage,
        error: err instanceof Error ? err.message : String(err),
      })
      setRegenError(
        isNetworkError
          ? 'La carga o el procesamiento IA se interrumpieron por un cambio de red. Intenta nuevamente.'
          : 'Error al regenerar análisis IA. Intenta nuevamente.'
      )
    } finally {
      setRegenStage(null)
      setIsRegenerating(false)
    }
  }

  // ARCH-20260518-04: Limpiar archivo activo y análisis vigentes (acción destructiva controlada)
  const handleClearStudy = async (testId: string) => {
    setIsClearingStudy(true)
    setClearStudyError('')
    try {
      const res = await clearEventTestFile(testId, eventId)
      if (res.success) {
        // Actualización optimista: quitar fileUrl, snapshots vigentes, status PENDING
        setLocalTests(prev => prev.map(t => t.id === testId ? {
          ...t,
          fileUrl: null,
          status: 'PENDING' as StudyStatus,
          extractionSnapshot: null,
          aiSnapshot: null,
        } : t))
        router.refresh()
      } else {
        setClearStudyError(res.error || 'Error al limpiar el estudio')
      }
    } catch (err) {
      setClearStudyError(err instanceof Error ? err.message : 'Error al limpiar el estudio')
    } finally {
      setIsClearingStudy(false)
    }
  }

  // --- Vista Resumen (entrada al workspace) ---
  if (!activeTestId) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4">
          <h2 className="text-base font-bold text-slate-800 mb-0.5">Papeleta electrónica</h2>
          <p className="text-sm text-slate-500 mb-3">
            Selecciona un estudio para abrirlo en su vista de trabajo.
          </p>

          {/* ARCH-20260507-07: Trazabilidad operativa ligera derivada de estados existentes */}
          {localTests.length > 0 && (
            <TraceabilidadLigera
              eventId={eventId}
              tests={localTests}
              readonly={readonly}
            />
          )}

          {localTests.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-10">
              No hay estudios registrados en esta papeleta.
            </p>
          )}

          <div className="space-y-2">
            {visibleTests.map((test) => (
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
          {visibleTests.map(t => (
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
          {visibleTests.map((t) => (
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
              uploadStage={uploadStage}
              isRegenerating={isRegenerating}
              regenError={regenError}
              regenStage={regenStage}
              apiUrl={apiUrl}
              somatometryEventTestId={somatometriaTest?.id}
              agudezaEventTestId={agudezaTest?.id}
              groupSampleTaken={groupSampleTaken}
              onStatusChange={handleStatusChange}
              onFileUpload={handleFileUpload}
              onRegenerateAI={handleRegenerateAI}
              isClearingStudy={isClearingStudy}
              clearStudyError={clearStudyError}
              onClearStudy={handleClearStudy}
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

// IMPL-20260516-07: Labels explícitos para siglas clínicas (ARCH-20260516-07)
const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  cad: 'CAD (Cond. Auditivo Der.)',
  cai: 'CAI (Cond. Auditivo Izq.)',
  mtd: 'MTD (Membrana Timpánica Der.)',
  mti: 'MTI (Membrana Timpánica Izq.)',
  faringe: 'Faringe',
}

function formatFieldLabel(key: string): string {
  if (key in FIELD_LABEL_OVERRIDES) return FIELD_LABEL_OVERRIDES[key]
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim() || '—'
  if (Array.isArray(value)) return value.map((v) => formatFieldValue(v)).join(', ')
  // ARCH-20260518-04: evitar '[object Object]' para objetos planos como fallback de cadena
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function ExtractedDataRows({ data, depth = 0 }: { data: Record<string, unknown>; depth?: number }) {
  return (
    <>
      {Object.entries(data).map(([key, value]) => {
        // Objetos planos (no-array): renderizar como sección anidada
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
        // ARCH-20260518-04: arreglos de objetos (parametros, graficas, calidad…)
        // Se renderizan como sub-secciones indexadas en lugar de colapsar a '[object Object]'
        if (
          Array.isArray(value) &&
          value.some((v) => v !== null && typeof v === 'object' && !Array.isArray(v))
        ) {
          return (
            <div key={key} className={depth > 0 ? 'pl-3' : ''}>
              <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider py-1.5 pt-2">
                {formatFieldLabel(key)}
              </p>
              {value.map((item, idx) => (
                <div key={idx} className="pl-3 border-l-2 border-sky-100 mb-1.5">
                  {item !== null && typeof item === 'object' && !Array.isArray(item) ? (
                    <ExtractedDataRows data={item as Record<string, unknown>} depth={depth + 1} />
                  ) : (
                    <div className="flex justify-between items-start gap-4 py-1">
                      <span className="text-xs text-slate-800 font-medium">{formatFieldValue(item)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        }
        // Valor primitivo o arreglo simple
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

function _CapturedValuesPanel({
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
void _CapturedValuesPanel

// --- IMPL-20260516-04: Panel de progreso por etapas del pipeline IA ---
// @id IMPL-20260516-04
// @backup context/checkpoints/CHK_IMPL-20260516-04.md

function UploadProgressPanel({
  stage,
  isRegen = false,
}: {
  stage: UploadStageId
  isRegen?: boolean
}) {
  const stages = isRegen
    ? AI_PIPELINE_STAGES.filter(s => s.id !== 'uploading')
    : AI_PIPELINE_STAGES
  const visibleIdx = stages.findIndex(s => s.id === stage)
  const current = stages[visibleIdx]
  const pct = current?.pct ?? (isRegen ? 25 : 10)

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
      {/* Cabecera */}
      <div className="flex items-center gap-2">
        <span className="text-base">⚙️</span>
        <div>
          <p className="text-sm font-bold text-teal-800">
            {isRegen ? 'Regenerando análisis IA' : 'Procesando estudio con IA'}
          </p>
          <p className="text-xs text-teal-600">
            {isRegen
              ? 'Reanalizando el archivo ya cargado — sin necesidad de volver a subir'
              : 'Upload y pipeline IA en curso — esto puede tomar entre 15 y 45 s'}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-teal-700 font-semibold truncate pr-2">
            {current?.label ?? 'Iniciando...'}
          </span>
          <span className="text-xs font-bold text-teal-700 tabular-nums shrink-0">{pct}%</span>
        </div>
        <div className="h-2 bg-teal-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stepper de etapas */}
      <div className="space-y-1.5 pt-0.5">
        {stages.map((s, idx) => {
          const isDone = idx < visibleIdx
          const isActive = s.id === stage
          return (
            <div
              key={s.id}
              className={`flex items-center gap-2 text-xs transition-colors ${
                isActive ? 'text-teal-800 font-semibold' :
                isDone   ? 'text-teal-500'               :
                           'text-slate-400'
              }`}
            >
              <span className="shrink-0 w-4 text-center">
                {isDone ? '✓' : isActive ? '▶' : '·'}
              </span>
              <span>{s.label}</span>
              {isActive && <span className="animate-pulse text-teal-500 ml-1">●●●</span>}
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-teal-500 italic border-t border-teal-100 pt-2">
        El progreso mostrado es orientativo, no telemetría exacta del backend.
      </p>
    </div>
  )
}

// --- Sub-componente: Cabecera persistente del workspace ---

function WorkerHeader({
  completedCount,
  totalCount,
  onBack,
}: {
  completedCount: number
  totalCount: number
  onBack?: () => void
}) {
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/80">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="text-teal-600 hover:text-teal-800 text-xs font-semibold shrink-0"
            >
              ← Volver a estudios
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-500">
            {completedCount}/{totalCount} completados
          </span>
          <div className="h-1.5 w-14 bg-slate-200 rounded-full overflow-hidden">
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
  uploadStage,
  isRegenerating,
  regenError,
  regenStage,
  apiUrl,
  somatometryEventTestId,
  agudezaEventTestId,
  groupSampleTaken,
  onStatusChange,
  onFileUpload,
  onRegenerateAI,
  isClearingStudy,
  clearStudyError,
  onClearStudy,
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
  uploadStage: UploadStageId | null
  isRegenerating: boolean
  regenError: string
  regenStage: UploadStageId | null
  apiUrl: string
  somatometryEventTestId: string | undefined
  agudezaEventTestId: string | undefined
  /** ARCH-20260507-06: Indica si un estudio hermano del mismo grupo ya tiene muestra tomada */
  groupSampleTaken: boolean
  onStatusChange: (id: string, status: StudyStatus) => void
  onFileUpload: (id: string, file: File) => void
  onRegenerateAI: (id: string) => void
  /** ARCH-20260518-04: limpieza de archivo y análisis vigentes */
  isClearingStudy: boolean
  clearStudyError: string
  onClearStudy: (id: string) => void
  onExamenMedicoStatusChange: (status: string) => void
}) {
  // ARCH-20260518-04: confirmación local antes de ejecutar la limpieza destructiva
  const [isClearConfirming, setIsClearConfirming] = useState(false)

  const isMedico = isExamenMedico(test.testNameSnapshot)
  const isSomato = isSomatometria(test.testNameSnapshot)
  const isAgudeza = isAgudezaVisual(test.testNameSnapshot)
  const isLab = isLabTest(test)
  // IMPL-20260326-18: Elegibilidad y type canónico desde helper central
  const aiLabel = getAIWorkflowLabel(test)
  const isAIEligible = isAIEligibleEventTest(test)
  // ARCH-20260507-06: sampleTracked incluye muestra tomada por grupo compartido (hermano)
  const sampleTracked = isLab && (
    ['SAMPLE_TAKEN', 'RESULT_REGISTERED', 'COMPLETED'].includes(test.status) || groupSampleTaken
  )
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
            somatometryEventTestId={somatometryEventTestId}
            agudezaEventTestId={agudezaEventTestId}
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
                    {sampleTracked ? '✓ Pendiente de resultado de prueba de laboratorio' : 'Muestra pendiente'}
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

            {/* Dropzone de upload / Panel de progreso IA — IMPL-20260516-04 */}
            {!readonly && (
              isUploading && uploadStage ? (
                <UploadProgressPanel stage={uploadStage} />
              ) : (
                <div className="border-2 border-dashed rounded-xl p-4 text-center transition-colors border-slate-200 hover:border-teal-300 hover:bg-slate-50">
                  <label className="cursor-pointer block">
                    <span className="text-2xl block mb-1">📎</span>
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
                  {uploadError && (
                    <p className="text-xs text-red-500 mt-2">{uploadError}</p>
                  )}
                  {(test.fileUrl || test.extractionSnapshot || test.aiSnapshot) && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                      {!isClearConfirming ? (
                        <button
                          type="button"
                          onClick={() => setIsClearConfirming(true)}
                          disabled={isClearingStudy || isUploading}
                          className="text-xs font-semibold text-red-700 hover:text-red-800 disabled:opacity-50"
                        >
                          Eliminar archivo y limpiar análisis
                        </button>
                      ) : (
                        <>
                          <p className="text-xs text-red-700">
                            Esta acción deja el estudio limpio para recaptura. El historial técnico previo se conserva para auditoría.
                          </p>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => onClearStudy(test.id)}
                              disabled={isClearingStudy}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50"
                            >
                              {isClearingStudy ? 'Limpiando...' : 'Confirmar limpieza'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsClearConfirming(false)}
                              disabled={isClearingStudy}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </>
                      )}
                      {clearStudyError && (
                        <p className="text-xs text-red-500">{clearStudyError}</p>
                      )}
                    </div>
                  )}
                </div>
              )
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
                  isRegenerating && regenStage ? (
                    <UploadProgressPanel stage={regenStage} isRegen />
                  ) : (
                    <button
                      onClick={() => onRegenerateAI(test.id)}
                      disabled={isRegenerating}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {isRegenerating ? '⏳ Generando IA...' : '🤖 Generar IA ahora'}
                    </button>
                  )
                )}
              </div>
            )}

            {/* IMPL-20260518-13: Renderer clínico estructurado — reemplaza panel azul genérico */}
            {/*
              FIX-20260812-19: Extracción clínica vive en la COLUMNA IZQUIERDA
              del grid (junto con dropzone, trazabilidad, acciones). El panel de
              Prediagnóstico IA vive en la COLUMNA DERECHA, debajo del archivo
              vinculado (StudyDocumentViewer). Layout vertical por columna,
              no side-by-side.
            */}
            {test.extractionSnapshot && (
              <ClinicalExtractionRenderer
                extractedData={test.extractionSnapshot.extractedData as Record<string, unknown> | null}
                missingFields={test.extractionSnapshot.missingFields as string[] | null}
                version={test.extractionSnapshot.version}
                studyType={getCanonicalAIStudyType(test)}
                presentationSchema={getPersistedPresentationSchema(test)}
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

          {/* ===== COLUMNA DERECHA: EVIDENCIA DOCUMENTAL + Prediagnóstico IA ===== */}
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

            {/* Panel de Prediagnóstico IA — debajo del archivo vinculado, en la columna derecha.
                FIX-20260812-19: movido desde la columna izquierda para alinear
                con el archivo vinculado (mismo eje visual: evidencia documental
                arriba, análisis IA abajo). El médico ve primero el PDF/PNG
                original, luego la sugerencia IA, luego decide. */}
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
