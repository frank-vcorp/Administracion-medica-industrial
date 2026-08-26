/**
 * @fileoverview Formulario real del estudio "Examen Médico" dentro de la Papeleta de Estudios.
 * Implementa 4 outer-tabs: Somatometría, Signos Vitales, Agudeza Visual y Examen Médico.
 * Las outer-tabs 1-3 son prerrequisito para acceder a la outer-tab 4 (Examen Médico),
 * que contiene 4 inner-tabs: Antecedentes, Módulo 1, Exploración Física e Impresión/Aptitud.
 * IMPL-20260809-02 (ARCH-20260809-01 v2): 'Antecedentes' es la PRIMERA inner-tab dentro
 * de "Examen Médico" (snapshot por cita en `physicalExamData.antecedentes_captured`,
 * persistido vía `saveExamenMedicoPapeleta`).
 * @id IMPL-20260809-02
 * @spec ARCH-20260809-01 (v2)
 * @intervention ARCH-20260506-06, ARCH-20260325-05, ARCH-20260326-07, ARCH-20260326-10
 */
"use client"

import { useState, useTransition } from "react"
import { saveExamenMedicoPapeleta, updateSomatometria, updateAgudezaVisual } from "@/actions/medical-exam.actions"
import { updateEventTestStatus } from "@/actions/event-test.actions"
// IMPL-20260809-02 (ARCH-20260809-01 v2): "Antecedentes" ya no es outer-tab, ahora es
// PRIMERA sub-pestaña dentro de "Examen Médico" (componente controlado).
import { AntecedentesCaptura } from "@/components/clinical/AntecedentesCaptura"
// IMPL-20260817-01-C1 (ARCH-20260817-01 corte 1): catálogos ZIN para los
// 8 campos de visión + 3 pruebas complementarias en pestaña 3 "Agudeza
// Visual". Ver SPEC §4.1.
// IMPL-20260817-01-C2 (ARCH-20260817-01 corte 2): catálogos ZIN para 13
// combos de Exploración Física + 17 plantillas prellenadas + estado
// nutricional/salud bucal en Resumen Clínico. Ver SPEC §4.2, §4.3.
import {
  VISION_SNELLEN_VALUES,
  REFLEJOS_VALUES,
  CAMPIMETRIA_VALUES,
  TEST_ISHIHARA_VALUES,
  ARCO_MOVILIDAD_VALUES,
  TONO_MUSCULAR_VALUES,
  COORDINACION_VALUES,
  TEST_ADAM_VALUES,
  PRESENCIA_QUISTE_SINOVIAL_VALUES,
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
  PLANTILLAS_EF,
  // IMPL-20260817-07: catálogos ZIN para Módulo 1 (ginecológicos + vacunas).
  // Ver SPEC §4.6.
  AG_IVS_VALUES,
  AG_VSA_VALUES,
  AG_NUMERIC_0_11,
  AG_ABORTO_VALUES,
  VAC_SI_NO_VALUES,
  type PlantillaEfKey,
} from "@/schemas/clinical/exam.schema"
// IMPL-20260817-09-C4 (ARCH-20260817-02 corte 2 DA-7): helper de
// auto-poblamiento para las recomendaciones del dictamen (catalogo
// hallazgo → recomendacion + edicion manual).
import { buildRecommendationsFromExam } from "@/lib/clinical/recommendations"
// IMPL-20260817-11-C1 (ARCH-20260817-02 corte 4 DA-5): preview en vivo de los
// 9 campos auto-poblados, renderizado ARRIBA del selector de aptitud. El medico
// ve primero lo que se va a poblar y despues decide la aptitud.
// Regla explicita de Frank (2026-08-17):
//   "Quiero que se autopoble. Quiero que el medico solo llene lo
//   estrictamente necesario."
import LiveSummaryPreview from "@/components/clinical/LiveSummaryPreview"

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
type InnerTab = 'antecedentes' | 'declarativa' | 'exploracion' | 'impresion'
type M1Tab = 'gine' | 'inmuno'

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

/**
 * IMPL-FEATURE-20260825-03 ronda 4 (DEC-20260825-19 / BR-20260825-20):
 * Decide si el CTA de descarga del PDF consolidado debe mostrarse.
 *
 * Reglas (FEATURE-20260825-03 / SPEC §2 / ADR §R6):
 *   - Visible si y sólo si hay una aptitud médica NO vacía persistida
 *     (state local del componente o `physicalExamData.aptitud`) Y ya
 *     existe `MedicalVerdict` emitido para el Event.
 *   - NO se muestra si falta aptitud (gate ADR R6 / P2-3 — el endpoint
 *     devuelve 409 cuando falta aptitud; no invitamos a un 409).
 *   - NO se muestra si falta `MedicalVerdict` (BR-20260825-20 — la
 *     descarga devolvería 404 "El dictamen aún no ha sido emitido";
 *     ocultamos el CTA para no exponer al médico a un 404).
 *   - Pura y testeable sin DOM. Vive aquí para que cualquier llamada
 *     posterior (bot, enlace, atajo) use la misma lógica.
 */
export function shouldShowExamenMedicoPdfCta(
  aptitud: string | null | undefined,
  hasMedicalVerdict: boolean | null | undefined = false
): boolean {
  const aptitudOk =
    typeof aptitud === 'string' && aptitud.trim().length > 0
  return aptitudOk && hasMedicalVerdict === true
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
  return shouldShowExamenMedicoPdfCta(aptitud, hasMedicalVerdict)
}

interface ExamenMedicoEstudioProps {
  eventId: string
  eventTestId: string
  examData: ExamData
  prefilledData?: Record<string, unknown> | null
  longitudinalData?: Record<string, unknown> | null
  readonly?: boolean
  /** Callback para actualizar estado local en el workspace padre */
  onStatusChange?: (status: string) => void
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

const NO_APLICA = 'NO APLICA'
const SEX_OPTIONS = ['Femenino', 'Masculino'] as const
const LONGITUDINAL_SECTIONS: [string, string][] = [
  ['datos_personales', 'Datos Personales'],
  ['historia_laboral', 'Historia Laboral'],
  ['heredo_familiares', 'Heredo-Familiares'],
  // IMPL-20260809-01 (ARCH-20260809-01): las 2 secciones que el loader antes
  // omitía en `longitudinalData`. Ahora se exponen para que el `<details>`
  // readonly del Módulo 1 muestre las 5 secciones declarativas completas.
  ['no_patologicos', 'No Patológicos'],
  ['patologicos', 'Patológicos'],
]
/**
 * IMPL-20260817-07 — Módulo 1 Ginecológicos → select con catálogo ZIN.
 * Cada campo declara su `kind` para el render correcto:
 *   - `select` → <select> con valores ZIN (8 campos).
 *   - `number` → <input type="number"> con min/max (menarca 0-30).
 *   - `date` → <input type="date"> (FUM, FUP/FUC — texto legacy, sigue
 *     siendo text para no romper fechas DD/MM/YYYY que ya había capturado).
 *   - `text` → input text (exp_mamaria = plantilla prellenada).
 * Mantenemos text para fechas para no invalidar fechas legacy.
 * Ver SPEC §4.6.
 */
type GineKind = 'select' | 'number' | 'date' | 'text'

type GineField = {
  name: string
  label: string
  kind: GineKind
  /** Catálogo ZIN cuando kind === 'select'. */
  values?: readonly (string | number)[]
  /** min/max para kind === 'number'. */
  min?: number
  max?: number
}

const GINE_FIELDS_TYPES: GineField[] = [
  { name: 'm1_gine_menarca', label: 'Menarca', kind: 'number', min: 0, max: 30 },
  { name: 'm1_gine_fum', label: 'FUM', kind: 'date' },
  { name: 'm1_gine_ivs', label: 'IVS', kind: 'select', values: AG_IVS_VALUES },
  { name: 'm1_gine_ritmo', label: 'Ritmo', kind: 'select', values: AG_VSA_VALUES },
  { name: 'm1_gine_gesta', label: 'Gesta', kind: 'select', values: AG_NUMERIC_0_11 },
  { name: 'm1_gine_aborto', label: 'Aborto', kind: 'select', values: AG_ABORTO_VALUES },
  { name: 'm1_gine_parto', label: 'Parto', kind: 'select', values: AG_NUMERIC_0_11 },
  { name: 'm1_gine_cesarea', label: 'Cesárea', kind: 'select', values: AG_NUMERIC_0_11 },
  { name: 'm1_gine_doc', label: 'DOC', kind: 'select', values: AG_VSA_VALUES },
  { name: 'm1_gine_fup_uc', label: 'FUP/FUC', kind: 'date' },
  { name: 'm1_gine_exp_mamaria', label: 'Exp. Mamaria', kind: 'text' },
  { name: 'm1_gine_mpf', label: 'MPF', kind: 'select', values: AG_NUMERIC_0_11 },
]

/**
 * IMPL-20260817-07 — Módulo 1 Vacunas → acordeón Sí/No + 'especifique'.
 * Mismo patrón que Patologicos (commit `80fa3ad`):
 *   - <select> con VAC_SI_NO_VALUES (NEGADO / SI / NO APLICA).
 *   - Si estado === 'SI' Y (focused OR sin especifique) → inputs desplegados.
 *   - Si estado === 'SI' Y tiene especifique Y no focused → resumen colapsado.
 *   - Click en resumen → expande para editar.
 * Ver SPEC §4.6.
 */
const VACUNAS_LIST: { key: string; label: string }[] = [
  { key: 'm1_vac_rubeola', label: 'Rubéola' },
  { key: 'm1_vac_neumococo', label: 'Neumococo' },
  { key: 'm1_vac_sarampion', label: 'Sarampión' },
  { key: 'm1_vac_influenza', label: 'Influenza' },
  { key: 'm1_vac_toxoide', label: 'Toxoide Tetánico' },
  { key: 'm1_vac_hepatitisb', label: 'Hepatitis B' },
  { key: 'm1_vac_otras', label: 'Otras' },
]
const RESUMEN_CLINICO_FIELDS: [string, string][] = [
  ['estado_nutricional', 'Estado Nutricional'],
  ['salud_bucal', 'Salud Bucal'],
  ['agudeza_visual_resumen', 'Agudeza Visual'],
  ['presion_arterial_resumen', 'Presión Arterial'],
]

// ─── Campos de Exploración Física (de ExploracionFisicaSchema) ───────────────
// IMPL-20260817-01-C2: cada campo declara su `kind` para el render correcto.
// - `select` → combo con valores ZIN (13 campos).
// - `plantilla` → input text con defaultValue = PLANTILLAS_EF[name] (17 campos).
// - `text` → input text libre (4 campos: fuerza_muscular_daniels_sup/inf,
//   boca_alineacion, especificar_quiste). Ver SPEC §4.2, §4.3.
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
  { name: "boca_estado", label: "Boca (Estado)", kind: "select", values: SALUD_BUCAL_VALUES },
  { name: "boca_alineacion", label: "Boca (Alineación)", kind: "text" },
  { name: "nariz", label: "Nariz", kind: "plantilla" },
  { name: "faringe", label: "Faringe", kind: "plantilla" },
  { name: "cuello", label: "Cuello", kind: "plantilla" },
  { name: "torax", label: "Tórax", kind: "plantilla" },
  { name: "corazon", label: "Corazón", kind: "plantilla" },
  { name: "campos_pulmonares", label: "Campos Pulmonares", kind: "plantilla" },
  { name: "abdomen", label: "Abdomen", kind: "plantilla" },
  { name: "genitourinario", label: "Genitourinario", kind: "plantilla" },
  { name: "columna_vertebral", label: "Columna Vertebral", kind: "plantilla" },
  { name: "test_adam", label: "Test Adam", kind: "select", values: TEST_ADAM_VALUES },
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
  { name: "presencia_quiste_sinovial", label: "Quiste Sinovial", kind: "select", values: PRESENCIA_QUISTE_SINOVIAL_VALUES },
  { name: "especificar_quiste", label: "Especificar Quiste", kind: "text" },
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ExamenMedicoEstudio({
  eventId,
  eventTestId,
  examData,
  prefilledData,
  longitudinalData,
  readonly = false,
  onStatusChange,
  workerId,
  somatometryEventTestId,
  agudezaEventTestId,
  hasMedicalVerdict = false,
}: ExamenMedicoEstudioProps) {
  const physicalExamData = (examData?.physicalExamData ?? {}) as Record<string, unknown>
  const initSomatometryData = (examData?.somatometryData ?? {}) as Record<string, unknown>
  const initEyeAcuityData = (examData?.eyeAcuityData ?? {}) as Record<string, unknown>

  // ── Estado Examen Médico (pestaña 4 — existente) ──────────────────────────
  // IMPL-20260809-01 rework (QA-20260809-01 I-1): excluir del `form` plano
  // cualquier clave cuyo valor persistido sea un objeto/array (no primitivo),
  // en concreto `antecedentes_captured` (snapshot por cita) y `modulo1`
  // (sub-objeto Módulo 1). Sin este filtro, `String({...})` produce
  // `"[object Object]"` y revienta la validación Zod en `ExamenMedicoCompletoSchema`.
  const [form, setForm] = useState<Record<string, string>>(() => {
    const isPrimitive = (v: unknown) =>
      v === null || v === undefined || typeof v === 'string' ||
      typeof v === 'number' || typeof v === 'boolean'
    return Object.fromEntries(
      Object.entries(physicalExamData).filter(([, v]) => isPrimitive(v))
        .map(([k, v]) => [k, String(v ?? '')])
    )
  })
  const [aptitud, setAptitud] = useState<string>(
    (physicalExamData.aptitud as string) ?? ''
  )
  // IMPL-20260817-09-C4 (ARCH-20260817-02 DA-7): recomendaciones
  // auto-pobladas desde hallazgos. Lazy init desde el snapshot persistido;
  // el medico puede editar/sobrescribir libremente. Boton "Regenerar
  // desde hallazgos" para volver al auto-poblado en cualquier momento.
  const [recomendaciones, setRecomendaciones] = useState<string>(() =>
    buildRecommendationsFromExam({
      estado_nutricional: (physicalExamData.estado_nutricional as string) ?? null,
      agudeza_visual_resumen: (physicalExamData.agudeza_visual_resumen as string) ?? null,
      salud_bucal: (physicalExamData.salud_bucal as string) ?? null,
      presion_arterial_resumen: (physicalExamData.presion_arterial_resumen as string) ?? null,
      examen_medico_texto: (physicalExamData.impresion_diagnostica as string) ?? null,
    })
  )
  // IMPL-20260809-02: default 'antecedentes' (era 'declarativa' en v1) — la primera
  // sub-pestaña visible al abrir Examen Médico es Antecedentes.
  const [activeInnerTab, setActiveInnerTab] = useState<InnerTab>('antecedentes')
  const [isPending, startTransition] = useTransition()
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [aiWarning, setAiWarning] = useState('')

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
  const [m1Tab, setM1Tab] = useState<M1Tab>('inmuno')
  // IMPL-20260817-07: acordeón Vacunas — campo enfocado (mismo patrón que
  // `focusedPatologiaField` de AntecedentesCaptura). Si es null, todos los
  // acordeones con contenido se muestran colapsados.
  const [focusedVacuna, setFocusedVacuna] = useState<string | null>(null)

  // IMPL-20260809-02 (ARCH-20260809-01 v2): estado levantado de `antecedentes_captured`.
  // Mismo patrón que `modulo1`: se inicializa desde `physicalExamData.antecedentes_captured`
  // (snapshot persistido) con fallback a `{}` cuando aún no hay captura. Se incluye en
  // `buildPayload()` para persistir junto con el resto del examen vía
  // `saveExamenMedicoPapeleta`.
  const [antecedentesCaptured, setAntecedentesCaptured] = useState<Record<string, unknown>>(() => {
    const existing = physicalExamData.antecedentes_captured
    return existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}
  })

  // ── Estado Somatometría (pestaña 1) ───────────────────────────────────────
  const [somaForm, setSomaForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initSomatometryData).map(([k, v]) => [k, String(v ?? '')])
    )
  )
  const [isSavingSoma, setIsSavingSoma] = useState(false)
  const [somaSaveMsg, setSomaSaveMsg] = useState('')
  // "terminada" si el dato ya existe en DB o fue guardado en esta sesión
  const [somaCompleted, setSomaCompleted] = useState<boolean>(
    !!(initSomatometryData.peso_kg || initSomatometryData.talla_m)
  )

  // ── Estado Signos Vitales (pestaña 2) ─────────────────────────────────────
  // Los campos de vitales viven en somatometryData — se inician desde los mismos datos
  const [vitalsForm, setVitalsForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initSomatometryData).map(([k, v]) => [k, String(v ?? '')])
    )
  )
  const [isSavingVitals, setIsSavingVitals] = useState(false)
  const [vitalsSaveMsg, setVitalsSaveMsg] = useState('')
  const [vitalsCompleted, setVitalsCompleted] = useState<boolean>(
    !!(initSomatometryData.ta_sistolica || initSomatometryData.fc_min)
  )

  // ── Estado Agudeza Visual (pestaña 3) ─────────────────────────────────────
  const [agudezaForm, setAgudezaForm] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(VISUAL_FIELDS_NAMES.map(f => [f, NO_APLICA])),
    reflejos: 'PRESENTES Y NORMOREFLECTICOS',
    campimetria: '',
    test_ishihara: '',
    ...Object.fromEntries(
      Object.entries(initEyeAcuityData).map(([k, v]) => [k, String(v ?? '')])
    ),
  }))
  const [isSavingAgudeza, setIsSavingAgudeza] = useState(false)
  const [agudezaSaveMsg, setAgudezaSaveMsg] = useState('')
  const [agudezaCompleted, setAgudezaCompleted] = useState<boolean>(
    Object.keys(initEyeAcuityData).length > 0
  )

  // ── Pestaña activa externa (1-4) ──────────────────────────────────────────
  const [outerTab, setOuterTab] = useState<OuterTab>('somatometria')

  // ── Bloqueo de pestaña 4 ─────────────────────────────────────────────────
  const canAccessExamen = somaCompleted && vitalsCompleted && agudezaCompleted

  // ── Cálculos derivados Somatometría ───────────────────────────────────────
  const peso = parseFloat(somaForm.peso_kg) || 0
  const talla = parseFloat(somaForm.talla_m) || 0
  const imc = peso > 0 && talla > 0 ? (peso / (talla * talla)).toFixed(2) : '0.00'
  let complexion = 'NORMAL'
  if (parseFloat(imc) > 29.9) complexion = 'OBESIDAD'
  else if (parseFloat(imc) > 24.9) complexion = 'SOBREPESO'
  else if (parseFloat(imc) < 18.5 && parseFloat(imc) > 0) complexion = 'BAJO PESO'

  // ── Indicadores de completitud para ExamenMedico (pestaña 4) ─────────────
  const hasPhysicalExam = Object.keys(physicalExamData).some(k => physicalExamData[k] !== null && physicalExamData[k] !== '')
  const hasAptitud = !!physicalExamData.aptitud || !!physicalExamData.impresion_diagnostica
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
    return typeof v === 'string' && v.toUpperCase().includes('POSITIVO')
  })

  const longitudinalReference = prefilledData ?? longitudinalData ?? null
  const hasLongitudinalReference = !!longitudinalReference && Object.keys(longitudinalReference).length > 0
  const longitudinalReferenceLabel = prefilledData
    ? 'Snapshot del portal disponible abajo.'
    : 'Resumen longitudinal maestro disponible abajo.'

  // IMPL-20260809-01 (ARCH-20260809-01): indicador de completitud para la
  // outer-tab "Antecedentes" — true si hay al menos un campo no vacío en
  // el snapshot `antecedentes_captured` previamente persistido.
  const capturedAntecedentes = physicalExamData.antecedentes_captured as
    | Record<string, unknown>
    | undefined
  const hasAntecedentes = (() => {
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

  // IMPL-20260809-02 (ARCH-20260809-01 v2): inner-tabs reordenadas — 'antecedentes' es
  // la PRIMERA sub-pestaña dentro de "Examen Médico", seguida de Módulo 1, Exploración
  // Física e Impresión/Aptitud.
  const innerTabs: { id: InnerTab; label: string; icon: string; done: boolean }[] = [
    { id: 'antecedentes', label: 'Antecedentes', icon: '🩺', done: hasAntecedentes },
    { id: 'declarativa', label: 'Módulo 1', icon: '📋', done: hasM1 },
    { id: 'exploracion', label: 'Exploración Física', icon: '🩻', done: hasPhysicalExam },
    { id: 'impresion', label: 'Impresión y Aptitud', icon: '✅', done: hasAptitud },
  ]

  // ── Handlers ──────────────────────────────────────────────────────────────
  function setM1Field(key: string, value: string) {
    setModulo1(prev => ({ ...prev, [key]: value }))
  }
  function handleField(name: string, value: string) {
    setForm(prev => ({ ...prev, [name]: value }))
  }
  function buildPayload() {
    // IMPL-20260809-02 (ARCH-20260809-01 v2): revert I-1. `antecedentes_captured`
    // ahora es estado levantado al padre y SE INCLUYE en el payload (objeto, no
    // string). La persistencia es vía `saveExamenMedicoPapeleta` (full-replace),
    // igual que `modulo1`. El estado `form` plano sigue filtrando no-primitivos
    // (defensa contra `String({...})` = `"[object Object]"`); `antecedentesCaptured`
    // vive en estado separado y se inyecta directamente.
    return {
      ...form,
      aptitud: aptitud || undefined,
      modulo1,
      antecedentes_captured: antecedentesCaptured,
    }
  }

  async function handleSaveSoma(markComplete: boolean) {
    setIsSavingSoma(true)
    setSomaSaveMsg('')
    const payload = { ...somaForm, ...vitalsForm, imc: parseFloat(imc), complexion }
    const res = await updateSomatometria(eventId, payload)
    if (res.success) {
      setSomaSaveMsg(markComplete ? '🏁 Somatometría completada.' : '✅ Datos guardados.')
      setSomaCompleted(true)
      if (somatometryEventTestId) {
        const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
        await updateEventTestStatus(
          somatometryEventTestId,
          newStatus as Parameters<typeof updateEventTestStatus>[1],
          eventId
        )
      }
    } else {
      setSomaSaveMsg('❌ Error: ' + (res.error ?? 'Error al guardar'))
    }
    setIsSavingSoma(false)
  }

  async function handleSaveVitals(markComplete: boolean) {
    setIsSavingVitals(true)
    setVitalsSaveMsg('')
    // Vitales se guardan junto con datos de soma (merge en somatometryData)
    const currentSoma = { ...somaForm }
    const payload = { ...currentSoma, ...vitalsForm, imc: parseFloat(imc), complexion }
    const res = await updateSomatometria(eventId, payload)
    if (res.success) {
      setVitalsSaveMsg(markComplete ? '🏁 Signos Vitales completados.' : '✅ Datos guardados.')
      setVitalsCompleted(true)
      if (somatometryEventTestId) {
        const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
        await updateEventTestStatus(
          somatometryEventTestId,
          newStatus as Parameters<typeof updateEventTestStatus>[1],
          eventId
        )
      }
    } else {
      setVitalsSaveMsg('❌ Error: ' + (res.error ?? 'Error al guardar'))
    }
    setIsSavingVitals(false)
  }

  async function handleSaveAgudeza(markComplete: boolean) {
    setIsSavingAgudeza(true)
    setAgudezaSaveMsg('')
    const res = await updateAgudezaVisual(eventId, agudezaForm)
    if (res.success) {
      setAgudezaSaveMsg(markComplete ? '🏁 Agudeza Visual completada.' : '✅ Datos guardados.')
      setAgudezaCompleted(true)
      if (agudezaEventTestId) {
        const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
        await updateEventTestStatus(
          agudezaEventTestId,
          newStatus as Parameters<typeof updateEventTestStatus>[1],
          eventId
        )
      }
    } else {
      setAgudezaSaveMsg('❌ Error: ' + (res.error ?? 'Error al guardar'))
    }
    setIsSavingAgudeza(false)
  }

  function handleSave(markComplete: boolean) {
    setSaveMsg('')
    setSaveError('')
    setAiWarning('')
    startTransition(async () => {
      const payload = buildPayload()
      const res = await saveExamenMedicoPapeleta(eventId, eventTestId, payload, markComplete)
      if (res.success) {
        // IMPL-FEATURE-20260825-03 ronda 4 (DEC-20260825-19 / FND-20260825-22):
        // cuando se marca como completado, el Event pasa a `VALIDATING` y
        // se muestra el flujo "Firmar y Emitir Dictamen" en el workspace.
        // Cuando es sólo borrador, NO tocamos el Event (res.status === null).
        setSaveMsg(
          markComplete
            ? '🏁 Examen Médico completado. Procede a firmar y emitir el dictamen general.'
            : '✅ Borrador guardado.',
        )
        if (res.aiWarning) {
          setAiWarning(`La captura clínica se guardó, pero la IA no pudo generar prediagnóstico: ${res.aiWarning}`)
        }
        // Notificamos al padre el nuevo studyStatus siempre (el Event
        // status sólo si cambió — null en borrador).
        onStatusChange?.(res.studyStatus ?? (markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'))
      } else {
        setSaveError(res.error ?? 'Error al guardar')
      }
    })
  }

  // ── Pestañas externas ─────────────────────────────────────────────────────
  // IMPL-20260809-02 (ARCH-20260809-01 v2): revert. outerTabs vuelve a 4 entradas
  // (estado pre-v1). 'antecedentes' ahora vive como sub-pestaña dentro de
  // "Examen Médico" (innerTabs, no outerTabs).
  const outerTabs: { id: OuterTab; label: string; icon: string; done: boolean; locked: boolean }[] = [
    { id: 'somatometria', label: 'Somatometría', icon: '⚖️', done: somaCompleted, locked: false },
    { id: 'signos_vitales', label: 'Signos Vitales', icon: '💓', done: vitalsCompleted, locked: false },
    { id: 'agudeza_visual', label: 'Agudeza Visual', icon: '👁️', done: agudezaCompleted, locked: false },
    { id: 'examen_medico', label: 'Examen Médico', icon: '🩺', done: hasAptitud, locked: !canAccessExamen },
  ]
  const modulo1Tabs: [M1Tab, string, string][] = [
    ...(modulo1['m1_sexo'] === 'Femenino' ? [['gine', '♀️', 'Ginecológicos'] as [M1Tab, string, string]] : []),
    ['inmuno', '💉', 'Inmunizaciones'],
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Pestañas externas (1-4) ────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {outerTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.locked) return
              setOuterTab(tab.id)
            }}
            disabled={tab.locked}
            title={tab.locked ? 'Completa Somatometría, Signos Vitales y Agudeza Visual primero' : undefined}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-1 justify-center ${
              outerTab === tab.id
                ? 'bg-white shadow text-teal-700'
                : tab.locked
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.done && !tab.locked && <span className="text-emerald-500 text-[10px]">●</span>}
            {tab.locked && <span className="text-slate-300 text-[10px]">🔒</span>}
          </button>
        ))}
      </div>

      {/* Banner de bloqueo visible cuando el médico intenta ir a Examen Médico sin completar prereqs.
          IMPL-20260809-02 (ARCH-20260809-01 v2): revert I-4. La condición vuelve
          a la original — ya no hay outer-tab 'antecedentes' que excluir. */}
      {outerTab !== 'examen_medico' && !canAccessExamen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
          <span className="text-amber-500 text-sm mt-0.5">🔒</span>
          <p className="text-xs text-amber-800">
            <strong>Examen Médico bloqueado.</strong> Completa y guarda{' '}
            {[!somaCompleted && 'Somatometría', !vitalsCompleted && 'Signos Vitales', !agudezaCompleted && 'Agudeza Visual']
              .filter(Boolean)
              .join(', ')}{' '}
            para habilitar la pestaña 4.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 1: SOMATOMETRÍA                                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'somatometria' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5">
            <span className="text-teal-600">⚖️</span>
            <p className="text-xs font-bold text-teal-800">Somatometría — Peso, Talla e IMC</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Peso (KG)</label>
              <input
                type="number" step="0.1" min={0} max={500}
                value={somaForm.peso_kg || ''}
                onChange={e => setSomaForm(prev => ({ ...prev, peso_kg: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-lg font-mono placeholder-slate-300 disabled:opacity-60"
                placeholder="Ej: 75.5"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Talla (Metros)</label>
              <input
                type="number" step="0.01" min={0} max={3}
                value={somaForm.talla_m || ''}
                onChange={e => setSomaForm(prev => ({ ...prev, talla_m: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-lg font-mono placeholder-slate-300 disabled:opacity-60"
                placeholder="Ej: 1.75"
              />
            </div>
            <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">IMC Calculado</p>
                <div className="text-3xl font-black text-slate-700">{imc}</div>
              </div>
              <div className={`px-4 py-2 rounded-lg font-bold text-sm ${
                complexion === 'NORMAL' ? 'bg-green-100 text-green-700' :
                complexion === 'SOBREPESO' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              }`}>
                {complexion}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3 flex-wrap">
            <p className="text-sm font-medium text-slate-500">{somaSaveMsg}</p>
            {!readonly && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveSoma(false)}
                  disabled={isSavingSoma}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingSoma ? 'Guardando...' : 'Guardar borrador'}
                </button>
                <button
                  onClick={() => handleSaveSoma(true)}
                  disabled={isSavingSoma}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-teal-200 transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingSoma ? 'Guardando...' : '✓ Completar Somatometría'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 2: SIGNOS VITALES                                     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'signos_vitales' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
            <span className="text-rose-600">💓</span>
            <p className="text-xs font-bold text-rose-800">Signos Vitales — Tensión Arterial, FC, Temperatura y Perímetros</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-2">TENSIÓN ARTERIAL (Sist / Diast)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={300}
                  value={vitalsForm.ta_sistolica || ''}
                  onChange={e => setVitalsForm(prev => ({ ...prev, ta_sistolica: e.target.value }))}
                  disabled={readonly}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 font-mono text-center disabled:opacity-60"
                  placeholder="120"
                />
                <span className="text-slate-400 font-bold text-xl">/</span>
                <input
                  type="number" min={0} max={200}
                  value={vitalsForm.ta_diastolica || ''}
                  onChange={e => setVitalsForm(prev => ({ ...prev, ta_diastolica: e.target.value }))}
                  disabled={readonly}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 font-mono text-center disabled:opacity-60"
                  placeholder="80"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Frec. Cardiaca</label>
              <input
                type="number" min={0} max={300}
                value={vitalsForm.fc_min || ''}
                onChange={e => setVitalsForm(prev => ({ ...prev, fc_min: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-mono disabled:opacity-60"
                placeholder="BPM"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Temperatura</label>
              <input
                type="number" step="0.1" min={30} max={45}
                value={vitalsForm.temperatura || ''}
                onChange={e => setVitalsForm(prev => ({ ...prev, temperatura: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-mono disabled:opacity-60"
                placeholder="°C"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Frec. Respiratoria</label>
              <input
                type="number" min={0} max={80}
                value={vitalsForm.fr_min || ''}
                onChange={e => setVitalsForm(prev => ({ ...prev, fr_min: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-mono disabled:opacity-60"
                placeholder="RPM"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Cintura (cm)</label>
              <input
                type="number" step="0.1" min={0} max={300}
                value={vitalsForm.perimetro_cintura || ''}
                onChange={e => setVitalsForm(prev => ({ ...prev, perimetro_cintura: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-mono disabled:opacity-60"
                placeholder="cm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Cadera (cm)</label>
              <input
                type="number" step="0.1" min={0} max={300}
                value={vitalsForm.perimetro_cadera || ''}
                onChange={e => setVitalsForm(prev => ({ ...prev, perimetro_cadera: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-mono disabled:opacity-60"
                placeholder="cm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3 flex-wrap">
            <p className="text-sm font-medium text-slate-500">{vitalsSaveMsg}</p>
            {!readonly && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveVitals(false)}
                  disabled={isSavingVitals}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingVitals ? 'Guardando...' : 'Guardar borrador'}
                </button>
                <button
                  onClick={() => handleSaveVitals(true)}
                  disabled={isSavingVitals}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-rose-200 transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingVitals ? 'Guardando...' : '✓ Completar Signos Vitales'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 3: AGUDEZA VISUAL                                     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'agudeza_visual' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
            <span className="text-indigo-600">👁️</span>
            <p className="text-xs font-bold text-indigo-800">Agudeza Visual — Campo Visual y Pruebas Complementarias</p>
          </div>

          {/* Campo Visual */}
          <div>
            <h4 className="text-sm font-bold text-slate-600 mb-3 uppercase border-b pb-2">Campo Visual</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {VISUAL_FIELDS.map(f => (
                <div key={f.name}>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">{f.label}</label>
                  <select
                    value={agudezaForm[f.name] || NO_APLICA}
                    onChange={e => setAgudezaForm(prev => ({ ...prev, [f.name]: e.target.value }))}
                    disabled={readonly}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm disabled:opacity-60"
                  >
                    {VISION_SNELLEN_VALUES.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Pruebas Complementarias */}
          <div>
            <h4 className="text-sm font-bold text-slate-600 mb-3 uppercase border-b pb-2">Pruebas Complementarias</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                { name: 'campimetria', label: 'Campimetría', options: CAMPIMETRIA_VALUES, placeholder: true },
                { name: 'test_ishihara', label: 'Test Ishihara', options: TEST_ISHIHARA_VALUES, placeholder: true },
                { name: 'reflejos', label: 'Reflejos', options: REFLEJOS_VALUES, placeholder: false },
              ] as { name: string; label: string; options: readonly string[]; placeholder: boolean }[]).map(({ name, label, options, placeholder }) => (
                <div key={name}>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">{label}</label>
                  <select
                    value={agudezaForm[name] || (placeholder ? '' : options[0])}
                    onChange={e => setAgudezaForm(prev => ({ ...prev, [name]: e.target.value }))}
                    disabled={readonly}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
                  >
                    {placeholder && <option value="">SELECCIONAR</option>}
                    {options.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3 flex-wrap">
            <p className="text-sm font-medium text-slate-500">{agudezaSaveMsg}</p>
            {!readonly && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveAgudeza(false)}
                  disabled={isSavingAgudeza}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingAgudeza ? 'Guardando...' : 'Guardar borrador'}
                </button>
                <button
                  onClick={() => handleSaveAgudeza(true)}
                  disabled={isSavingAgudeza}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingAgudeza ? 'Guardando...' : '✓ Completar Agudeza Visual'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 4: EXAMEN MÉDICO (bloqueada si no completan 1-3)      */}
      {/* IMPL-20260809-02 (ARCH-20260809-01 v2): 'antecedentes' ya no es */}
      {/* outer-tab; ahora es primera inner-tab dentro de esta pestaña.   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'examen_medico' && !canAccessExamen && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center space-y-3">
          <div className="text-4xl">🔒</div>
          <p className="text-base font-bold text-amber-800">Examen Médico bloqueado</p>
          <p className="text-sm text-amber-700">
            Para acceder a esta sección debes completar primero:
          </p>
          <ul className="text-sm text-amber-700 space-y-1">
            {!somaCompleted && (
              <li>
                <button onClick={() => setOuterTab('somatometria')} className="underline font-semibold hover:text-amber-900">
                  ⚖️ Somatometría
                </button>
              </li>
            )}
            {!vitalsCompleted && (
              <li>
                <button onClick={() => setOuterTab('signos_vitales')} className="underline font-semibold hover:text-amber-900">
                  💓 Signos Vitales
                </button>
              </li>
            )}
            {!agudezaCompleted && (
              <li>
                <button onClick={() => setOuterTab('agudeza_visual')} className="underline font-semibold hover:text-amber-900">
                  👁️ Agudeza Visual
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      {outerTab === 'examen_medico' && canAccessExamen && (
        <div className="space-y-4">
          {/* Sub-tabs internos del Examen Médico */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
            {innerTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveInnerTab(tab.id)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-1 justify-center ${
                  activeInnerTab === tab.id
                    ? 'bg-white shadow text-teal-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.done && <span className="text-emerald-500 text-[10px]">●</span>}
              </button>
            ))}
          </div>

          {/* ── Sub-tab 1: Antecedentes (snapshot por cita — IMPL-20260809-02) ── */}
          {activeInnerTab === 'antecedentes' && (
            <AntecedentesCaptura
              value={antecedentesCaptured}
              onChange={setAntecedentesCaptured}
              initialProvenance={
                (physicalExamData.antecedentes_captured as
                  | { _provenance?: Record<string, unknown> }
                  | undefined)?._provenance as
                  | Parameters<typeof AntecedentesCaptura>[0]['initialProvenance']
                  | undefined
              }
              workerId={workerId}
              readonly={readonly}
              // IMPL-20260809-03 — affordance UX: saltar a Módulo 1
              // (SPEC ARCH-20260809-01 v2 §6.9)
              onContinue={() => setActiveInnerTab('declarativa')}
            />
          )}

          {/* ── Sub-tab 2: Módulo 1 — Cuestionario del Paciente ── */}
          {activeInnerTab === 'declarativa' && (
        <div className="space-y-3">
          {/* Banner info */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
            <span className="text-teal-600 text-sm mt-0.5">📋</span>
            <p className="text-xs text-teal-800">
              <strong>Módulo 1 — Cuestionario del Paciente.</strong> Captura in-situ dentro del estudio, sin depender del portal público.
              {prefilledData && (
                <span className="ml-1 text-emerald-700 font-semibold">
                  ✓ Snapshot del portal disponible — datos enviados por el trabajador antes de la cita.
                </span>
              )}
            </p>
          </div>

          {/* Sexo — necesario para condicional ginecológicos */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Sexo</span>
            <div className="flex gap-2">
                {SEX_OPTIONS.map(opt => (
                <button
                  key={opt}
                  disabled={readonly}
                  onClick={() => setM1Field('m1_sexo', opt)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg border-2 transition-colors ${
                    modulo1['m1_sexo'] === opt
                      ? 'bg-teal-100 border-teal-400 text-teal-800'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >{opt}</button>
              ))}
            </div>
          </div>

          {/* ARCH-20260326-06: Referencia al snapshot longitudinal + CTA al Historial Clínico maestro */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="text-blue-500 text-base mt-0.5">📋</span>
                <div>
                  <p className="text-xs font-bold text-blue-800">
                    Datos longitudinales — ahora en Historial Clínico
                  </p>
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    Datos Personales, Historia Laboral, Heredo-Familiares, Patológicos y No Patológicos
                    se editan desde el Historial Clínico del trabajador.
                    {hasLongitudinalReference && <span className="font-semibold"> {longitudinalReferenceLabel}</span>}
                  </p>
                </div>
              </div>
              {workerId && (
                <a
                  href={`/history/${workerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Abrir Historial →
                </a>
              )}
            </div>
            {/* ARCH-20260326-10: Sin snapshot → mensaje de ausencia; con snapshot → panel único (no duplicado) */}
            {!hasLongitudinalReference && (
              <div className="px-4 pb-3 pt-1 border-t border-blue-100">
                <p className="text-[10px] text-blue-500 italic">
                  Sin referencia longitudinal embebida para esta cita. Consulta el Historial Clínico para ver los datos actualizados.
                </p>
              </div>
            )}
            {hasLongitudinalReference && (
              <details className="border-t border-blue-200">
                <summary className="px-4 py-2 cursor-pointer text-[10px] font-bold text-blue-700 select-none">
                  {prefilledData
                    ? 'Ver snapshot del portal (datos declarados por el trabajador antes de esta cita — sólo referencia)'
                    : 'Ver resumen longitudinal maestro (datos persistentes del Historial Clínico)'}
                </summary>
                <div className="px-4 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {LONGITUDINAL_SECTIONS.map(([sKey, sLabel]) => {
                    const section = longitudinalReference[sKey] as Record<string, unknown> | undefined
                    if (!section || typeof section !== 'object') return null
                    const entries = Object.entries(section).filter(([, v]) => v !== undefined && v !== '' && v !== null)
                    if (!entries.length) return null
                    return (
                      <div key={sKey} className="col-span-full">
                        <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mb-1">{sLabel}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                          {entries.map(([k, v]) => (
                            <div key={k} className="bg-white/70 rounded px-2 py-1">
                              <p className="text-[9px] text-blue-400 uppercase">{k.replace(/_/g, ' ')}</p>
                              <p className="text-[10px] text-blue-900 font-semibold">{String(v)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
            )}
          </div>

          {/* Sub-tabs de Módulo 1 — solo antecedentes clínicos de la cita */}
          <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1">
              {modulo1Tabs.map(([id, icon, lbl]) => (
              <button
                key={id}
                  onClick={() => setM1Tab(id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors flex-1 justify-center ${
                  m1Tab === id ? 'bg-white shadow text-teal-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{icon}</span>
                <span className="hidden sm:inline">{lbl}</span>
              </button>
            ))}
          </div>

          {/* GINE: Ginecológicos (solo si m1_sexo === Femenino) */}
          {m1Tab === 'gine' && modulo1['m1_sexo'] === 'Femenino' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Antecedentes Ginecológicos</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* IMPL-20260817-07: 9 ginecológicos a <select> con catálogo ZIN
                    + menarca a input numérico 0-30. Mantener fechas y
                    exp_mamaria como texto libre. Ver SPEC §4.6. */}
                {GINE_FIELDS_TYPES.map(field => {
                  const currentValue = modulo1[field.name] ?? ''
                  const baseInputClass = "w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none disabled:opacity-60"
                  if (field.kind === 'select' && field.values) {
                    // DA-1: si el valor legacy no está en el catálogo, mostrar
                    // opción "— otro (legacy) —" para que el médico lo vea
                    // y pueda re-seleccionar sin perderlo.
                    const isLegacy = currentValue !== '' && !field.values.includes(currentValue as never)
                    return (
                      <div key={field.name}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</label>
                        <select
                          value={isLegacy ? '__legacy__' : currentValue}
                          onChange={e => {
                            if (e.target.value === '__legacy__') return // no-op
                            setM1Field(field.name, e.target.value)
                          }}
                          disabled={readonly}
                          className={baseInputClass}
                        >
                          <option value="">—</option>
                          {isLegacy && (
                            <option value="__legacy__">{currentValue} (legacy)</option>
                          )}
                          {field.values.map(v => (
                            <option key={String(v)} value={String(v)}>{String(v)}</option>
                          ))}
                        </select>
                      </div>
                    )
                  }
                  if (field.kind === 'number') {
                    return (
                      <div key={field.name}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</label>
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          value={currentValue}
                          onChange={e => setM1Field(field.name, e.target.value)}
                          disabled={readonly}
                          className={baseInputClass}
                        />
                      </div>
                    )
                  }
                  if (field.kind === 'date') {
                    return (
                      <div key={field.name}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</label>
                        <input
                          type="text"
                          value={currentValue}
                          onChange={e => setM1Field(field.name, e.target.value)}
                          disabled={readonly}
                          placeholder="DD/MM/AAAA"
                          className={baseInputClass}
                        />
                      </div>
                    )
                  }
                  // text
                  return (
                    <div key={field.name}>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</label>
                      <input
                        type="text"
                        value={currentValue}
                        onChange={e => setM1Field(field.name, e.target.value)}
                        disabled={readonly}
                        className={baseInputClass}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">VSA</label>
                <button onClick={() => setM1Field('m1_gine_vsa', modulo1['m1_gine_vsa'] === 'SI' ? 'NO' : 'SI')} disabled={readonly}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border-2 ${modulo1['m1_gine_vsa'] === 'SI' ? 'bg-teal-100 border-teal-400 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  {modulo1['m1_gine_vsa'] || 'NO'}
                </button>
              </div>
            </div>
          )}

          {/* INMUNO: Inmunizaciones */}
          {m1Tab === 'inmuno' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inmunizaciones (reportadas por el paciente)</p>
              {/* IMPL-20260817-07: acordeón Sí/No + 'especifique' para 7 vacunas.
                  Mismo patrón que Patologicos (commit `80fa3ad`). Ver SPEC §4.6. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {VACUNAS_LIST.map(({ key, label }) => {
                  const estado = (modulo1[key] ?? 'NEGADO') as
                    | (typeof VAC_SI_NO_VALUES)[number]
                    | string
                  const especifiqueKey = `${key}_especifique`
                  const especifique = modulo1[especifiqueKey] ?? ''
                  const isFocused = focusedVacuna === key
                  const hasContent = Boolean(especifique.trim())
                  const showInputs = estado === 'SI' && (isFocused || !hasContent)
                  const showSummary = estado === 'SI' && !showInputs
                  const baseInputClass = "w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                  return (
                    <div key={key} className="border border-slate-100 rounded-lg p-2 bg-white">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase">{label}</label>
                      <select
                        value={estado}
                        onChange={e => {
                          setM1Field(key, e.target.value)
                          if (e.target.value === 'SI') {
                            setFocusedVacuna(key)
                          } else if (focusedVacuna === key) {
                            setFocusedVacuna(null)
                          }
                        }}
                        disabled={readonly}
                        className={`w-full text-xs px-2 py-1 border rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60 mt-1 ${
                          estado === 'SI'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : estado === 'NO APLICA'
                              ? 'border-slate-200 bg-slate-50 text-slate-500'
                              : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        {VAC_SI_NO_VALUES.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {showSummary && (
                        <button
                          type="button"
                          onClick={() => setFocusedVacuna(key)}
                          className="w-full text-left mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs hover:bg-emerald-100 transition-colors"
                        >
                          <div className="flex items-center gap-1 font-medium text-emerald-800 mb-1">
                            <span>✓</span>
                            <span>{label}</span>
                            <span className="text-emerald-600 ml-auto text-[10px]">click para editar</span>
                          </div>
                          <div className="text-slate-600">
                            <p><span className="font-medium">Especificación:</span> {especifique || '—'}</p>
                          </div>
                        </button>
                      )}
                      {showInputs && (
                        <div className="mt-2 space-y-1 p-2 bg-slate-50 rounded border border-slate-100">
                          <label className="block text-[9px] font-medium text-slate-500 uppercase">
                            Dosis / Fecha
                          </label>
                          <input
                            type="text"
                            value={especifique}
                            onChange={e => setM1Field(especifiqueKey, e.target.value)}
                            disabled={readonly}
                            placeholder="ej: 2 dosis, 2023"
                            maxLength={200}
                            className={baseInputClass}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Próxima Dosis / Esquema Completo</label>
                <input type="text" value={modulo1['m1_vac_proxima_dosis'] ?? ''} onChange={e => setM1Field('m1_vac_proxima_dosis', e.target.value)} disabled={readonly}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" />
              </div>
            </div>
          )}

          {/* Nota resumen del médico — siempre visible */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nota del médico — resumen de antecedentes</span>
              <textarea rows={3} value={form.antecedentes_medico ?? ''} onChange={e => handleField('antecedentes_medico', e.target.value)} disabled={readonly}
                placeholder="Resumen de antecedentes relevantes para el expediente..."
                className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60" />
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setActiveInnerTab('exploracion')}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
              Continuar → Exploración
            </button>
          </div>
        </div>
      )}

      {/* ── Sub-tab 3: Exploración Física ──────────────────────────────── */}
          {activeInnerTab === 'exploracion' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Hallazgos por aparato y sistema
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {EXPLORACION_FIELDS.map(field => {
                // IMPL-20260817-01-C2: render condicional por `kind`.
                // - `select` → <select> con valores ZIN (DA-1).
                // - `plantilla` → <input> con defaultValue = PLANTILLAS_EF[name],
                //   texto libre editable (Frank: "lo copia igualito").
                // - `text` → <input> libre (casos especiales).
                const currentValue = form[field.name] ?? ''
                if (field.kind === 'select' && field.values) {
                  return (
                    <div key={field.name}>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                        {field.label}
                      </label>
                      <select
                        value={currentValue}
                        onChange={e => handleField(field.name, e.target.value)}
                        disabled={readonly}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                      >
                        <option value="">— Seleccionar —</option>
                        {field.values.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  )
                }
                // `plantilla` o `text` → input text.
                const isPlantilla = field.kind === 'plantilla'
                const plantilla = isPlantilla
                  ? PLANTILLAS_EF[field.name as PlantillaEfKey]
                  : undefined
                return (
                  <div key={field.name}>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      {field.label}
                    </label>
                    <input
                      type="text"
                      value={currentValue}
                      onChange={e => handleField(field.name, e.target.value)}
                      disabled={readonly}
                      placeholder={isPlantilla ? (plantilla ?? 'Normal') : 'Normal'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* IMPL-20260817-01-C2: acordeón EF-Especificar (txtEFEspecificar).
              Aparece cuando alguna prueba de exploración física tiene valor POSITIVO
              (test_adam, test_romberg, signo_bragard, prueba_finkelstein, signo_tinel,
              prueba_phanel, prueba_lasegue). Ver SPEC §4.5 + análisis ZIN §B. */}
          {hasPositiveEF && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <label className="block">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  ⚠️ Especifique hallazgos positivos
                </span>
                <p className="text-[10px] text-amber-700 mt-0.5 mb-2">
                  Detalle los hallazgos positivos en <code>test_adam</code>,{' '}
                  <code>test_romberg</code>, <code>signo_bragard</code>,{' '}
                  <code>prueba_finkelstein</code>, <code>signo_tinel</code>,{' '}
                  <code>prueba_phanel</code>, <code>prueba_lasegue</code>.
                </p>
                <textarea
                  rows={3}
                  value={form.especifique_positivos ?? ''}
                  onChange={e => handleField('especifique_positivos', e.target.value)}
                  disabled={readonly}
                  placeholder="Detalle los hallazgos positivos observados..."
                  className="w-full bg-white border border-amber-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-60"
                />
              </label>
            </div>
          )}

          {/* Guardar borrador desde exploración */}
          {!readonly && (
            <button
              onClick={() => handleSave(false)}
              disabled={isPending}
              className="w-full border-2 border-teal-400 text-teal-700 hover:bg-teal-50 text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : '💾 Guardar borrador'}
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setActiveInnerTab('declarativa')}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-2.5 rounded-xl transition-colors"
            >
              ← Antecedentes
            </button>
            <button
              onClick={() => setActiveInnerTab('impresion')}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
            >
              Continuar → Impresión
            </button>
          </div>
        </div>
      )}

      {/* ── Sub-tab 4: Impresión Diagnóstica y Aptitud ────────────────── */}
          {activeInnerTab === 'impresion' && (
        <div className="space-y-4">
          {/*
            IMPL-20260817-11-C1 (ARCH-20260817-02 corte 4 DA-5): preview en vivo
            de los 9 campos auto-poblados, renderizado ARRIBA del selector de
            aptitud. Regla explicita de Frank (2026-08-17):
              "Quiero que se autopoble. Quiero que el medico solo llene lo
              estrictamente necesario."

            - El medico ve primero lo que se va a firmar y despues decide la
              aptitud (DA-5: tabla en vivo).
            - Reactivo: como `form` viene del state del padre, cualquier
              cambio en los combos / textareas re-renderiza este componente
              sin recargar (AC-21).
            - Los campos 6-9 muestran "Pendiente de resultado" si no hay IA
              todavia; cuando llega el resultado IA, se actualiza (AC-22).
            - IA no esta plumbed al componente padre todavia; cuando se
              añada via props, se pasara como segundo argumento.
          */}
          <LiveSummaryPreview form={form} />

          {/* Selección de Aptitud */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Aptitud laboral
            </p>
            <div className="grid grid-cols-2 gap-2">
              {APTITUD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  disabled={readonly}
                  onClick={() => setAptitud(aptitud === opt.value ? '' : opt.value)}
                  // IMPL-20260817-08-C7 (ARCH-20260817-02 DA-1): `break-words` permite
                  // que el literal largo "NO CUMPLE CON LOS CRITERIOS..." fluya sin
                  // romper el grid 2-col.
                  title={opt.value}
                  className={`text-xs font-bold px-3 py-3 rounded-xl border-2 transition-all text-left break-words ${
                    aptitud === opt.value
                      ? opt.color + ' border-current ring-2 ring-offset-1 ring-current/30'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 disabled:opacity-60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen Clínico por Sistema — ARCH-20260325-09 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resumen Clínico por Sistema</p>
            <div className="grid grid-cols-2 gap-3">
                {RESUMEN_CLINICO_FIELDS.map(([field, label]) => {
                  // IMPL-20260817-01-C2: estado_nutricional + salud_bucal
                  // son ZIN combos (DA-1).
                  // IMPL-20260817-08-C7 (ARCH-20260817-02 DA-6): agudeza_visual_resumen
                  // y presion_arterial_resumen ahora son <select> con catálogos ZIN.
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
                  return (
                  <div key={field}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
                    {comboValues ? (
                      <select
                        value={form[field] ?? ''}
                        onChange={e => handleField(field, e.target.value)}
                        disabled={readonly}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                      >
                        <option value="">—</option>
                        {comboValues.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form[field] ?? ''}
                        onChange={e => handleField(field, e.target.value)}
                        disabled={readonly}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                      />
                    )}
                  </div>
                  )
                })}
            </div>
          </div>

          {/*
            IMPL-20260817-09-C3 (ARCH-20260817-02 DA-5): el Resumen Ejecutivo
            auto-poblado (9 campos del PDF canonico) ahora vive en su propio
            archivo (`LiveSummaryPreview`) y se renderiza ARRIBA del selector
            de aptitud — IMPL-20260817-11-C1 (Corte 4). El medico ve primero
            lo que se va a poblar y despues decide la aptitud.

            Regla explicita de Frank (2026-08-17):
              "Quiero que se autopoble. Quiero que el medico solo llene lo
              estrictamente necesario."
          */}

          {/* Impresión Diagnóstica */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Impresión diagnóstica
              </span>
              <textarea
                rows={4}
                value={form.impresion_diagnostica ?? ''}
                onChange={e => handleField('impresion_diagnostica', e.target.value)}
                disabled={readonly}
                placeholder="Describe los diagnósticos principales o hallazgos clínicos relevantes..."
                className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Restricciones / condicionantes
              </span>
              <textarea
                rows={3}
                value={form.restricciones ?? ''}
                onChange={e => handleField('restricciones', e.target.value)}
                disabled={readonly}
                placeholder="Si aplica, detalla las restricciones o condicionantes laborales..."
                className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Observaciones finales
              </span>
              <textarea
                rows={2}
                value={form.observaciones_finales ?? ''}
                onChange={e => handleField('observaciones_finales', e.target.value)}
                disabled={readonly}
                placeholder="Observaciones adicionales para el expediente..."
                className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
              />
            </label>

            {/*
              IMPL-20260817-09-C4 (ARCH-20260817-02 DA-7): Recomendaciones
              auto-pobladas desde hallazgos. Regla explicita de Frank (2026-08-17):
                "Quiero que se autopoble. Quiero que el medico solo llene lo
                estrictamente necesario."

              - Default: lista numerada auto-poblada por buildRecommendationsFromExam
                (catalogo hallazgo → recomendacion, DA-7).
              - Editable: el medico puede agregar/quitar/sobrescribir
                recomendaciones libremente.
              - DA-2: el auto-poblamiento es PROPUESTA INICIAL; una vez que el
                medico edita, el estado local NO se sobreescribe.
              - Boton "Regenerar desde hallazgos" para volver al auto-poblado
                desde los hallazgos actuales del form.
            */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Recomendaciones
                </span>
                {!readonly && (
                  <button
                    type="button"
                    onClick={() => setRecomendaciones(buildRecommendationsFromExam({
                      estado_nutricional: form.estado_nutricional ?? null,
                      agudeza_visual_resumen: form.agudeza_visual_resumen ?? null,
                      salud_bucal: form.salud_bucal ?? null,
                      presion_arterial_resumen: form.presion_arterial_resumen ?? null,
                      examen_medico_texto: form.impresion_diagnostica ?? null,
                    }))}
                    className="text-[10px] font-bold text-teal-700 hover:text-teal-900 underline"
                    title="Reemplazar por la lista auto-poblada desde los hallazgos actuales"
                  >
                    ↻ Regenerar desde hallazgos
                  </button>
                )}
              </div>
              <textarea
                rows={6}
                value={recomendaciones}
                onChange={e => setRecomendaciones(e.target.value)}
                disabled={readonly}
                placeholder="1.- Recomendación uno. 2.- Recomendación dos. (auto-poblado desde hallazgos)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-400 italic">
                Auto-poblado desde hallazgos del examen (caries, sobrepeso,
                agudeza visual, presión arterial, etc). Puedes editar, agregar
                o quitar recomendaciones.
              </p>
            </div>

            {/* Médicos firmantes — ARCH-20260325-09 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Médico Evaluador (Nombre y Cédula)</span>
                <input type="text" value={form.medico_evaluador ?? ''} onChange={e => handleField('medico_evaluador', e.target.value)} disabled={readonly}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                  placeholder="Dr. Nombre Apellido — Cédula: 0000000" />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Médico Revisor (Nombre y Cédula)</span>
                <input type="text" value={form.medico_revisor ?? ''} onChange={e => handleField('medico_revisor', e.target.value)} disabled={readonly}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                  placeholder="Dr. Nombre Apellido — Cédula: 0000000" />
              </label>
            </div>
          </div>

          {/* Mensajes de resultado */}
          {saveMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 font-medium">
              {saveMsg}
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium">
              ❌ {saveError}
            </div>
          )}
          {aiWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 font-medium">
              ⚠️ {aiWarning}
            </div>
          )}

          {/* CTA — Descarga PDF consolidado + ZIP de cierre clínico.
              IMPL-FEATURE-20260825-03/04 ronda 4 (DEC-20260825-19 /
              BR-20260825-20 / FND-20260825-22): visible sólo cuando
              (a) hay aptitud persistida Y (b) existe MedicalVerdict
              emitido. Sin verdict, los CTAs NO se muestran (BR-20260825-20)
              — el endpoint devolvería 404 — y se reemplaza por un
              mensaje informativo invitando a firmar el dictamen desde
              el flujo "Firmar y Emitir Dictamen" del workspace. */}
          {shouldShowExamenMedicoPdfCta(aptitud, hasMedicalVerdict) ? (
            <div className="bg-white border-2 border-teal-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-bold text-teal-800">
                  Documentos clínicos disponibles
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Descarga el PDF consolidado AMI (4 secciones) o el ZIP
                  de cierre clínico (dictamen general + carpetas por
                  estudio + fuentes + manifest).
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={examenMedicoPdfUrl(eventId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="examen-medico-pdf-download-link"
                  data-implementacion="IMPL-FEATURE-20260825-03"
                  data-has-medical-verdict={String(hasMedicalVerdict)}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors whitespace-nowrap"
                >
                  📄 PDF
                </a>
                {/* IMPL-FEATURE-20260825-04: ZIP de cierre clínico por Event
                    (dictamen general + carpetas por estudio + fuentes + manifest).
                    Comparte el gate del PDF individual. */}
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
              </div>
            </div>
          ) : aptitud ? (
            <div
              className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800"
              data-testid="examen-medico-pdf-pending-notice"
              data-implementacion="IMPL-FEATURE-20260825-03"
              data-has-medical-verdict={String(hasMedicalVerdict)}
            >
              ⏳ Captura guardada. La descarga del PDF y del ZIP se
              habilitará después de <strong>Firmar y Emitir
              Dictamen</strong> desde el panel del expediente (paso
              <em> Validación</em>).
            </div>
          ) : null}

          {/* Acciones de guardado */}
          {!readonly && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setActiveInnerTab('exploracion')}
                className="sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
              >
                ← Exploración
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={isPending}
                className="flex-1 border-2 border-teal-400 text-teal-700 hover:bg-teal-50 text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {isPending ? 'Guardando...' : '💾 Guardar borrador'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isPending || !aptitud || !form.impresion_diagnostica}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!aptitud ? 'Selecciona aptitud antes de completar' : !form.impresion_diagnostica ? 'Agrega impresión diagnóstica' : ''}
              >
                {isPending ? 'Guardando...' : '🏁 Completar Examen Médico'}
              </button>
            </div>
          )}

          {readonly && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-400 text-center">
              Vista de solo lectura — expediente cerrado.
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  )
}
