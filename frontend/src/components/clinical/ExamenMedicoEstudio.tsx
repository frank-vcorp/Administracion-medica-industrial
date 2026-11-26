/**
 * @fileoverview Formulario real del estudio "Examen Médico" dentro de la Papeleta de Estudios.
 * Implementa 4 outer-tabs: Somatometría, Signos Vitales, Agudeza Visual y Examen Médico.
 * Las outer-tabs 1-3 son prerrequisito para acceder a la outer-tab 4 (Examen Médico),
 * que contiene inner-tabs: Antecedentes (incl. gineco/vacunas), Exploración Física e Impresión/Aptitud.
 * IMPL-20260809-02 (ARCH-20260809-01 v2): 'Antecedentes' es la PRIMERA inner-tab dentro
 * de "Examen Médico" (snapshot por cita en `physicalExamData.antecedentes_captured`,
 * persistido vía `saveExamenMedicoPapeleta`).
 * @id IMPL-20260809-02
 * @spec ARCH-20260809-01 (v2)
 * @intervention ARCH-20260506-06, ARCH-20260325-05, ARCH-20260326-07, ARCH-20260326-10
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  clinicalCaptureReadonlyBannerText,
  resolveClinicalStudyReadonly,
} from '@/lib/clinical/papeleta-readonly'
import { saveExamenMedicoPapeleta, updateSomatometria, updateAgudezaVisual } from "@/actions/medical-exam.actions"
import { getCatalogEnumDisplayLabel } from '@/lib/clinical/enum-display-labels'
import { getCurrentDoctorProfile } from "@/actions/doctor-profile.actions"
import { updateEventTestStatus } from "@/actions/event-test.actions"
import {
  Activity,
  Building2,
  Eye,
  FileCheck,
  HeartPulse,
  Scale,
  Stethoscope,
  UtensilsCrossed,
} from 'lucide-react'
// IMPL-20260809-02 (ARCH-20260809-01 v2): "Antecedentes" ya no es outer-tab, ahora es
// PRIMERA sub-pestaña dentro de "Examen Médico" (componente controlado).
import { AntecedentesCaptura } from "@/components/clinical/AntecedentesCaptura"
import { ClinicalTextarea } from "@/components/clinical/ClinicalFreeTextControls"
import { VitalSignsPrediagnosisPanel } from "@/components/clinical/VitalSignsPrediagnosisPanel"
// IMPL-20260817-01-C1 (ARCH-20260817-01 corte 1): catálogos ZIN para los
// 8 campos de visión + 3 pruebas complementarias en pestaña 3 "Agudeza
// Visual". Ver SPEC §4.1.
// IMPL-20260817-01-C2 (ARCH-20260817-01 corte 2): catálogos ZIN para 13
// combos de Exploración Física + 17 plantillas prellenadas + estado
// nutricional/salud bucal en Resumen Clínico. Ver SPEC §4.2, §4.3.
import {
  REFLEJOS_VALUES,
  CAMPIMETRIA_VALUES,
  TEST_ISHIHARA_VALUES,
  ARCO_MOVILIDAD_VALUES,
  TONO_MUSCULAR_VALUES,
  COORDINACION_VALUES,
  TEST_ADAM_LATERAL_VALUES,
  normalizeTestAdamEstado,
  QUISTE_SINOVIAL_CAPTURA_VALUES,
  normalizeQuisteEstado,
  TEST_ROMBERG_VALUES,
  SIGNO_BRAGARD_VALUES,
  SIGNO_TINEL_VALUES,
  PRUEBA_LATERALIDAD_VALUES,
  CIRCULACION_VENOSA_VALUES,
  SALUD_BUCAL_VALUES,
  ESTADO_NUTRICIONAL_VALUES,
  // IMPL-20260817-08-C7 (ARCH-20260817-02 DA-1/DA-6): 5 valores canónicos PDF
  // para aptitud + enums cortos para agudeza/presión.
  APTITUD_VALUES,
  AGUDEZA_VISUAL_RESUMEN_VALUES,
  PRESION_ARTERIAL_RESUMEN_VALUES,
  applyExploracionFisicaDefaults,
  COLUMNA_VERTEBRAL_DESVIADA,
  PLANTILLAS_EF,
} from "@/schemas/clinical/exam.schema"
// IMPL-20260817-09-C4 (ARCH-20260817-02 corte 2 DA-7): helper de
// auto-poblamiento para las recomendaciones del dictamen (catalogo
// hallazgo → recomendacion + edicion manual).
import { buildRecommendationsFromExam } from "@/lib/clinical/recommendations"
import {
  buildImpresionDiagnosticaFromAntecedentesYExamen,
  isImpresionDiagnosticaPlaceholder,
  examForHallazgosFromForm,
} from '@/lib/clinical/impresion-diagnostica'
import {
  deriveEstadoNutricionalFromSoma,
  derivePresionArterialResumenFromVitals,
  isResumenFieldManualOverride,
  isSaludBucalManualOverride,
  syncBocaEstadoToSaludBucal,
} from '@/lib/clinical/resumen-clinico-sync'
import { formatMedicoNombreYCedula } from "@/lib/clinical/medico-display"
import {
  medicoLineFromProfile,
  prepareExamenMedicoPayloadForSave,
} from '@/lib/clinical/examen-medico-payload'
import {
  examFieldRingClass,
  type ExamenMedicoSaveNavigation,
} from '@/lib/clinical/examen-medico-save-errors'
import { ClinicalAutosaveIndicator } from "@/components/clinical/ClinicalAutosaveIndicator"
import { useExamenMedicoAutosave } from "@/lib/hooks/useExamenMedicoAutosave"
import { mapMedicalExamActionFailure } from "@/lib/medical-exam-action-errors"
import { splitUserFacingMessageLines } from "@/lib/user-facing-error"
import {
  deriveAgudezaVisualResumen,
  VISION_SNELLEN_NO_APLICA,
  visionFieldSelectOptions,
} from "@/lib/clinical/agudeza-visual"
import { FlowserveExtension } from "@/components/clinical/examen-medico/FlowserveExtension"
import { SodexoExtension } from "@/components/clinical/examen-medico/SodexoExtension"
import {
  EXAM_CARD_CLASS,
  EXAM_CARD_TITLE_CLASS,
  EXAM_INPUT_CLASS,
  EXAM_LABEL_CLASS,
  EXAM_NUMERIC_INPUT_CLASS,
  EXAM_TEXTAREA_CLASS,
  ExamSectionFooter,
  ExamSectionHeader,
} from '@/components/clinical/examen-medico/ExamSectionLayout'
import {
  StudyCaptureFieldLabel,
  StudyCaptureMissingBanner,
} from '@/components/clinical/studies/StudyCaptureUi'
import {
  useStudyLeaveGuard,
  type StudyLeaveGuardFn,
} from '@/components/clinical/studies/useStudyLeaveGuard'
import {
  formatStudyMissingFieldsSpanish,
  isExamenMedicoRequiredField,
  studyValidationToFieldErrors,
  validateExamenMedicoActiveSection,
  validateExamenMedicoForClinicalClose,
  validateExamenMedicoTab,
  type ExamenMedicoTabId,
  type ExamenMedicoValidationInput,
} from '@/lib/clinical/examen-medico-required-fields'
import {
  isDefaultExamenMedicoVariant,
  resolveExamenMedicoVariant,
  examenMedicoVariantLabel,
  type ExamenMedicoVariant,
} from "@/lib/clinical/examen-medico-variant"
import { EXAMEN_CAPTURE_CLOSED_KEY } from "@/lib/clinical/examen-medico-capture"
import {
  computeBmi,
  complexionFromImc,
  formatTallaMetersForDisplay,
  formatTallaMetersWhileTyping,
} from '@/lib/clinical/talla-meters'
import {
  antecedentesSnapshotComparable,
  mergeExamAntecedentesPrefill,
} from '@/lib/clinical/prefill-portal-merge'
import { loadSodexoExtensionFromStorage } from '@/lib/sodexo-extension-validation'
import {
  examenMedicoNavSectionFromTabs,
  parseExamenMedicoNavSection,
  readPapeletaQueryParam,
  replacePapeletaQuery,
} from '@/lib/clinical/papeleta-navigation'
import {
  emptyFlowserveExtension,
  FlowserveExtensionSchema,
  type FlowserveExtensionData,
  type SodexoExtensionData,
} from "@/schemas/clinical/examen-medico-variant.schema"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ExamData = {
  physicalExamData?: Record<string, unknown> | null
  somatometryData?: Record<string, unknown> | null
  eyeAcuityData?: Record<string, unknown> | null
} | null

/** Pestañas externas de Examen Médico — ARCH-20260506-06 (4 valores, IMPL-20260809-02
 *  revirtió la 5ª outer-tab 'antecedentes' que IMPL-20260809-01 había añadido). */
type OuterTab = 'somatometria' | 'signos_vitales' | 'agudeza_visual' | 'examen_medico'
/** Sub-pestañas del Examen Médico clínico (pestaña 4) — IMPL-20260809-02: 'antecedentes'
 *  se añade como PRIMERA inner-tab dentro de "Examen Médico" (sub-pestaña, no outer-tab). */
type InnerTab = 'antecedentes' | 'exploracion' | 'extension' | 'impresion'

const VISUAL_FIELDS_NAMES = [
  'vision_lejana_od', 'vision_lejana_oi',
  'vision_cercana_od', 'vision_cercana_oi',
  'lejana_corregida_od', 'lejana_corregida_oi',
  'cercana_corregida_od', 'cercana_corregida_oi',
]

/**
 * IMPL-FEATURE-20260825-03 ronda 3 (IMPLEMENTATION_DEFECT):
 * URL del PDF consolidado de Examen Médico. Pura + testeable sin DOM.
 * Mantener como helper estable: el contrato del endpoint
 * (`/api/pdf/examen-medico/[eventId]`) NO cambia con este fix.
 */
export function examenMedicoPdfUrl(eventId: string): string {
  return `/api/pdf/examen-medico/${eventId}`
}

/** Formulario contestado (preguntas y respuestas), aparte del resumen. */
export function examenMedicoFormularioPdfUrl(eventId: string): string {
  return `/api/pdf/examen-medico/${eventId}?forma=1`
}

/** PDF oficial Sodexo REG-SO-01 (solo variante Sodexo; no es el AMI clínico). */
export function examenMedicoSodexoPdfUrl(eventId: string): string {
  return `/api/pdf/examen-medico-sodexo/${eventId}`
}

/** Vista previa Sodexo REG-SO-01 (GET legacy; preferir POST con extensión en pantalla). */
export function examenMedicoSodexoPreviewPdfUrl(eventId: string): string {
  return `/api/pdf/examen-medico-sodexo/${eventId}?preview=1`
}

/** API Sodexo REG-SO-01 — POST con `{ extension }` para vista previa en extensión. */
export function examenMedicoSodexoPreviewApiUrl(eventId: string): string {
  return `/api/pdf/examen-medico-sodexo/${eventId}`
}

/**
 * IMPL-FEATURE-20260825-03 ronda 6 (FND-20260825-23):
 * URL del expediente orientada a la vista de Validación (paso donde
 * el médico firma/emite el dictamen general).
 *
 * Tras pulsar "Completar Examen Médico", `saveExamenMedicoPapeleta`
 * cambia `MedicalEvent.status` a `VALIDATING`. Sin embargo, el cálculo
 * de `activeView` en `event-page-data.ts` cae al valor actual de la
 * URL (`?view=IN_PROGRESS` o `?view=CHECKED_IN`) cuando esa vista
 * está por detrás de `currentStep`, y nunca salta a `VALIDATING`.
 * Resultado: el usuario ve "sólo lectura" y no aparece el panel
 * "Firmar y Emitir Dictamen".
 *
 * La solución es navegar explícitamente a `?view=VALIDATING` después
 * de un Completar exitoso — así la URL y el render condicional
 * (`activeView === event.status`) coinciden y `EventFlowController`
 * muestra el flujo de firma.
 *
 * Pura + testeable sin DOM. Vive aquí para que `handleSave` y
 * cualquier caller posterior (bot, atajo, deep-link) usen la misma
 * URL canónica.
 */
export function navigateToValidatingView(eventId: string): string {
  return `/events/${eventId}?view=VALIDATING`
}

/**
 * IMPL-FEATURE-20260825-03 ronda 4 (DEC-20260825-19 / BR-20260825-20):
 * Decide si el CTA de descarga del PDF consolidado debe mostrarse.
 *
 * El reporte de examen médico (aptitud) se emite al cerrar la captura,
 * antes del dictamen general. Visible si hay aptitud no vacía.
 * El ZIP de cierre sigue exigiendo el dictamen firmado.
 */
export function shouldShowExamenMedicoPdfCta(
  aptitud: string | null | undefined,
  _hasMedicalVerdict: boolean | null | undefined = false
): boolean {
  return typeof aptitud === 'string' && aptitud.trim().length > 0
}

/**
 * IMPL-FEATURE-20260825-04: URL del ZIP consolidado de cierre clínico.
 * Pura + testeable sin DOM. El endpoint
 * (`/api/zip/clinical-closure/[eventId]`) aplica los mismos gates
 * (sesión + rol clínico + aptitud) que el PDF individual.
 */
export function clinicalClosureZipUrl(eventId: string): string {
  return `/api/zip/clinical-closure/${eventId}`
}

/**
 * IMPL-FEATURE-20260825-04: el CTA del ZIP comparte el gate de aptitud
 * + verdict del PDF individual (mismo evento, misma decisión médica).
 * Mantener la regla única evita inconsistencias visuales y previene
 * 409/404/410 en el endpoint.
 *
 * IMPL-FEATURE-20260825-03 ronda 4 (DEC-20260825-19 / BR-20260825-20):
 * incluye el gate de `hasMedicalVerdict` — el ZIP sólo se habilita con
 * verdict emitido (paridad con `shouldShowExamenMedicoPdfCta`).
 */
export function shouldShowClinicalClosureZipCta(
  aptitud: string | null | undefined,
  hasMedicalVerdict: boolean | null | undefined = false
): boolean {
  return (
    shouldShowExamenMedicoPdfCta(aptitud) && hasMedicalVerdict === true
  )
}

interface ExamenMedicoEstudioProps {
  eventId: string
  eventTestId: string
  examData: ExamData
  prefilledData?: Record<string, unknown> | null
  longitudinalData?: Record<string, unknown> | null
  readonly?: boolean
  /** Callback para actualizar estado local en el workspace padre */
  onStatusChange?: (status: string, options?: { skipRefresh?: boolean }) => void
  /**
   * IMPL-FEATURE-20260825-03 ronda 4 (DEC-20260825-19 / BR-20260825-20):
   * `true` si ya existe `MedicalVerdict` emitido para el Event. Cuando
   * es `false`, el CTA de descarga PDF NO se muestra aunque haya
   * aptitud persistida — el dictamen aún no fue firmado por el médico
   * y la ruta devolvería 404 (regla §R6 / BR-20260825-20). Por defecto
   * `false` (defensa en profundidad: sin prop, no se muestra).
   */
  hasMedicalVerdict?: boolean
  /** ID del trabajador para CTA hacia Historial Clínico — ARCH-20260326-06 */
  workerId?: string
  /** ID del EventTest de Somatometría para actualizar su estado al guardar — ARCH-20260506-06 */
  somatometryEventTestId?: string
  /** ID del EventTest de Agudeza Visual para actualizar su estado al guardar — ARCH-20260506-06 */
  agudezaEventTestId?: string
  /** Nombre snapshot del estudio (ej. Examen Médico Flowserve). */
  testNameSnapshot?: string
  /** Papeleta: una barra de pestañas (Somatometría → Agudeza → Antecedentes → …). */
  papeletaLayout?: boolean
  /** Papeleta: pestaña visible (outer o inner) para sincronizar UI del workspace. */
  onPapeletaActiveSectionChange?: (section: OuterTab | InnerTab) => void
  /** Bloquea cambio de estudio en papeleta si faltan obligatorios en la pestaña activa. */
  registerLeaveGuard?: (fn: StudyLeaveGuardFn | null) => void
}

// ─── Constantes de formularios ────────────────────────────────────────────────

const VISUAL_FIELDS: { name: string; label: string }[] = [
  { name: 'vision_lejana_od', label: 'Visión Lejana OD' },
  { name: 'vision_lejana_oi', label: 'Visión Lejana OI' },
  { name: 'vision_cercana_od', label: 'Visión Cercana OD' },
  { name: 'vision_cercana_oi', label: 'Visión Cercana OI' },
  { name: 'lejana_corregida_od', label: 'Lejana Corregida OD' },
  { name: 'lejana_corregida_oi', label: 'Lejana Corregida OI' },
  { name: 'cercana_corregida_od', label: 'Cercana Corregida OD' },
  { name: 'cercana_corregida_oi', label: 'Cercana Corregida OI' },
]

const NO_APLICA = VISION_SNELLEN_NO_APLICA
const RESUMEN_CLINICO_FIELDS: [string, string][] = [
  ['estado_nutricional', 'Estado Nutricional'],
  ['salud_bucal', 'Salud Bucal'],
  ['agudeza_visual_resumen', 'Agudeza Visual'],
  ['presion_arterial_resumen', 'Presión Arterial'],
]

// ─── Campos de Exploración Física (de ExploracionFisicaSchema) ───────────────
// IMPL-20260817-01-C2: cada campo declara su `kind` para el render correcto.
// - `select` → combo con valores ZIN (13 campos).
// - `plantilla` → input text prellenado con PLANTILLAS_EF[name].
// - `text` → input text libre con default canónico (4 campos).
type ExplKind = 'select' | 'plantilla' | 'text'

type ExplField = {
  name: string
  label: string
  kind: ExplKind
  /** Catálogo ZIN cuando kind === 'select'. */
  values?: readonly string[]
}

const EXPLORACION_FIELDS: ExplField[] = [
  { name: "neurologico", label: "Neurológico", kind: "plantilla" },
  { name: "cabeza", label: "Cabeza", kind: "plantilla" },
  { name: "piel_y_faneras", label: "Piel y Faneras", kind: "plantilla" },
  { name: "oidos_cad", label: "Oídos CAD", kind: "plantilla" },
  { name: "oidos_cai", label: "Oídos CAI", kind: "plantilla" },
  { name: "ojos", label: "Ojos", kind: "plantilla" },
  { name: "boca_estado", label: "Salud bucal", kind: "select", values: SALUD_BUCAL_VALUES },
  { name: "boca_alineacion", label: "Cavidad Bucal", kind: "text" },
  { name: "nariz", label: "Nariz", kind: "plantilla" },
  { name: "faringe", label: "Faringe", kind: "plantilla" },
  { name: "cuello", label: "Cuello", kind: "plantilla" },
  { name: "torax", label: "Tórax", kind: "plantilla" },
  { name: "corazon", label: "Corazón", kind: "plantilla" },
  { name: "campos_pulmonares", label: "Campos Pulmonares", kind: "plantilla" },
  { name: "abdomen", label: "Abdomen", kind: "plantilla" },
  { name: "genitourinario", label: "Genitourinario", kind: "plantilla" },
  { name: "columna_vertebral", label: "Columna Vertebral", kind: "plantilla" },
  { name: "ms_superiores", label: "MMSS", kind: "plantilla" },
  { name: "fuerza_muscular_daniels_sup", label: "Fuerza (Daniels Sup)", kind: "text" },
  { name: "ms_inferiores", label: "MMII", kind: "plantilla" },
  { name: "fuerza_muscular_daniels_inf", label: "Fuerza (Daniels Inf)", kind: "text" },
  { name: "circulacion_venosa", label: "Circulación Venosa", kind: "select", values: CIRCULACION_VENOSA_VALUES },
  { name: "arco_de_movilidad", label: "Arco de Movilidad", kind: "select", values: ARCO_MOVILIDAD_VALUES },
  { name: "tono_muscular", label: "Tono Muscular", kind: "select", values: TONO_MUSCULAR_VALUES },
  { name: "coordinacion", label: "Coordinación", kind: "select", values: COORDINACION_VALUES },
  { name: "test_romberg", label: "Test Romberg", kind: "select", values: TEST_ROMBERG_VALUES },
  { name: "signo_bragard", label: "Signo Bragard", kind: "select", values: SIGNO_BRAGARD_VALUES },
  { name: "prueba_finkelstein", label: "Prueba Finkelstein", kind: "select", values: PRUEBA_LATERALIDAD_VALUES },
  { name: "signo_tinel", label: "Signo Tinel", kind: "select", values: SIGNO_TINEL_VALUES },
  { name: "prueba_phanel", label: "Prueba Phanel", kind: "select", values: PRUEBA_LATERALIDAD_VALUES },
  { name: "prueba_lasegue", label: "Prueba Lasegue", kind: "select", values: PRUEBA_LATERALIDAD_VALUES },
  { name: "presencia_quiste_sinovial", label: "Quiste Sinovial", kind: "select", values: QUISTE_SINOVIAL_CAPTURA_VALUES },
]

// IMPL-20260817-08-C7 (ARCH-20260817-02 DA-1): 5 valores canónicos del PDF de
// referencia (`REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf`) + PENDIENTE
// operativa. El literal largo "NO CUMPLE CON LOS CRITERIOS..." se renderiza
// con `break-words` para que no rompa el layout del botón en grid 2-col.
// Legacy `'NO APTO'` ya NO aparece como opción de UI; el schema Zod lo sigue
// aceptando vía DA-1 (registros previos sin migración).
type AptitudOption = {
  value: (typeof APTITUD_VALUES)[number]
  label: string
  color: string
}

const APTITUD_OPTIONS: AptitudOption[] = [
  { value: 'APTO', label: '✅ Apto', color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  { value: 'APTO CONDICIONADO', label: '🟡 Apto Condicionado', color: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
  { value: 'APTO CON RESTRICCIONES', label: '⚠️ Apto con Restricciones', color: 'border-amber-400 bg-amber-50 text-amber-800' },
  { value: 'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO', label: '❌ No Cumple con los Criterios', color: 'border-red-400 bg-red-50 text-red-800' },
  { value: 'PENDIENTE DE RESULTADOS', label: '⏳ Pendiente de Resultados', color: 'border-slate-300 bg-slate-50 text-slate-700' },
]

const SOMA_ONLY_KEYS = ['peso_kg', 'talla_m'] as const
const VITALS_ONLY_KEYS = [
  'ta_sistolica',
  'ta_diastolica',
  'fc_min',
  'fr_min',
  'temperatura',
  'saturacion_oxigeno',
] as const

function pickExamStringKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const k of keys) {
    const val = source[k]
    if (val !== undefined && val !== null) {
      result[k] = String(val)
    }
  }
  return result
}

const ANTECEDENTES_PROVENANCE_BADGE: Record<
  string,
  { label: string; color: string }
> = {
  captured: { label: '✏️ Capturado en consulta', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  portal: { label: '📋 Del portal', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  longitudinal: { label: '📋 Historial maestro', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  mixed: { label: '📋 Mixto (portal + consulta)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  none: { label: '🆕 Sin datos previos', color: 'bg-white text-slate-600 border-slate-200' },
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ExamenMedicoEstudio({
  eventId,
  eventTestId,
  examData,
  prefilledData,
  longitudinalData,
  readonly: papeletaReadonly = false,
  onStatusChange,
  workerId,
  somatometryEventTestId,
  agudezaEventTestId,
  hasMedicalVerdict = false,
  testNameSnapshot = 'Examen Médico General',
  papeletaLayout = false,
  onPapeletaActiveSectionChange,
  registerLeaveGuard,
}: ExamenMedicoEstudioProps) {
  const searchParams = useSearchParams()
  const emSectionRaw = readPapeletaQueryParam('emSection', searchParams.get('emSection'))
  const emNavFromUrl = parseExamenMedicoNavSection(emSectionRaw)
  const physicalExamData = (examData?.physicalExamData ?? {}) as Record<string, unknown>
  const examVariant: ExamenMedicoVariant = resolveExamenMedicoVariant(
    testNameSnapshot,
    physicalExamData.exam_variant as string | undefined,
  )
  const variantExtensionsStored =
    (physicalExamData.variant_extensions as Record<string, unknown> | undefined) ?? {}
  const initSomatometryData = useMemo(
    () => (examData?.somatometryData ?? {}) as Record<string, unknown>,
    [examData?.somatometryData],
  )
  const initEyeAcuityData = useMemo(
    () => (examData?.eyeAcuityData ?? {}) as Record<string, unknown>,
    [examData?.eyeAcuityData],
  )

  // ── Estado Examen Médico (pestaña 4 — existente) ──────────────────────────
  // IMPL-20260809-01 rework (QA-20260809-01 I-1): excluir del `form` plano
  // cualquier clave cuyo valor persistido sea un objeto/array (no primitivo),
  // en concreto `antecedentes_captured` (snapshot por cita) y `modulo1`
  // (sub-objeto Módulo 1). Sin este filtro, `String({...})` produce
  // `"[object Object]"` y revienta la validación Zod en `ExamenMedicoCompletoSchema`.
  const { data: session } = useSession()
  const initialResumenSync = useMemo(() => {
    const isPrimitive = (v: unknown) =>
      v === null || v === undefined || typeof v === 'string' ||
      typeof v === 'number' || typeof v === 'boolean'
    const base = applyExploracionFisicaDefaults(
      Object.fromEntries(
        Object.entries(physicalExamData)
          .filter(([, v]) => isPrimitive(v))
          .map(([k, v]) => [k, String(v ?? '')]),
      ),
    )

    const persistedSaludBucal = String(physicalExamData.salud_bucal ?? '').trim()
    const saludBucalManual = isSaludBucalManualOverride(
      base.boca_estado,
      persistedSaludBucal,
    )
    if (!saludBucalManual && base.boca_estado) {
      base.salud_bucal = base.boca_estado
    }

    const derivedNutri = deriveEstadoNutricionalFromSoma(
      initSomatometryData.peso_kg,
      initSomatometryData.talla_m,
    )
    const persistedNutri = String(physicalExamData.estado_nutricional ?? '').trim()
    const estadoNutricionalManual = isResumenFieldManualOverride(
      derivedNutri,
      persistedNutri,
    )
    if (!persistedNutri && derivedNutri) {
      base.estado_nutricional = derivedNutri
    }

    const derivedAgudeza = deriveAgudezaVisualResumen(
      initEyeAcuityData.vision_lejana_od as string | undefined,
      initEyeAcuityData.vision_lejana_oi as string | undefined,
    )
    const persistedAgudeza = String(physicalExamData.agudeza_visual_resumen ?? '').trim()
    const agudezaVisualManual = isResumenFieldManualOverride(
      derivedAgudeza,
      persistedAgudeza,
    )
    if (!persistedAgudeza && derivedAgudeza) {
      base.agudeza_visual_resumen = derivedAgudeza
    }

    const derivedPresion = derivePresionArterialResumenFromVitals(
      initSomatometryData.ta_sistolica,
      initSomatometryData.ta_diastolica,
    )
    const persistedPresion = String(physicalExamData.presion_arterial_resumen ?? '').trim()
    const presionArterialManual = isResumenFieldManualOverride(
      derivedPresion,
      persistedPresion,
    )
    if (!persistedPresion && derivedPresion) {
      base.presion_arterial_resumen = derivedPresion
    }

    const initialAutoRecomendaciones = buildRecommendationsFromExam(
      examForHallazgosFromForm(base),
    )

    return {
      initialForm: base,
      saludBucalManual,
      estadoNutricionalManual,
      agudezaVisualManual,
      presionArterialManual,
      initialAutoRecomendaciones,
    }
    // Solo inicializar una vez al montar el estudio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [form, setForm] = useState<Record<string, string>>(
    () => initialResumenSync.initialForm,
  )
  const [aptitud, setAptitud] = useState<string>(
    (physicalExamData.aptitud as string) ?? ''
  )
  // IMPL-20260817-09-C4 (ARCH-20260817-02 DA-7): recomendaciones
  // auto-pobladas desde hallazgos. Lazy init desde el snapshot persistido;
  // el medico puede editar/sobrescribir libremente. Boton "Regenerar
  // desde hallazgos" para volver al auto-poblado en cualquier momento.
  const [recomendaciones, setRecomendaciones] = useState<string>(() => {
    const persisted = physicalExamData.recomendaciones_clinicas
    if (typeof persisted === 'string' && persisted.trim()) return persisted
    return initialResumenSync.initialAutoRecomendaciones
  })
  const saludBucalManualRef = useRef(initialResumenSync.saludBucalManual)
  const estadoNutricionalManualRef = useRef(initialResumenSync.estadoNutricionalManual)
  const agudezaVisualManualRef = useRef(initialResumenSync.agudezaVisualManual)
  const presionArterialManualRef = useRef(initialResumenSync.presionArterialManual)
  const recomendacionesManualRef = useRef((() => {
    const persisted =
      typeof physicalExamData.recomendaciones_clinicas === 'string'
        ? physicalExamData.recomendaciones_clinicas.trim()
        : ''
    return (
      persisted.length > 0 &&
      persisted !== initialResumenSync.initialAutoRecomendaciones.trim()
    )
  })())
  const lastAutoRecomendacionesRef = useRef(
    initialResumenSync.initialAutoRecomendaciones.trim(),
  )
  const [captureClosed, setCaptureClosed] = useState<boolean>(
    physicalExamData[EXAMEN_CAPTURE_CLOSED_KEY] === true,
  )
  const formReadonly = useMemo(
    () =>
      resolveClinicalStudyReadonly(papeletaReadonly, captureClosed, session?.user?.role),
    [papeletaReadonly, captureClosed, session?.user?.role],
  )
  const readonlyBanner = clinicalCaptureReadonlyBannerText(
    formReadonly,
    captureClosed,
    session?.user?.role,
  )
  // IMPL-20260809-02: default 'antecedentes' (era 'declarativa' en v1) — la primera
  // sub-pestaña visible al abrir Examen Médico es Antecedentes.
  const [activeInnerTab, setActiveInnerTab] = useState<InnerTab>(
    () => emNavFromUrl?.innerTab ?? 'antecedentes',
  )
  const [isPending, startTransition] = useTransition()
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveFieldErrors, setSaveFieldErrors] = useState<Record<string, string[]>>({})
  const [incompleteJumpTabs, setIncompleteJumpTabs] = useState<
    { kind: 'outer' | 'inner'; id: string; label: string }[]
  >([])
  const [tabNavBlockMessage, setTabNavBlockMessage] = useState('')
  const [tabFieldErrors, setTabFieldErrors] = useState<Record<string, string[]>>({})
  const [stepTransitionNotice, setStepTransitionNotice] = useState('')
  const [aiWarning, setAiWarning] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollSectionToTop = useCallback(() => {
    if (typeof containerRef.current?.scrollIntoView === 'function') {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])
  /** DA-2: no sobrescribir impresión diagnóstica tras edición manual del médico. */
  const impresionDiagnosticaManualRef = useRef(
    !isImpresionDiagnosticaPlaceholder(physicalExamData.impresion_diagnostica),
  )
  const lastAutoImpresionRef = useRef('')

  // Estado Módulo 1
  const [modulo1, setModulo1] = useState<Record<string, string>>(() => {
    const existing = physicalExamData.modulo1
    return (
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? Object.fromEntries(
            Object.entries(existing as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
          )
        : {}
    )
  })
  // IMPL-20260809-02 (ARCH-20260809-01 v2): estado levantado de `antecedentes_captured`.
  // Mismo patrón que `modulo1`: se inicializa desde `physicalExamData.antecedentes_captured`
  // (snapshot persistido) con fallback a `{}` cuando aún no hay captura. Se incluye en
  // `buildPayload()` para persistir junto con el resto del examen vía
  // `saveExamenMedicoPapeleta`.
  const [antecedentesCaptured, setAntecedentesCaptured] = useState<Record<string, unknown>>(() => {
    const existing = physicalExamData.antecedentes_captured
    const saved =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : {}
    return mergeExamAntecedentesPrefill(saved, longitudinalData, prefilledData)
  })
  const antecedentesHydratedRef = useRef(false)
  const prefillPersistRef = useRef(false)
  useEffect(() => {
    if (formReadonly || antecedentesHydratedRef.current) return
    antecedentesHydratedRef.current = true
    setAntecedentesCaptured((prev) =>
      mergeExamAntecedentesPrefill(prev, longitudinalData, prefilledData),
    )
  }, [formReadonly, longitudinalData, prefilledData])

  const [flowserveExt, setFlowserveExt] = useState<FlowserveExtensionData>(() => {
    const raw = variantExtensionsStored.FLOWSERVE
    if (raw && typeof raw === 'object') {
      const parsed = FlowserveExtensionSchema.safeParse(raw)
      if (parsed.success) return parsed.data
    }
    return emptyFlowserveExtension()
  })

  const [sodexoExt, setSodexoExt] = useState<SodexoExtensionData>(() =>
    loadSodexoExtensionFromStorage(variantExtensionsStored.SODEXO),
  )
  const sodexoUserEdited = useRef(false)
  const storedSodexoJson = useMemo(
    () => JSON.stringify(variantExtensionsStored.SODEXO ?? null),
    [variantExtensionsStored.SODEXO],
  )
  const lastHydratedSodexoJson = useRef<string | null>(null)

  useEffect(() => {
    if (examVariant !== 'SODEXO') return
    if (sodexoUserEdited.current) return
    if (lastHydratedSodexoJson.current === storedSodexoJson) return
    lastHydratedSodexoJson.current = storedSodexoJson
    setSodexoExt(loadSodexoExtensionFromStorage(variantExtensionsStored.SODEXO))
  }, [examVariant, storedSodexoJson, variantExtensionsStored.SODEXO])

  const handleSodexoExtChange = useCallback(
    (next: SodexoExtensionData, options?: { fromSync?: boolean }) => {
      if (!options?.fromSync) sodexoUserEdited.current = true
      setSodexoExt(next)
    },
    [],
  )

  // ── Estado Somatometría (pestaña 1) ───────────────────────────────────────
  const [somaForm, setSomaForm] = useState<Record<string, string>>(() =>
    pickExamStringKeys(initSomatometryData, SOMA_ONLY_KEYS),
  )
  const [isSavingSoma, setIsSavingSoma] = useState(false)
  const [somaSaveMsg, setSomaSaveMsg] = useState('')
  // "terminada" si el dato ya existe en DB o fue guardado en esta sesión
  const [somaCompleted, setSomaCompleted] = useState<boolean>(
    !!(initSomatometryData.peso_kg || initSomatometryData.talla_m)
  )

  // ── Estado Signos Vitales (pestaña 2) ─────────────────────────────────────
  // Claves disjuntas respecto a somaForm para evitar sobreescribir peso/talla al editar vitales o viceversa
  const [vitalsForm, setVitalsForm] = useState<Record<string, string>>(() =>
    pickExamStringKeys(initSomatometryData, VITALS_ONLY_KEYS),
  )
  const [isSavingVitals, setIsSavingVitals] = useState(false)
  const [vitalsSaveMsg, setVitalsSaveMsg] = useState('')
  const [vitalsCompleted, setVitalsCompleted] = useState<boolean>(
    !!(initSomatometryData.ta_sistolica || initSomatometryData.fc_min)
  )

  // ── Estado Agudeza Visual (pestaña 3) ─────────────────────────────────────
  const [agudezaForm, setAgudezaForm] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {
      ...Object.fromEntries(VISUAL_FIELDS_NAMES.map(f => [f, NO_APLICA])),
      reflejos: REFLEJOS_VALUES[0],
      campimetria: CAMPIMETRIA_VALUES[0],
      test_ishihara: TEST_ISHIHARA_VALUES[0],
      ...Object.fromEntries(
        Object.entries(initEyeAcuityData).map(([k, v]) => [k, String(v ?? '')]),
      ),
    }
    if (!base.campimetria.trim()) base.campimetria = CAMPIMETRIA_VALUES[0]
    if (!base.test_ishihara.trim()) base.test_ishihara = TEST_ISHIHARA_VALUES[0]
    if (!base.reflejos.trim()) base.reflejos = REFLEJOS_VALUES[0]
    return base
  })
  const [isSavingAgudeza, setIsSavingAgudeza] = useState(false)
  const [agudezaSaveMsg, setAgudezaSaveMsg] = useState('')
  const [agudezaCompleted, setAgudezaCompleted] = useState<boolean>(
    Object.keys(initEyeAcuityData).length > 0
  )

  const derivedAgudezaResumen = useMemo(
    () =>
      deriveAgudezaVisualResumen(
        agudezaForm.vision_lejana_od,
        agudezaForm.vision_lejana_oi,
      ),
    [agudezaForm.vision_lejana_od, agudezaForm.vision_lejana_oi],
  )

  function updateSomaField(name: string, value: string) {
    clearFieldSaveError(name)
    setSomaForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'peso_kg' || name === 'talla_m') {
        const derivedNutri = deriveEstadoNutricionalFromSoma(next.peso_kg, next.talla_m)
        if (derivedNutri) {
          setForm(f =>
            !estadoNutricionalManualRef.current || !(f.estado_nutricional ?? '').trim()
              ? { ...f, estado_nutricional: derivedNutri }
              : f,
          )
        }
      }
      return next
    })
  }

  function updateVitalsField(name: string, value: string) {
    clearFieldSaveError(name)
    setVitalsForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'ta_sistolica' || name === 'ta_diastolica') {
        const derivedPresion = derivePresionArterialResumenFromVitals(
          next.ta_sistolica,
          next.ta_diastolica,
        )
        if (derivedPresion) {
          setForm(f =>
            !presionArterialManualRef.current || !(f.presion_arterial_resumen ?? '').trim()
              ? { ...f, presion_arterial_resumen: derivedPresion }
              : f,
          )
        }
      }
      return next
    })
  }

  function handleAgudezaField(name: string, value: string) {
    clearFieldSaveError(name)
    setAgudezaForm(prev => {
      const next = { ...prev, [name]: value }
      if (VISUAL_FIELDS_NAMES.includes(name)) {
        const resumen = deriveAgudezaVisualResumen(
          next.vision_lejana_od,
          next.vision_lejana_oi,
        )
        if (resumen) {
          setForm(f =>
            !agudezaVisualManualRef.current || !(f.agudeza_visual_resumen ?? '').trim()
              ? { ...f, agudeza_visual_resumen: resumen }
              : f,
          )
        }
      }
      return next
    })
  }

  // ── Pestaña activa externa (1-4) ──────────────────────────────────────────
  const [outerTab, setOuterTab] = useState<OuterTab>(
    () => emNavFromUrl?.outerTab ?? 'somatometria',
  )

  useEffect(() => {
    if (activeInnerTab === 'extension' && isDefaultExamenMedicoVariant(examVariant)) {
      setActiveInnerTab('impresion')
    }
  }, [activeInnerTab, examVariant])

  const recomendacionesPropuesta = useMemo(
    () => buildRecommendationsFromExam(examForHallazgosFromForm(form)),
    [form],
  )

  useEffect(() => {
    if (formReadonly) return
    if (recomendacionesManualRef.current) return
    const propuesta = recomendacionesPropuesta.trim()
    setRecomendaciones((prev) => {
      const current = prev.trim()
      const lastAuto = lastAutoRecomendacionesRef.current
      const replaceable =
        current.length === 0 || (lastAuto !== '' && current === lastAuto)
      if (!replaceable) return prev
      if (current === propuesta) {
        lastAutoRecomendacionesRef.current = propuesta
        return prev
      }
      lastAutoRecomendacionesRef.current = propuesta
      return propuesta
    })
  }, [recomendacionesPropuesta, formReadonly])

  const impresionDiagnosticaPropuesta = useMemo(
    () =>
      buildImpresionDiagnosticaFromAntecedentesYExamen({
        antecedentes: antecedentesCaptured,
        exam: examForHallazgosFromForm(form),
        especifiquePositivos: form.especifique_positivos ?? null,
      }),
    [antecedentesCaptured, form],
  )

  useEffect(() => {
    if (formReadonly) return
    if (activeInnerTab !== 'impresion') return
    if (impresionDiagnosticaManualRef.current) return
    const propuesta = impresionDiagnosticaPropuesta.trim()
    if (!propuesta) return
    setForm((prev) => {
      const current = (prev.impresion_diagnostica ?? '').trim()
      const lastAuto = lastAutoImpresionRef.current
      const replaceable =
        isImpresionDiagnosticaPlaceholder(current) || (lastAuto !== '' && current === lastAuto)
      if (!replaceable || current === propuesta) return prev
      lastAutoImpresionRef.current = propuesta
      const examen = (prev.examen_medico_texto ?? '').trim()
      const syncExamenTexto =
        isImpresionDiagnosticaPlaceholder(examen) || examen === current || examen === lastAuto
      return {
        ...prev,
        impresion_diagnostica: propuesta,
        ...(syncExamenTexto ? { examen_medico_texto: propuesta } : {}),
      }
    })
  }, [activeInnerTab, impresionDiagnosticaPropuesta, formReadonly])

  const emSectionInUrl = useRef(emSectionRaw)
  useEffect(() => {
    const section = examenMedicoNavSectionFromTabs(outerTab, activeInnerTab)
    if (emSectionInUrl.current === section) return
    emSectionInUrl.current = section
    replacePapeletaQuery({ emSection: section })
  }, [activeInnerTab, outerTab])

  useEffect(() => {
    if (!papeletaLayout || !onPapeletaActiveSectionChange) return
    onPapeletaActiveSectionChange(
      outerTab === 'examen_medico' ? activeInnerTab : outerTab,
    )
  }, [
    papeletaLayout,
    outerTab,
    activeInnerTab,
    onPapeletaActiveSectionChange,
  ])

  // ── Cálculos derivados Somatometría ───────────────────────────────────────
  const { imc, imcValue } = useMemo(
    () => computeBmi(somaForm.peso_kg, somaForm.talla_m),
    [somaForm.peso_kg, somaForm.talla_m],
  )
  const complexion = useMemo(() => complexionFromImc(imcValue), [imcValue])

  // ── Indicadores de completitud para ExamenMedico (pestaña 4) ─────────────
  const hasPhysicalExam = Object.keys(physicalExamData).some(k => physicalExamData[k] !== null && physicalExamData[k] !== '')
  const hasImpresionCapturada =
    typeof physicalExamData.impresion_diagnostica === 'string' &&
    physicalExamData.impresion_diagnostica.trim().length > 0
  const hasM1 = Object.entries(modulo1).some(([, v]) => v && v.trim() !== '' && v !== 'NEGADO' && v !== 'NO')

  // IMPL-20260817-01-C2: ¿algún campo de exploración física tiene valor POSITIVO?
  // Habilita el acordeón "Especifique hallazgos positivos" (txtEFEspecificar).
  // Ver SPEC §4.5 + análisis ZIN §B.
  const POSITIVE_EF_FIELDS = [
    'test_adam', 'test_romberg', 'signo_bragard',
    'prueba_finkelstein', 'signo_tinel', 'prueba_phanel', 'prueba_lasegue',
  ] as const
  const hasPositiveEF = POSITIVE_EF_FIELDS.some(f => {
    const v = form[f]
    if (f === 'test_adam') {
      return normalizeTestAdamEstado(v) === 'SI'
    }
    return typeof v === 'string' && v.toUpperCase().includes('POSITIVO')
  }) || normalizeQuisteEstado(form.presencia_quiste_sinovial) === 'POSITIVO'

  // IMPL-20260809-01 (ARCH-20260809-01): indicador de completitud para la
  // outer-tab "Antecedentes" — true si hay al menos un campo no vacío en
  // el snapshot `antecedentes_captured` previamente persistido.
  const capturedAntecedentes = physicalExamData.antecedentes_captured as
    | Record<string, unknown>
    | undefined
  const hasAntecedentesSnapshot = (() => {
    if (!capturedAntecedentes || typeof capturedAntecedentes !== 'object') return false
    const sections = [
      'datos_personales', 'historia_laboral', 'heredo_familiares',
      'no_patologicos', 'patologicos',
    ] as const
    for (const sec of sections) {
      const s = capturedAntecedentes[sec]
      if (s && typeof s === 'object' && !Array.isArray(s)) {
        for (const v of Object.values(s as Record<string, unknown>)) {
          if (v !== null && v !== '' && v !== undefined && v !== 'NEGADO') return true
        }
      }
    }
    return false
  })()
  const hasAntecedentes = hasAntecedentesSnapshot || hasM1

  // IMPL-20260809-02 (ARCH-20260809-01 v2): inner-tabs reordenadas — 'antecedentes' es
  // la PRIMERA sub-pestaña dentro de "Examen Médico", seguida de Módulo 1, Exploración
  // Física e Impresión/Aptitud.
  const hasExtension =
    examVariant === 'FLOWSERVE'
      ? Boolean(flowserveExt.area || flowserveExt.nivel_salud || flowserveExt.contacto_emergencia)
      : examVariant === 'SODEXO'
        ? Boolean(sodexoExt.tipo_examen || sodexoExt.contacto_emergencia || sodexoExt.matriz_riesgos_observaciones)
        : false

  // ── Handlers ──────────────────────────────────────────────────────────────
  function clearFieldSaveError(fieldKey: string) {
    setSaveFieldErrors(prev => {
      if (!prev[fieldKey]) return prev
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
    setTabFieldErrors(prev => {
      if (!prev[fieldKey] && fieldKey !== 'ta_sistolica' && fieldKey !== 'fc_min') return prev
      const next = { ...prev }
      delete next[fieldKey]
      if (fieldKey === 'ta_sistolica' || fieldKey === 'fc_min') delete next._vitals
      return next
    })
    setTabNavBlockMessage('')
  }

  function handleField(name: string, value: string) {
    clearFieldSaveError(name)
    if (name === 'boca_estado') {
      if (!saludBucalManualRef.current || !(form.salud_bucal ?? '').trim()) {
        clearFieldSaveError('salud_bucal')
      }
      setForm(prev =>
        syncBocaEstadoToSaludBucal(prev, value, saludBucalManualRef.current),
      )
      return
    }
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleResumenClinicoField(field: string, value: string) {
    const hasManualValue = value.trim().length > 0
    if (field === 'salud_bucal') {
      saludBucalManualRef.current = hasManualValue
    } else if (field === 'estado_nutricional') {
      estadoNutricionalManualRef.current = hasManualValue
    } else if (field === 'agudeza_visual_resumen') {
      agudezaVisualManualRef.current = hasManualValue
    } else if (field === 'presion_arterial_resumen') {
      presionArterialManualRef.current = hasManualValue
    }
    handleField(field, value)
  }

  function examSaveErr(fieldKey: string): string | undefined {
    return saveFieldErrors[fieldKey]?.[0]
  }

  function applySaveFailure(
    error: string,
    fieldErrors?: Record<string, string[]>,
    navigation?: ExamenMedicoSaveNavigation,
  ) {
    setSaveError(error)
    setSaveFieldErrors(fieldErrors ?? {})
    if (navigation?.outerTab) requestOuterTabChange(navigation.outerTab, { skipGuard: true })
    if (navigation?.innerTab) requestInnerTabChange(navigation.innerTab, { skipGuard: true })
  }

  const sessionMedicoLine = useMemo(
    () =>
      formatMedicoNombreYCedula(
        session?.user?.fullName ?? session?.user?.name ?? null,
        null,
      ),
    [session?.user?.fullName, session?.user?.name],
  )

  useEffect(() => {
    if (formReadonly) return
    if ((form.medico_evaluador ?? '').trim()) return

    let cancelled = false
    const apply = (line: string) => {
      if (!line || cancelled) return
      setForm(prev => {
        if ((prev.medico_evaluador ?? '').trim()) return prev
        return { ...prev, medico_evaluador: line }
      })
    }

    if (sessionMedicoLine) {
      void getCurrentDoctorProfile().then(res => {
        if (cancelled) return
        if (res.success) {
          apply(
            formatMedicoNombreYCedula(
              res.profile.fullName,
              res.profile.professionalLicense,
            ),
          )
        } else {
          apply(sessionMedicoLine)
        }
      })
    } else {
      void getCurrentDoctorProfile().then(res => {
        if (cancelled || !res.success) return
        apply(
          formatMedicoNombreYCedula(
            res.profile.fullName,
            res.profile.professionalLicense,
          ),
        )
      })
    }

    return () => {
      cancelled = true
    }
    // Solo al abrir / si aún no hay evaluador persistido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formReadonly])

  async function applyMedicoRevisorFromSession() {
    const res = await getCurrentDoctorProfile()
    const line = res.success
      ? formatMedicoNombreYCedula(
          res.profile.fullName,
          res.profile.professionalLicense,
        )
      : sessionMedicoLine
    if (!line) return
    setForm(prev => ({ ...prev, medico_revisor: line }))
  }

  function handleAptitudSelect(value: string) {
    const next = aptitud === value ? '' : value
    setAptitud(next)
    if (next && !formReadonly) {
      void applyMedicoRevisorFromSession()
    }
  }

  const validationInput = useMemo(
    (): ExamenMedicoValidationInput => ({
      somaForm,
      vitalsForm,
      agudezaForm,
      form,
      modulo1,
      antecedentesCaptured,
      examVariant,
      flowserveExt,
      sodexoExt,
      recomendaciones,
    }),
    [
      somaForm,
      vitalsForm,
      agudezaForm,
      form,
      modulo1,
      antecedentesCaptured,
      examVariant,
      flowserveExt,
      sodexoExt,
      recomendaciones,
    ],
  )

  // Permitir navegar libremente entre estudios de la papeleta sin quedar atrapado
  // cuando el Examen Médico está en borrador; el cierre definitivo sigue validado
  // por `validateExamenMedicoForClinicalClose` en `executeSaveExam(true)`.
  useStudyLeaveGuard(
    registerLeaveGuard,
    () =>
      validateExamenMedicoActiveSection(
        outerTab,
        activeInnerTab as ExamenMedicoTabId,
        validationInput,
      ),
    false,
  )

  const hasVariantExtension = !isDefaultExamenMedicoVariant(examVariant)
  const somaDone =
    somaCompleted || validateExamenMedicoTab('somatometria', validationInput).ok
  const vitalsDone =
    vitalsCompleted || validateExamenMedicoTab('signos_vitales', validationInput).ok
  const agudezaDone =
    agudezaCompleted || validateExamenMedicoTab('agudeza_visual', validationInput).ok
  const antecedentesDone =
    hasAntecedentes || validateExamenMedicoTab('antecedentes', validationInput).ok
  const exploracionDone = hasPhysicalExam
  const impresionDone =
    hasImpresionCapturada || Boolean((form.impresion_diagnostica ?? '').trim())

  type WizardStep =
    | {
        kind: 'outer'
        id: 'somatometria' | 'signos_vitales' | 'agudeza_visual'
        label: string
        icon: string
        done: boolean
      }
    | {
        kind: 'inner'
        id: InnerTab
        label: string
        icon: string
        done: boolean
      }

  const wizardSteps: WizardStep[] = [
    { kind: 'outer', id: 'somatometria', label: 'Somatometría', icon: '⚖️', done: somaDone },
    { kind: 'outer', id: 'signos_vitales', label: 'Signos Vitales', icon: '💓', done: vitalsDone },
    { kind: 'outer', id: 'agudeza_visual', label: 'Agudeza Visual', icon: '👁️', done: agudezaDone },
    { kind: 'inner', id: 'antecedentes', label: 'Antecedentes', icon: '🩺', done: antecedentesDone },
    { kind: 'inner', id: 'exploracion', label: 'Exploración Física', icon: '🩻', done: exploracionDone },
    ...(hasVariantExtension
      ? [
          {
            kind: 'inner' as const,
            id: 'extension' as const,
            label: examenMedicoVariantLabel(examVariant),
            icon: examVariant === 'FLOWSERVE' ? '🏭' : '🍽️',
            done: hasExtension,
          },
        ]
      : []),
    { kind: 'inner', id: 'impresion', label: 'Impresión clínica', icon: '✅', done: impresionDone },
  ]
  const totalSteps = wizardSteps.length
  const stepNumberFor = (id: ExamenMedicoTabId) => {
    const idx = wizardSteps.findIndex((s) => s.id === id)
    return idx >= 0 ? idx + 1 : 1
  }

  const antecedentesProvenance = (
    antecedentesCaptured._provenance ??
    (physicalExamData.antecedentes_captured as
      | { _provenance?: Record<string, unknown> }
      | undefined)?._provenance
  ) as Parameters<typeof AntecedentesCaptura>[0]['initialProvenance'] | undefined
  const antecedentesProvenanceBadge =
    ANTECEDENTES_PROVENANCE_BADGE[antecedentesProvenance?.source ?? 'none'] ??
    ANTECEDENTES_PROVENANCE_BADGE.none

  function applyTabValidationErrors(tab: ExamenMedicoTabId) {
    const gate = validateExamenMedicoTab(tab, validationInput)
    if (!gate.ok) {
      setTabFieldErrors(studyValidationToFieldErrors(gate))
      setTabNavBlockMessage(formatStudyMissingFieldsSpanish(gate.missing))
      return false
    }
    setTabNavBlockMessage('')
    setTabFieldErrors({})
    return true
  }

  function requestOuterTabChange(next: OuterTab, _options?: { skipGuard?: boolean }) {
    setOuterTab(next)
    setTabNavBlockMessage('')
    setTabFieldErrors({})
    setStepTransitionNotice('')
    setIncompleteJumpTabs([])
  }

  function requestInnerTabChange(next: InnerTab, _options?: { skipGuard?: boolean }) {
    setActiveInnerTab(next)
    setOuterTab('examen_medico')
    setTabNavBlockMessage('')
    setTabFieldErrors({})
    setStepTransitionNotice('')
    setIncompleteJumpTabs([])
  }

  function tabErr(fieldKey: string): string | undefined {
    return tabFieldErrors[fieldKey]?.[0] ?? saveFieldErrors[fieldKey]?.[0]
  }

  function buildPayload() {
    const variant_extensions: Record<string, unknown> = {}
    if (examVariant === 'FLOWSERVE') {
      variant_extensions.FLOWSERVE = flowserveExt
    }
    if (examVariant === 'SODEXO') {
      variant_extensions.SODEXO = sodexoExt
    }
    return {
      ...form,
      aptitud: aptitud || undefined,
      recomendaciones_clinicas: recomendaciones.trim() || undefined,
      modulo1,
      antecedentes_captured: antecedentesCaptured,
      exam_variant: examVariant,
      ...(Object.keys(variant_extensions).length > 0 ? { variant_extensions } : {}),
    }
  }

  const somaAutosavePayload = useMemo(
    () => ({
      ...initSomatometryData,
      ...vitalsForm,
      ...somaForm,
      imc: parseFloat(imc),
      complexion,
    }),
    [initSomatometryData, somaForm, vitalsForm, imc, complexion],
  )

  async function handleSaveSoma(markComplete: boolean) {
    setIsSavingSoma(true)
    setSomaSaveMsg('')
    setStepTransitionNotice('')
    if (markComplete && !applyTabValidationErrors('somatometria')) {
      setSomaSaveMsg('❌ Completa los campos obligatorios antes de continuar.')
      setIsSavingSoma(false)
      return
    }
    const res = await updateSomatometria(eventId, somaAutosavePayload, { revalidate: false })
    if (res.success) {
      const derivedNutri = deriveEstadoNutricionalFromSoma(somaForm.peso_kg, somaForm.talla_m)
      if (derivedNutri) {
        setForm(prev =>
          !estadoNutricionalManualRef.current || !(prev.estado_nutricional ?? '').trim()
            ? { ...prev, estado_nutricional: derivedNutri }
            : prev,
        )
      }
      const stepOk = markComplete || validateExamenMedicoTab('somatometria', validationInput).ok
      if (stepOk) setSomaCompleted(true)
      if (somatometryEventTestId) {
        const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
        await updateEventTestStatus(
          somatometryEventTestId,
          newStatus as Parameters<typeof updateEventTestStatus>[1],
          eventId,
          { revalidate: false },
        )
      }
      if (markComplete) {
        setSomaSaveMsg('')
        setTabFieldErrors({})
        setTabNavBlockMessage('')
        setStepTransitionNotice('Somatometría guardada. Continúa con Signos Vitales.')
        setOuterTab('signos_vitales')
        scrollSectionToTop()
      } else {
        setSomaSaveMsg('✅ Borrador guardado.')
      }
    } else {
      const mapped = mapMedicalExamActionFailure(
        {
          success: false,
          error: res.error ?? 'No se pudo guardar',
          technicalDetail: 'technicalDetail' in res ? res.technicalDetail : undefined,
        },
        'Somatometría (guardado manual)',
      )
      const line = splitUserFacingMessageLines(mapped.userMessage)[0] ?? mapped.userMessage
      setSomaSaveMsg(`❌ ${mapped.title}: ${line}`)
    }
    setIsSavingSoma(false)
  }

  async function handleSaveVitals(markComplete: boolean) {
    setIsSavingVitals(true)
    setVitalsSaveMsg('')
    setStepTransitionNotice('')
    if (markComplete && !applyTabValidationErrors('signos_vitales')) {
      setVitalsSaveMsg('❌ Completa los campos obligatorios antes de continuar.')
      setIsSavingVitals(false)
      return
    }
    const res = await updateSomatometria(eventId, somaAutosavePayload, { revalidate: false })
    if (res.success) {
      const derivedPresion = derivePresionArterialResumenFromVitals(
        vitalsForm.ta_sistolica,
        vitalsForm.ta_diastolica,
      )
      if (derivedPresion) {
        setForm(prev =>
          !presionArterialManualRef.current || !(prev.presion_arterial_resumen ?? '').trim()
            ? { ...prev, presion_arterial_resumen: derivedPresion }
            : prev,
        )
      }
      const stepOk = markComplete || validateExamenMedicoTab('signos_vitales', validationInput).ok
      if (stepOk) setVitalsCompleted(true)
      if (somatometryEventTestId) {
        const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
        await updateEventTestStatus(
          somatometryEventTestId,
          newStatus as Parameters<typeof updateEventTestStatus>[1],
          eventId,
          { revalidate: false },
        )
      }
      if (markComplete) {
        setVitalsSaveMsg('')
        setTabFieldErrors({})
        setTabNavBlockMessage('')
        setStepTransitionNotice('Signos Vitales guardados. Continúa con Agudeza Visual.')
        setOuterTab('agudeza_visual')
        scrollSectionToTop()
      } else {
        setVitalsSaveMsg('✅ Borrador guardado.')
      }
    } else {
      const mapped = mapMedicalExamActionFailure(
        {
          success: false,
          error: res.error ?? 'No se pudo guardar',
          technicalDetail: 'technicalDetail' in res ? res.technicalDetail : undefined,
        },
        'Signos vitales (guardado manual)',
      )
      const line = splitUserFacingMessageLines(mapped.userMessage)[0] ?? mapped.userMessage
      setVitalsSaveMsg(`❌ ${mapped.title}: ${line}`)
    }
    setIsSavingVitals(false)
  }

  async function handleSaveAgudeza(markComplete: boolean) {
    setIsSavingAgudeza(true)
    setAgudezaSaveMsg('')
    setStepTransitionNotice('')
    if (markComplete && !applyTabValidationErrors('agudeza_visual')) {
      setAgudezaSaveMsg('❌ Completa los campos obligatorios antes de continuar.')
      setIsSavingAgudeza(false)
      return
    }
    const res = await updateAgudezaVisual(eventId, agudezaForm, { revalidate: false })
    if (res.success) {
      if (derivedAgudezaResumen) {
        setForm(prev =>
          !agudezaVisualManualRef.current || !(prev.agudeza_visual_resumen ?? '').trim()
            ? { ...prev, agudeza_visual_resumen: derivedAgudezaResumen }
            : prev,
        )
      }
      const stepOk = markComplete || validateExamenMedicoTab('agudeza_visual', validationInput).ok
      if (stepOk) setAgudezaCompleted(true)
      if (agudezaEventTestId) {
        const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
        await updateEventTestStatus(
          agudezaEventTestId,
          newStatus as Parameters<typeof updateEventTestStatus>[1],
          eventId,
          { revalidate: false },
        )
      }
      if (markComplete) {
        setAgudezaSaveMsg('')
        setTabFieldErrors({})
        setTabNavBlockMessage('')
        setStepTransitionNotice('Agudeza Visual guardada. Continúa con Antecedentes.')
        setActiveInnerTab('antecedentes')
        setOuterTab('examen_medico')
        scrollSectionToTop()
      } else {
        setAgudezaSaveMsg('✅ Borrador guardado.')
      }
    } else {
      const mapped = mapMedicalExamActionFailure(
        {
          success: false,
          error: res.error ?? 'No se pudo guardar',
          technicalDetail: 'technicalDetail' in res ? res.technicalDetail : undefined,
        },
        'Agudeza visual (guardado manual)',
      )
      const line = splitUserFacingMessageLines(mapped.userMessage)[0] ?? mapped.userMessage
      setAgudezaSaveMsg(`❌ ${mapped.title}: ${line}`)
    }
    setIsSavingAgudeza(false)
  }

  async function resolveMedicoLinesForSave(): Promise<{
    medico_evaluador?: string
    medico_revisor?: string
  }> {
    const res = await getCurrentDoctorProfile()
    const line = res.success
      ? formatMedicoNombreYCedula(
          res.profile.fullName,
          res.profile.professionalLicense,
        )
      : sessionMedicoLine
    if (!line) return {}
    const patch: { medico_evaluador?: string; medico_revisor?: string } = {}
    if (!(form.medico_evaluador ?? '').trim()) patch.medico_evaluador = line
    if (aptitud && !(form.medico_revisor ?? '').trim()) patch.medico_revisor = line
    return patch
  }

  async function executeSaveExam(
    markComplete: boolean,
    advanceTo?: { innerTab: InnerTab; notice: string },
  ) {
    setSaveMsg('')
    setSaveError('')
    setSaveFieldErrors({})
    setIncompleteJumpTabs([])
    setTabNavBlockMessage('')
    setTabFieldErrors({})
    setAiWarning('')
    setStepTransitionNotice('')

    if (markComplete) {
      const gate = validateExamenMedicoForClinicalClose(validationInput)
      if (!gate.ok) {
        const missingTabs = wizardSteps
          .filter((step) => !validateExamenMedicoTab(step.id, validationInput).ok)
          .map((step) => ({ kind: step.kind, id: step.id, label: step.label }))
        setIncompleteJumpTabs(missingTabs)
        setTabNavBlockMessage(formatStudyMissingFieldsSpanish(gate.missing))
        setSaveFieldErrors(studyValidationToFieldErrors(gate))
        setSaveError('No se puede cerrar la captura: faltan campos obligatorios.')
        return
      }
    }

    const profileRes = await getCurrentDoctorProfile()
    const medicoLine = profileRes.success
      ? medicoLineFromProfile(
          profileRes.profile.fullName,
          profileRes.profile.professionalLicense,
        )
      : sessionMedicoLine

    const rawPayload = buildPayload()
    const prepared = prepareExamenMedicoPayloadForSave(rawPayload, { medicoLine })

    const formPatch: Record<string, string> = {}
    for (const [key, value] of Object.entries(prepared)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        formPatch[key] = String(value)
      }
    }
    if (Object.keys(formPatch).length > 0) {
      setForm(prev => ({ ...prev, ...formPatch }))
    }

    const res = await saveExamenMedicoPapeleta(
      eventId,
      eventTestId,
      prepared,
      markComplete,
      { revalidate: markComplete && !advanceTo },
    )
    if (res.success) {
      setSaveFieldErrors({})
      if (markComplete) {
        setCaptureClosed(true)
      }
      if (advanceTo) {
        setStepTransitionNotice(advanceTo.notice)
        setActiveInnerTab(advanceTo.innerTab)
        setOuterTab('examen_medico')
        onStatusChange?.(res.studyStatus ?? 'RESULT_REGISTERED', { skipRefresh: true })
        scrollSectionToTop()
      } else {
        setSaveMsg(
          markComplete
            ? '🏁 Captura del examen médico cerrada. El estudio queda pendiente de interpretación/diagnóstico; la aptitud laboral se define al emitir el dictamen en Validación.'
            : '✅ Borrador guardado.',
        )
        if (res.aiWarning) {
          setAiWarning(`La captura clínica se guardó, pero la IA no pudo generar prediagnóstico: ${res.aiWarning}`)
        }
        onStatusChange?.(
          res.studyStatus ?? 'RESULT_REGISTERED',
          { skipRefresh: true },
        )
      }
    } else {
      applySaveFailure(
        res.error ?? 'Error al guardar',
        'fieldErrors' in res ? res.fieldErrors : undefined,
        'navigation' in res ? res.navigation : undefined,
      )
    }
  }

  function handleSave(markComplete: boolean) {
    startTransition(() => executeSaveExam(markComplete))
  }

  function handleSaveAndAdvanceInner(nextInner: InnerTab, notice: string) {
    startTransition(() => executeSaveExam(false, { innerTab: nextInner, notice }))
  }

  const examSnapshotKey = useMemo(
    () => JSON.stringify(buildPayload()),
    [
      form,
      aptitud,
      modulo1,
      antecedentesCaptured,
      flowserveExt,
      sodexoExt,
      examVariant,
    ],
  )

  const onAutosaveExam = useCallback(async () => {
    const medicoPatch = await resolveMedicoLinesForSave()
    if (Object.keys(medicoPatch).length > 0) {
      setForm(prev => ({ ...prev, ...medicoPatch }))
    }
    const payload = { ...buildPayload(), ...medicoPatch }
    const res = await saveExamenMedicoPapeleta(
      eventId,
      eventTestId,
      payload,
      false,
      { autosave: true },
    )
    if (res.success) return true
    const detail =
      res.fieldErrors && Object.keys(res.fieldErrors).length > 0
        ? Object.entries(res.fieldErrors)
            .map(([k, msgs]) => `${k}: ${msgs[0] ?? ''}`)
            .join('\n')
        : res.error
    return {
      ok: false,
      message: res.error,
      error: detail,
      context: 'Examen médico (autoguardado)',
    }
  }, [
    eventId,
    eventTestId,
    examSnapshotKey,
    aptitud,
    form,
    modulo1,
    antecedentesCaptured,
    flowserveExt,
    sodexoExt,
    examVariant,
    sessionMedicoLine,
  ])

  // SME-111: persistir prefill en BD para que consulta/certificado hereden `antecedentes_captured`.
  useEffect(() => {
    if (formReadonly || prefillPersistRef.current) return
    const persisted = physicalExamData.antecedentes_captured
    if (
      antecedentesSnapshotComparable(antecedentesCaptured) ===
      antecedentesSnapshotComparable(persisted)
    ) {
      return
    }
    prefillPersistRef.current = true
    void onAutosaveExam()
  }, [formReadonly, antecedentesCaptured, onAutosaveExam, physicalExamData.antecedentes_captured])

  const { statusLabel: autosaveStatusLabel, userFacingError: autosaveExamError } = useExamenMedicoAutosave({
    enabled: !formReadonly && !captureClosed,
    eventId,
    eventTestId,
    outerTab,
    somaPayload: somaAutosavePayload,
    agudezaPayload: agudezaForm,
    examSnapshotKey,
    onAutosaveExam,
    onAfterSomaAutosave: () => {
      if (somaForm.peso_kg?.trim() || somaForm.talla_m?.trim()) {
        setSomaCompleted(true)
      }
      if (vitalsForm.ta_sistolica?.trim() || vitalsForm.fc_min?.trim()) {
        setVitalsCompleted(true)
      }
    },
    onAfterAgudezaAutosave: () => {
      const hasVision = VISUAL_FIELDS_NAMES.some(
        f => (agudezaForm[f] ?? '').trim() && agudezaForm[f] !== NO_APLICA,
      )
      if (hasVision) setAgudezaCompleted(true)
    },
  })

  // ─── Render ────────────────────────────────────────────────────────────────
  const showExamenMedicoPanel = outerTab === 'examen_medico'

  return (
    <div ref={containerRef} className="space-y-4">
      <StudyCaptureMissingBanner message={tabNavBlockMessage} />

      {/* Stepper unificado de todo el Examen Médico */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 border border-slate-200 rounded-xl p-1.5">
        {wizardSteps.map((step, idx) => {
          const active =
            step.kind === 'outer'
              ? outerTab === step.id
              : outerTab === 'examen_medico' && activeInnerTab === step.id
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (step.kind === 'outer') {
                  requestOuterTabChange(step.id)
                } else {
                  requestInnerTabChange(step.id)
                }
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-2 rounded-lg transition-colors justify-center flex-1 min-w-[115px] ${
                active
                  ? 'bg-white shadow-sm ring-1 ring-slate-200 text-teal-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                  step.done
                    ? 'bg-emerald-100 text-emerald-700'
                    : active
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {step.done ? '✓' : idx + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </button>
          )
        })}
      </div>

      {!formReadonly && (
        <ClinicalAutosaveIndicator
          label={autosaveStatusLabel}
          error={autosaveExamError}
          className="text-[11px] px-3 py-1.5 rounded-lg border bg-slate-50 border-slate-200"
        />
      )}

      {stepTransitionNotice && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2"
        >
          <span>✓</span>
          <span>{stepTransitionNotice}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PASO 1: SOMATOMETRÍA                                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'somatometria' && (
        <div className="space-y-4">
          <ExamSectionHeader
            icon={Scale}
            title="Somatometría"
            subtitle="Registro de peso, talla y cálculo automático de IMC."
            stepNumber={stepNumberFor('somatometria')}
            totalSteps={totalSteps}
          />

          <div className={EXAM_CARD_CLASS}>
            <p className={EXAM_CARD_TITLE_CLASS}>Antropometría</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <StudyCaptureFieldLabel required={isExamenMedicoRequiredField('somatometria', 'peso_kg')}>
                  Peso (KG)
                </StudyCaptureFieldLabel>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={500}
                  value={somaForm.peso_kg || ''}
                  onChange={e => updateSomaField('peso_kg', e.target.value)}
                  disabled={formReadonly}
                  className={examFieldRingClass(
                    Boolean(tabErr('peso_kg')),
                    EXAM_NUMERIC_INPUT_CLASS,
                  )}
                  placeholder="Ej: 75.5"
                />
                {tabErr('peso_kg') && (
                  <p className="text-[11px] text-red-600 mt-1">{tabErr('peso_kg')}</p>
                )}
              </div>

              <div>
                <StudyCaptureFieldLabel required={isExamenMedicoRequiredField('somatometria', 'talla_m')}>
                  Talla (metros)
                </StudyCaptureFieldLabel>
                <input
                  type="text"
                  inputMode="decimal"
                  value={somaForm.talla_m || ''}
                  onChange={e => {
                    const v = e.target.value
                    const next =
                      v.includes('.') || v.includes(',')
                        ? v.replace(',', '.')
                        : formatTallaMetersWhileTyping(v)
                    updateSomaField('talla_m', next)
                  }}
                  onBlur={e => {
                    const formatted = formatTallaMetersForDisplay(e.target.value)
                    if (formatted !== e.target.value.trim()) {
                      updateSomaField('talla_m', formatted)
                    }
                  }}
                  disabled={formReadonly}
                  className={examFieldRingClass(
                    Boolean(tabErr('talla_m')),
                    EXAM_NUMERIC_INPUT_CLASS,
                  )}
                  placeholder="Ej: 1,75 o 175"
                />
                {tabErr('talla_m') && (
                  <p className="text-[11px] text-red-600 mt-1">{tabErr('talla_m')}</p>
                )}
              </div>

              <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500">IMC calculado</p>
                  <div className="text-2xl font-black text-slate-800 font-mono tabular-nums">
                    {imc}
                  </div>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs ${
                    complexion === 'NORMAL'
                      ? 'bg-emerald-100 text-emerald-700'
                      : complexion === 'SOBREPESO'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {complexion}
                </span>
              </div>
            </div>
          </div>

          <ExamSectionFooter
            readonly={formReadonly}
            isBusy={isSavingSoma}
            statusMessage={somaSaveMsg}
            onSaveDraft={() => handleSaveSoma(false)}
            onPrimary={() => handleSaveSoma(true)}
            primaryLabel="Guardar y continuar → Signos Vitales"
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PASO 2: SIGNOS VITALES                                        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'signos_vitales' && (
        <div className="space-y-4">
          <ExamSectionHeader
            icon={HeartPulse}
            title="Signos Vitales"
            subtitle="Tensión arterial, frecuencia cardiaca, temperatura, respiración y saturación."
            stepNumber={stepNumberFor('signos_vitales')}
            totalSteps={totalSteps}
          />

          <div className={EXAM_CARD_CLASS}>
            <p className={EXAM_CARD_TITLE_CLASS}>Parámetros vitales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <StudyCaptureFieldLabel required>
                  Tensión arterial (Sist / Diast)
                </StudyCaptureFieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={vitalsForm.ta_sistolica || ''}
                    onChange={e => updateVitalsField('ta_sistolica', e.target.value)}
                    disabled={formReadonly}
                    className={examFieldRingClass(
                      Boolean(tabErr('ta_sistolica') || tabErr('_vitals')),
                      `${EXAM_NUMERIC_INPUT_CLASS} text-center`,
                    )}
                    placeholder="120"
                  />
                  <span className="text-slate-400 font-bold text-lg">/</span>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={vitalsForm.ta_diastolica || ''}
                    onChange={e => updateVitalsField('ta_diastolica', e.target.value)}
                    disabled={formReadonly}
                    className={`${EXAM_NUMERIC_INPUT_CLASS} text-center`}
                    placeholder="80"
                  />
                </div>
              </div>

              <div>
                <StudyCaptureFieldLabel required>Frec. cardiaca (lpm)</StudyCaptureFieldLabel>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={vitalsForm.fc_min || ''}
                  onChange={e => updateVitalsField('fc_min', e.target.value)}
                  disabled={formReadonly}
                  className={examFieldRingClass(
                    Boolean(tabErr('fc_min') || tabErr('_vitals')),
                    `${EXAM_NUMERIC_INPUT_CLASS} text-center`,
                  )}
                  placeholder="BPM"
                />
              </div>

              <div>
                <label className={EXAM_LABEL_CLASS}>Temperatura (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  min={30}
                  max={45}
                  value={vitalsForm.temperatura || ''}
                  onChange={e => updateVitalsField('temperatura', e.target.value)}
                  disabled={formReadonly}
                  className={`${EXAM_NUMERIC_INPUT_CLASS} text-center`}
                  placeholder="°C"
                />
              </div>

              <div>
                <label className={EXAM_LABEL_CLASS}>Frec. respiratoria (rpm)</label>
                <input
                  type="number"
                  min={0}
                  max={80}
                  value={vitalsForm.fr_min || ''}
                  onChange={e => updateVitalsField('fr_min', e.target.value)}
                  disabled={formReadonly}
                  className={`${EXAM_NUMERIC_INPUT_CLASS} text-center`}
                  placeholder="RPM"
                />
              </div>

              <div>
                <label className={EXAM_LABEL_CLASS}>Sat. oxígeno (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={vitalsForm.saturacion_oxigeno || ''}
                  onChange={e => updateVitalsField('saturacion_oxigeno', e.target.value)}
                  disabled={formReadonly}
                  className={`${EXAM_NUMERIC_INPUT_CLASS} text-center`}
                  placeholder="%"
                />
              </div>
            </div>
            {tabErr('_vitals') && (
              <p className="text-[11px] text-red-600">{tabErr('_vitals')}</p>
            )}
          </div>

          <VitalSignsPrediagnosisPanel
            vitals={vitalsForm}
            sexo={modulo1['m1_sexo'] || String(form.sexo ?? '') || undefined}
          />

          <ExamSectionFooter
            readonly={formReadonly}
            isBusy={isSavingVitals}
            statusMessage={vitalsSaveMsg}
            onPrev={() => requestOuterTabChange('somatometria')}
            onSaveDraft={() => handleSaveVitals(false)}
            onPrimary={() => handleSaveVitals(true)}
            primaryLabel="Guardar y continuar → Agudeza Visual"
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PASO 3: AGUDEZA VISUAL                                        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'agudeza_visual' && (
        <div className="space-y-4">
          <ExamSectionHeader
            icon={Eye}
            title="Agudeza Visual"
            subtitle="Campo visual (Snellen), pruebas complementarias y clasificación automática."
            stepNumber={stepNumberFor('agudeza_visual')}
            totalSteps={totalSteps}
          />

          {/* Campo Visual — lejana Snellen; cercana decimal legacy AMI */}
          <div className={EXAM_CARD_CLASS}>
            <p className={EXAM_CARD_TITLE_CLASS}>Campo Visual</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {VISUAL_FIELDS.map(f => (
                <div key={f.name}>
                  <StudyCaptureFieldLabel
                    required={
                      f.name === 'vision_lejana_od' || f.name === 'vision_lejana_oi'
                    }
                  >
                    {f.label}
                  </StudyCaptureFieldLabel>
                  <select
                    value={agudezaForm[f.name] || NO_APLICA}
                    onChange={e => handleAgudezaField(f.name, e.target.value)}
                    disabled={formReadonly}
                    className={examFieldRingClass(
                      Boolean(tabErr(f.name)),
                      `${EXAM_INPUT_CLASS} font-mono`,
                    )}
                  >
                    {visionFieldSelectOptions(f.name, agudezaForm[f.name]).map(v => (
                      <option key={v} value={v}>
                        {getCatalogEnumDisplayLabel(v)}
                      </option>
                    ))}
                  </select>
                  {tabErr(f.name) && (
                    <p className="text-[11px] text-red-600 mt-1">{tabErr(f.name)}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3">
              <p className="text-[11px] font-bold text-teal-700">
                Clasificación agudeza visual (automática)
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {derivedAgudezaResumen || 'Complete visión lejana OD/OI para clasificar'}
              </p>
              <p className="mt-0.5 text-xs text-teal-700/90">
                Se sincroniza al resumen clínico y al PDF del examen médico.
              </p>
            </div>
          </div>

          {/* Pruebas Complementarias */}
          <div className={EXAM_CARD_CLASS}>
            <p className={EXAM_CARD_TITLE_CLASS}>Pruebas Complementarias</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                { name: 'campimetria', label: 'Campimetría', options: CAMPIMETRIA_VALUES },
                { name: 'test_ishihara', label: 'Test Ishihara', options: TEST_ISHIHARA_VALUES },
                { name: 'reflejos', label: 'Reflejos', options: REFLEJOS_VALUES },
              ] as { name: string; label: string; options: readonly string[] }[]).map(
                ({ name, label, options }) => (
                  <div key={name}>
                    <label className={EXAM_LABEL_CLASS}>{label}</label>
                    <select
                      value={agudezaForm[name] || options[0]}
                      onChange={e => handleAgudezaField(name, e.target.value)}
                      disabled={formReadonly}
                      className={EXAM_INPUT_CLASS}
                    >
                      {options.map(v => (
                        <option key={v} value={v}>
                          {getCatalogEnumDisplayLabel(v)}
                        </option>
                      ))}
                    </select>
                  </div>
                ),
              )}
            </div>
            <p className="text-xs text-slate-500">
              Campimetría resumida para papeletas sin estudio CAMPIMETRIA completo.
            </p>
          </div>

          <ExamSectionFooter
            readonly={formReadonly}
            isBusy={isSavingAgudeza}
            statusMessage={agudezaSaveMsg}
            onPrev={() => requestOuterTabChange('signos_vitales')}
            onSaveDraft={() => handleSaveAgudeza(false)}
            onPrimary={() => handleSaveAgudeza(true)}
            primaryLabel="Guardar y continuar → Antecedentes"
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 4: EXAMEN MÉDICO (bloqueada si no completan 1-3)      */}
      {/* IMPL-20260809-02 (ARCH-20260809-01 v2): 'antecedentes' ya no es */}
      {/* outer-tab; ahora es primera inner-tab dentro de esta pestaña.   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showExamenMedicoPanel && (
        <div className="space-y-4">
          {/* ── Sub-tab 1: Antecedentes (snapshot por cita — IMPL-20260809-02) ── */}
          {activeInnerTab === 'antecedentes' && (
            <div className="space-y-4">
              <ExamSectionHeader
                icon={Stethoscope}
                title="Antecedentes — Captura por cita"
                subtitle="Cuestionario del paciente, antecedentes gineco/reproductivos e inmunizaciones."
                stepNumber={stepNumberFor('antecedentes')}
                totalSteps={totalSteps}
                rightSlot={
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${antecedentesProvenanceBadge.color}`}
                  >
                    {antecedentesProvenanceBadge.label}
                  </span>
                }
              />

              <AntecedentesCaptura
                value={antecedentesCaptured}
                onChange={setAntecedentesCaptured}
                initialProvenance={antecedentesProvenance}
                workerId={workerId}
                readonly={formReadonly}
                modulo1={modulo1}
                onModulo1Change={setModulo1}
                antecedentesMedico={form.antecedentes_medico ?? ''}
                onAntecedentesMedicoChange={v => handleField('antecedentes_medico', v)}
                portalPrefillHint={Boolean(prefilledData || longitudinalData)}
                hideHeader
                hideFooter
              />

              <ExamSectionFooter
                readonly={formReadonly}
                isBusy={isPending}
                statusMessage={saveError ? `❌ ${saveError}` : saveMsg}
                onPrev={() => requestOuterTabChange('agudeza_visual')}
                onSaveDraft={() => handleSave(false)}
                onPrimary={() =>
                  handleSaveAndAdvanceInner(
                    'exploracion',
                    'Antecedentes guardados. Continúa con Exploración Física.',
                  )
                }
                primaryLabel="Guardar y continuar → Exploración"
              />
            </div>
          )}

          {/* ── Sub-tab 2: Exploración Física ──────────────────────────────── */}
          {activeInnerTab === 'exploracion' && (
            <div className="space-y-4">
              <ExamSectionHeader
                icon={Activity}
                title="Exploración Física"
                subtitle="Hallazgos por aparato, sistema y maniobras osteomusculares."
                stepNumber={stepNumberFor('exploracion')}
                totalSteps={totalSteps}
              />

              <div className={EXAM_CARD_CLASS}>
                <p className={EXAM_CARD_TITLE_CLASS}>Hallazgos por aparato y sistema</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {EXPLORACION_FIELDS.map(field => {
                    if (field.name === 'boca_alineacion') return null

                    // Cavidad Bucal + Salud bucal anidada.
                    if (field.name === 'boca_estado') {
                      return (
                        <div
                          key="cavidad_bucal"
                          className="sm:col-span-2 lg:col-span-1 border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-3"
                        >
                          <div>
                            <label className={EXAM_LABEL_CLASS}>Cavidad Bucal</label>
                            <input
                              type="text"
                              value={form.boca_alineacion ?? ''}
                              onChange={e => handleField('boca_alineacion', e.target.value)}
                              disabled={formReadonly}
                              placeholder="Dentadura completa"
                              className={EXAM_INPUT_CLASS}
                            />
                          </div>
                          <div className="pt-2 border-t border-slate-200/80">
                            <label
                              htmlFor="exploracion-boca-estado"
                              className={EXAM_LABEL_CLASS}
                            >
                              Salud bucal
                            </label>
                            <select
                              id="exploracion-boca-estado"
                              data-testid="exploracion-boca-estado"
                              value={form.boca_estado ?? ''}
                              onChange={e => handleField('boca_estado', e.target.value)}
                              disabled={formReadonly}
                              className={EXAM_INPUT_CLASS}
                            >
                              <option value="">— Seleccionar —</option>
                              {SALUD_BUCAL_VALUES.map(v => (
                                <option key={v} value={v}>
                                  {getCatalogEnumDisplayLabel(v)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )
                    }

                    // Columna Vertebral + Test Adam anidado (SI → lateral + Otros).
                    if (field.name === 'columna_vertebral') {
                      const testAdamEstado = normalizeTestAdamEstado(form.test_adam)
                      return (
                        <div
                          key={field.name}
                          className="sm:col-span-2 lg:col-span-1 border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-3"
                        >
                          <div>
                            <label className={EXAM_LABEL_CLASS}>{field.label}</label>
                            <input
                              type="text"
                              value={form.columna_vertebral ?? ''}
                              onChange={e => handleField('columna_vertebral', e.target.value)}
                              disabled={formReadonly}
                              className={EXAM_INPUT_CLASS}
                            />
                          </div>
                          <div className="pt-2 border-t border-slate-200/80">
                            <p className={EXAM_LABEL_CLASS}>Test Adam</p>
                            <div className="flex gap-1.5 mb-2">
                              {(['NEGADO', 'SI'] as const).map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  disabled={formReadonly}
                                  onClick={() => {
                                    handleField('test_adam', opt)
                                    if (opt === 'NEGADO') {
                                      handleField('test_adam_lateral', '')
                                      handleField('test_adam_otros', '')
                                      handleField('columna_vertebral', PLANTILLAS_EF.columna_vertebral)
                                    } else {
                                      handleField('columna_vertebral', COLUMNA_VERTEBRAL_DESVIADA)
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                                    testAdamEstado === opt
                                      ? 'bg-teal-50 border-teal-400 text-teal-800'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                            {testAdamEstado === 'SI' && (
                              <div className="space-y-2">
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                    Lateralidad
                                  </label>
                                  <select
                                    value={form.test_adam_lateral ?? ''}
                                    onChange={e => handleField('test_adam_lateral', e.target.value)}
                                    disabled={formReadonly}
                                    className={EXAM_INPUT_CLASS}
                                  >
                                    <option value="">— Seleccionar —</option>
                                    {TEST_ADAM_LATERAL_VALUES.map(v => (
                                      <option key={v} value={v}>
                                        {getCatalogEnumDisplayLabel(v)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                    Otros
                                  </label>
                                  <input
                                    type="text"
                                    value={form.test_adam_otros ?? ''}
                                    onChange={e => handleField('test_adam_otros', e.target.value)}
                                    disabled={formReadonly}
                                    placeholder="Detalle adicional del Test Adam"
                                    maxLength={500}
                                    className={EXAM_INPUT_CLASS}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // Quiste sinovial — NEGATIVO/POSITIVO + especificar si POSITIVO.
                    if (field.name === 'presencia_quiste_sinovial') {
                      const quisteEstado = normalizeQuisteEstado(form.presencia_quiste_sinovial)
                      return (
                        <div
                          key={field.name}
                          className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2"
                        >
                          <div>
                            <label className={EXAM_LABEL_CLASS}>{field.label}</label>
                            <select
                              value={quisteEstado}
                              onChange={e => {
                                handleField('presencia_quiste_sinovial', e.target.value)
                                if (e.target.value !== 'POSITIVO') {
                                  handleField('especificar_quiste', '')
                                }
                              }}
                              disabled={formReadonly}
                              className={EXAM_INPUT_CLASS}
                            >
                              {QUISTE_SINOVIAL_CAPTURA_VALUES.map(v => (
                                <option key={v} value={v}>
                                  {getCatalogEnumDisplayLabel(v)}
                                </option>
                              ))}
                            </select>
                          </div>
                          {quisteEstado === 'POSITIVO' && (
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Especifique
                              </label>
                              <input
                                type="text"
                                value={form.especificar_quiste ?? ''}
                                onChange={e => handleField('especificar_quiste', e.target.value)}
                                disabled={formReadonly}
                                placeholder="Ubicación o detalle del quiste"
                                maxLength={500}
                                className={EXAM_INPUT_CLASS}
                              />
                            </div>
                          )}
                        </div>
                      )
                    }

                    const currentValue = form[field.name] ?? ''
                    if (field.kind === 'select' && field.values) {
                      return (
                        <div key={field.name}>
                          <label className={EXAM_LABEL_CLASS}>{field.label}</label>
                          <select
                            value={currentValue}
                            onChange={e => handleField(field.name, e.target.value)}
                            disabled={formReadonly}
                            className={EXAM_INPUT_CLASS}
                          >
                            <option value="">— Seleccionar —</option>
                            {field.values.map(v => (
                              <option key={v} value={v}>
                                {getCatalogEnumDisplayLabel(v)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    }

                    return (
                      <div key={field.name}>
                        <label className={EXAM_LABEL_CLASS}>{field.label}</label>
                        <input
                          type="text"
                          value={currentValue}
                          onChange={e => handleField(field.name, e.target.value)}
                          disabled={formReadonly}
                          className={EXAM_INPUT_CLASS}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {hasPositiveEF && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-amber-800">
                      ⚠️ Especifique hallazgos positivos
                    </span>
                    <p className="text-[11px] text-amber-700 mt-0.5 mb-2">
                      Detalle los hallazgos positivos en{' '}
                      <code>test_romberg</code>, <code>signo_bragard</code>,{' '}
                      <code>prueba_finkelstein</code>, <code>signo_tinel</code>,{' '}
                      <code>prueba_phanel</code>, <code>prueba_lasegue</code>.
                    </p>
                    <ClinicalTextarea
                      rows={3}
                      value={form.especifique_positivos ?? ''}
                      onChange={v => handleField('especifique_positivos', v)}
                      disabled={formReadonly}
                      placeholder="Detalle los hallazgos positivos observados..."
                      className="w-full bg-white border border-amber-200 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-60"
                    />
                  </label>
                </div>
              )}

              <ExamSectionFooter
                readonly={formReadonly}
                isBusy={isPending}
                statusMessage={saveError ? `❌ ${saveError}` : saveMsg}
                onPrev={() => requestInnerTabChange('antecedentes')}
                onSaveDraft={() => handleSave(false)}
                onPrimary={() => {
                  const nextTab: InnerTab = hasVariantExtension ? 'extension' : 'impresion'
                  const nextLabel = hasVariantExtension
                    ? examenMedicoVariantLabel(examVariant)
                    : 'Impresión clínica'
                  handleSaveAndAdvanceInner(
                    nextTab,
                    `Exploración Física guardada. Continúa con ${nextLabel}.`,
                  )
                }}
                primaryLabel={`Guardar y continuar → ${
                  hasVariantExtension ? examenMedicoVariantLabel(examVariant) : 'Impresión'
                }`}
              />
            </div>
          )}

          {/* ── Sub-tab extensión corporativa (Flowserve / Sodexo) ───────── */}
          {activeInnerTab === 'extension' && examVariant === 'FLOWSERVE' && (
            <div className="space-y-4">
              <ExamSectionHeader
                icon={Building2}
                title={`Extensión ${examenMedicoVariantLabel(examVariant)}`}
                subtitle="Campos corporativos específicos requeridos por el cliente."
                stepNumber={stepNumberFor('extension')}
                totalSteps={totalSteps}
              />
              <FlowserveExtension
                value={flowserveExt}
                onChange={setFlowserveExt}
                readonly={formReadonly}
              />
              <ExamSectionFooter
                readonly={formReadonly}
                isBusy={isPending}
                statusMessage={saveError ? `❌ ${saveError}` : saveMsg}
                onPrev={() => requestInnerTabChange('exploracion')}
                onSaveDraft={() => handleSave(false)}
                onPrimary={() =>
                  handleSaveAndAdvanceInner(
                    'impresion',
                    `Extensión ${examenMedicoVariantLabel(examVariant)} guardada. Continúa con Impresión clínica.`,
                  )
                }
                primaryLabel="Guardar y continuar → Impresión"
              />
            </div>
          )}

          {activeInnerTab === 'extension' && examVariant === 'SODEXO' && (
            <div className="space-y-4">
              <ExamSectionHeader
                icon={UtensilsCrossed}
                title={`Extensión ${examenMedicoVariantLabel(examVariant)}`}
                subtitle="Formato corporativo Sodexo REG-SO-01 integrado con la captura clínica."
                stepNumber={stepNumberFor('extension')}
                totalSteps={totalSteps}
              />
              <SodexoExtension
                value={sodexoExt}
                onChange={handleSodexoExtChange}
                readonly={formReadonly}
                sodexoPdfUrl={examenMedicoSodexoPdfUrl(eventId)}
                sodexoPreviewApiUrl={examenMedicoSodexoPreviewApiUrl(eventId)}
                showSodexoPdfDownload={
                  shouldShowExamenMedicoPdfCta(aptitud) && hasMedicalVerdict === true
                }
                sodexoPdfPending={Boolean(aptitud) && hasMedicalVerdict !== true}
                validatingViewHref={navigateToValidatingView(eventId)}
                ami={{
                  examForm: {
                    ...form,
                    recomendaciones_clinicas: recomendaciones,
                    aptitud,
                  },
                  antecedentesCaptured,
                  modulo1,
                  somatometry: { ...initSomatometryData, ...vitalsForm, ...somaForm },
                  vitalSigns: { ...vitalsForm },
                  eyeAcuity: { ...initEyeAcuityData, ...agudezaForm },
                  prefilledData,
                  longitudinalData,
                }}
              />
              <ExamSectionFooter
                readonly={formReadonly}
                isBusy={isPending}
                statusMessage={saveError ? `❌ ${saveError}` : saveMsg}
                onPrev={() => requestInnerTabChange('exploracion')}
                onSaveDraft={() => handleSave(false)}
                onPrimary={() =>
                  handleSaveAndAdvanceInner(
                    'impresion',
                    `Extensión ${examenMedicoVariantLabel(examVariant)} guardada. Continúa con Impresión clínica.`,
                  )
                }
                primaryLabel="Guardar y continuar → Impresión"
              />
            </div>
          )}

          {/* ── Sub-tab final: Impresión Diagnóstica y Aptitud ──────────── */}
          {activeInnerTab === 'impresion' && (
            <div className="space-y-4">
              <ExamSectionHeader
                icon={FileCheck}
                title="Impresión clínica y recomendaciones"
                subtitle="Resumen por sistema, impresión diagnóstica, recomendaciones y cierre de captura."
                stepNumber={stepNumberFor('impresion')}
                totalSteps={totalSteps}
              />

              {/* Resumen Clínico por Sistema — ARCH-20260325-09 */}
              <div className={EXAM_CARD_CLASS}>
                <p className={EXAM_CARD_TITLE_CLASS}>Resumen Clínico por Sistema</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {RESUMEN_CLINICO_FIELDS.map(([field, label]) => {
                    const isEstadoNutricional = field === 'estado_nutricional'
                    const isSaludBucal = field === 'salud_bucal'
                    const isAgudezaVisual = field === 'agudeza_visual_resumen'
                    const isPresionArterial = field === 'presion_arterial_resumen'
                    const comboValues = isEstadoNutricional
                      ? ESTADO_NUTRICIONAL_VALUES
                      : isSaludBucal
                        ? SALUD_BUCAL_VALUES
                        : isAgudezaVisual
                          ? AGUDEZA_VISUAL_RESUMEN_VALUES
                          : isPresionArterial
                            ? PRESION_ARTERIAL_RESUMEN_VALUES
                            : null
                    const fieldErr = examSaveErr(field)
                    return (
                      <div key={field}>
                        <label
                          htmlFor={`resumen-clinico-${field}`}
                          className={EXAM_LABEL_CLASS}
                        >
                          {label}
                        </label>
                        {comboValues ? (
                          <select
                            id={`resumen-clinico-${field}`}
                            data-testid={`resumen-clinico-${field}`}
                            value={form[field] ?? ''}
                            onChange={e => handleResumenClinicoField(field, e.target.value)}
                            disabled={formReadonly}
                            className={examFieldRingClass(
                              Boolean(fieldErr),
                              EXAM_INPUT_CLASS,
                            )}
                          >
                            <option value="">—</option>
                            {comboValues.map(v => (
                              <option key={v} value={v}>
                                {getCatalogEnumDisplayLabel(v)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={`resumen-clinico-${field}`}
                            data-testid={`resumen-clinico-${field}`}
                            type="text"
                            value={form[field] ?? ''}
                            onChange={e => handleResumenClinicoField(field, e.target.value)}
                            disabled={formReadonly}
                            className={examFieldRingClass(
                              Boolean(fieldErr),
                              EXAM_INPUT_CLASS,
                            )}
                          />
                        )}
                        {fieldErr && (
                          <p className="text-[11px] text-red-600 mt-1">{fieldErr}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Impresión Diagnóstica */}
              <div className={EXAM_CARD_CLASS}>
                <p className={EXAM_CARD_TITLE_CLASS}>Impresión diagnóstica y seguimiento</p>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-slate-600">
                        Impresión diagnóstica
                      </span>
                      {!formReadonly && impresionDiagnosticaPropuesta.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            impresionDiagnosticaManualRef.current = false
                            const propuesta = impresionDiagnosticaPropuesta.trim()
                            handleField('impresion_diagnostica', propuesta)
                            if (!(form.examen_medico_texto ?? '').trim()) {
                              handleField('examen_medico_texto', propuesta)
                            }
                          }}
                          className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline"
                          title="Generar texto desde antecedentes patológicos SÍ y hallazgos del examen"
                        >
                          ↻ Generar desde antecedentes y examen
                        </button>
                      )}
                    </div>
                    <ClinicalTextarea
                      rows={4}
                      value={form.impresion_diagnostica ?? ''}
                      onChange={v => {
                        impresionDiagnosticaManualRef.current = true
                        handleField('impresion_diagnostica', v)
                      }}
                      disabled={formReadonly}
                      placeholder={
                        impresionDiagnosticaPropuesta.trim()
                          ? 'Se auto-completa al abrir esta pestaña si hay antecedentes patológicos en SÍ (editable).'
                          : 'Opcional: con APP en SÍ se propone texto desde el examen; si no, se completa al guardar.'
                      }
                      className={examFieldRingClass(
                        Boolean(examSaveErr('impresion_diagnostica')),
                        EXAM_TEXTAREA_CLASS,
                      )}
                    />
                    {examSaveErr('impresion_diagnostica') && (
                      <p className="text-[11px] text-red-600 mt-1">
                        {examSaveErr('impresion_diagnostica')}
                      </p>
                    )}
                  </div>

                  <div>
                    <span className={EXAM_LABEL_CLASS}>Restricciones / condicionantes</span>
                    <ClinicalTextarea
                      rows={3}
                      value={form.restricciones ?? ''}
                      onChange={v => handleField('restricciones', v)}
                      disabled={formReadonly}
                      placeholder="Si aplica, detalla las restricciones o condicionantes laborales..."
                      className={EXAM_TEXTAREA_CLASS}
                    />
                  </div>

                  <div>
                    <span className={EXAM_LABEL_CLASS}>Observaciones finales</span>
                    <ClinicalTextarea
                      rows={2}
                      value={form.observaciones_finales ?? ''}
                      onChange={v => handleField('observaciones_finales', v)}
                      disabled={formReadonly}
                      placeholder="Observaciones adicionales para el expediente..."
                      className={EXAM_TEXTAREA_CLASS}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600">
                        Recomendaciones <span className="text-red-500">*</span>
                      </span>
                      {!formReadonly && (
                        <button
                          type="button"
                          onClick={() => {
                            recomendacionesManualRef.current = false
                            const next = buildRecommendationsFromExam(
                              examForHallazgosFromForm(form),
                            )
                            lastAutoRecomendacionesRef.current = next.trim()
                            clearFieldSaveError('recomendaciones_clinicas')
                            setRecomendaciones(next)
                          }}
                          className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline"
                          title="Reemplazar por la lista auto-poblada desde los hallazgos actuales"
                        >
                          ↻ Regenerar desde hallazgos
                        </button>
                      )}
                    </div>
                    <ClinicalTextarea
                      rows={6}
                      value={recomendaciones}
                      onChange={v => {
                        recomendacionesManualRef.current = true
                        clearFieldSaveError('recomendaciones_clinicas')
                        setRecomendaciones(v)
                      }}
                      disabled={formReadonly}
                      placeholder="1.- Recomendación uno. 2.- Recomendación dos. (auto-poblado desde hallazgos)"
                      className={examFieldRingClass(
                        Boolean(examSaveErr('recomendaciones_clinicas')),
                        EXAM_TEXTAREA_CLASS,
                      )}
                    />
                    {examSaveErr('recomendaciones_clinicas') && (
                      <p className="text-[11px] text-red-600">
                        {examSaveErr('recomendaciones_clinicas')}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500">
                      Auto-poblado desde hallazgos del examen (caries, sobrepeso, agudeza visual,
                      presión arterial, etc). Puedes editar, agregar o quitar recomendaciones.
                    </p>
                  </div>
                </div>
              </div>

              {/* Aptitud laboral — decisión de cierre (V3), no de captura del examen */}
              <div className={EXAM_CARD_CLASS}>
                <p className={EXAM_CARD_TITLE_CLASS}>Aptitud laboral (dictamen)</p>
                <p className="text-xs text-slate-500 leading-snug">
                  No forma parte del cierre de captura. Se confirma al{' '}
                  <strong>firmar y emitir dictamen</strong> desde Validación, cuando los estudios
                  estén listos (etapa V3).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {APTITUD_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={formReadonly}
                      onClick={() => handleAptitudSelect(opt.value)}
                      title={opt.value}
                      className={`text-xs font-bold px-3.5 py-2.5 rounded-lg border transition-all text-left break-words ${
                        aptitud === opt.value
                          ? opt.color + ' border-current ring-2 ring-offset-1 ring-current/30'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white disabled:opacity-60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 leading-snug">
                Al guardar y al generar PDFs se usan automáticamente el{' '}
                <strong>nombre, cédula y firma</strong> de tu cuenta (
                <a href="/profile" className="text-teal-700 underline font-medium">
                  Mi perfil
                </a>
                ). No hace falta capturarlos aquí.
              </p>

              {/* Mensajes de resultado */}
              {saveMsg && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 font-medium">
                  {saveMsg}
                </div>
              )}
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium space-y-2.5">
                  <p>❌ {saveError}</p>
                  {incompleteJumpTabs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-red-800">
                        Secciones pendientes:
                      </span>
                      {incompleteJumpTabs.map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            if (tab.kind === 'outer') {
                              requestOuterTabChange(
                                tab.id as 'somatometria' | 'signos_vitales' | 'agudeza_visual',
                              )
                            } else {
                              requestInnerTabChange(tab.id as InnerTab)
                            }
                          }}
                          className="inline-flex items-center rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-bold text-red-800 hover:bg-red-100 transition-colors"
                        >
                          Ir a {tab.label} →
                        </button>
                      ))}
                    </div>
                  )}
                  {Object.keys(saveFieldErrors).length > 0 && (
                    <ul className="text-xs font-normal list-disc pl-4 space-y-0.5">
                      {Object.entries(saveFieldErrors).map(([key, messages]) => (
                        <li key={key}>
                          <span className="font-semibold">{key}</span>: {messages[0]}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {aiWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 font-medium">
                  ⚠️ {aiWarning}
                </div>
              )}

              {shouldShowExamenMedicoPdfCta(aptitud) ? (
                <div className="bg-white border-2 border-teal-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-bold text-teal-800">
                      Reporte de examen médico (aptitud)
                    </p>
                    <p className="text-xs text-slate-600">
                      Este PDF se emite al cerrar el examen. El dictamen general y el ZIP de cierre
                      se habilitan después, en Firma.
                    </p>
                    {hasMedicalVerdict !== true && (
                      <Link
                        href={navigateToValidatingView(eventId)}
                        className="inline-flex text-xs font-bold text-amber-800 underline"
                        data-testid="examen-medico-go-validating-link"
                      >
                        Después del reporte: ir a Firma y emitir dictamen
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <a
                      href={examenMedicoPdfUrl(eventId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="examen-medico-pdf-download-link"
                      data-implementacion="IMPL-FEATURE-20260825-03"
                      data-has-medical-verdict={String(hasMedicalVerdict)}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors whitespace-nowrap text-center"
                    >
                      📄 Reporte de aptitud
                    </a>
                    <a
                      href={examenMedicoFormularioPdfUrl(eventId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="examen-medico-formulario-download-link"
                      className="bg-white hover:bg-teal-50 text-teal-800 border border-teal-600 text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors whitespace-nowrap text-center"
                    >
                      📋 Formulario contestado
                    </a>
                    {shouldShowClinicalClosureZipCta(aptitud, hasMedicalVerdict) && (
                      <a
                        href={clinicalClosureZipUrl(eventId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="clinical-closure-zip-download-link"
                        data-implementacion="IMPL-FEATURE-20260825-04"
                        data-has-medical-verdict={String(hasMedicalVerdict)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors whitespace-nowrap"
                      >
                        📦 ZIP
                      </a>
                    )}
                  </div>
                </div>
              ) : null}

              <ExamSectionFooter
                readonly={formReadonly}
                isBusy={isPending}
                statusMessage={saveMsg}
                onPrev={() =>
                  requestInnerTabChange(hasVariantExtension ? 'extension' : 'exploracion')
                }
                onSaveDraft={() => handleSave(false)}
                onPrimary={!captureClosed ? () => handleSave(true) : undefined}
                primaryLabel={!captureClosed ? '📋 Guardar para revisión' : undefined}
                primaryVariant="emerald"
                primaryDisabled={!recomendaciones.trim()}
                primaryTitle={!recomendaciones.trim() ? 'Ingresa recomendaciones' : undefined}
              />

              {readonlyBanner && (
                <div
                  className={`rounded-xl p-3 text-xs text-center border ${
                    formReadonly
                      ? 'bg-slate-50 border-slate-200 text-slate-400'
                      : 'bg-teal-50 border-teal-200 text-teal-800'
                  }`}
                >
                  {readonlyBanner}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
