import { z } from 'zod';
import { ClinicalHistoryDataSchema } from './history.schema';

const cleanString = z.string().trim().max(1000).optional();
const cleanNum = z.coerce.number().nonnegative().optional();

// ────────────────────────────────────────────────────────────────────────────
// AGUDEZA VISUAL — Catálogos ZIN (ARCH-20260817-01 / DA-1)
// Adoptados del sistema ZIN legacy para reducir errores de dedo del médico.
// DA-1 (Opción A): schema tolerante — acepta valores del catálogo + cualquier
// string legacy. NO se migran datos. Ver SPEC §2.1 y ADR-20260817-01.
// @id IMPL-20260817-01-C1
// @spec SPEC_ARCH-20260817-01 §4.1
// ────────────────────────────────────────────────────────────────────────────

/** Escala Snellen de agudeza visual (10 valores canónicos ZIN). */
export const VISION_SNELLEN_VALUES = [
  '20/200',
  '20/100',
  '20/70',
  '20/50',
  '20/40',
  '20/30',
  '20/25',
  '20/20',
  '20/15',
  '20/10',
] as const

export type VisionSnellenValue = (typeof VISION_SNELLEN_VALUES)[number]

/** Reflejos pupilares — 4 opciones (default `PRESENTES Y NORMOREFLECTICOS`). */
export const REFLEJOS_VALUES = [
  'PRESENTES Y NORMOREFLECTICOS',
  'DISMINUIDOS',
  'AUSENTES',
  'NO APLICA',
] as const

export type ReflejosValue = (typeof REFLEJOS_VALUES)[number]

/** Campimetría — 4 opciones (default `CAMPOS VISUALES DENTRO DE PARÁMETROS NORMALES`). */
export const CAMPIMETRIA_VALUES = [
  'CAMPOS VISUALES DENTRO DE PARÁMETROS NORMALES',
  'ALTERADOS',
  'NO APLICA',
  'VER ESTUDIO ANEXO',
] as const

export type CampimetriaValue = (typeof CAMPIMETRIA_VALUES)[number]

/** Test de Ishihara — 3 opciones (default `NORMAL (LEE 12,8,6,29,57,45)`). */
export const TEST_ISHIHARA_VALUES = [
  'NORMAL (LEE 12,8,6,29,57,45)',
  'ALTERADO',
  'NO APLICA',
] as const

export type TestIshiharaValue = (typeof TEST_ISHIHARA_VALUES)[number]

/**
 * Schema Zod tolerante para campo ZIN (DA-1, Opción A).
 *
 * Acepta:
 *   - Valores del catálogo `enumValues` (captura nueva via UI <select>).
 *   - Cualquier string no-vacío (registros legacy en BD — sin migración).
 *   - String vacío (compatibilidad con campos opcionales: `campimetria`,
 *     `test_ishihara` que permitían blank en captura legacy).
 *
 * Rechaza únicamente `undefined`/`null` puros (lo cubre el wrapper).
 *
 * Justificación del `.refine()` siempre-permisivo: sirve como marcador
 * contractual para endurecer en una SPEC futura cuando se decida migrar
 * datos legacy (DA-1 → DA-?).
 *
 * @id IMPL-20260817-01-C1
 * @spec SPEC_ARCH-20260817-01 §2.1
 */
function tolerantZinEnum(enumValues: readonly string[]) {
  return z.string().refine(
    (v) => v === '' || enumValues.includes(v) || v.length > 0,
    { message: 'Valor fuera del catálogo ZIN; aceptado como legacy.' }
  )
}

// ----------------------------------------------------------------------
// 6. ANTECEDENTES REPRODUCTIVOS e INMUNIZACIONES (Imágenes 4 y 5)
// ----------------------------------------------------------------------
export const ReproductivosInmunizacionesSchema = z.object({
  ivs: cleanString,
  vsa: cleanString,
  mpf: cleanString,
  doc_prostata: cleanString,
  rubeola: cleanString,
  neumococo: cleanString,
  sarampion: cleanString,
  influenza: cleanString,
  toxoide_tetanico: cleanString,
  hepatitis_b: cleanString,
  otra_inmunizacion: cleanString,
  proxima_dosis: cleanString
});

// ----------------------------------------------------------------------
// 7. SOMATOMETRÍA / SIGNOS VITALES (Imagen 6)
// ----------------------------------------------------------------------
export const SomatometriaVitalesSchema = z.object({
  ta_sistolica: cleanNum,
  ta_diastolica: cleanNum,
  fc_min: cleanNum,
  peso_kg: cleanNum,
  perimetro_cintura: cleanNum,
  talla_m: cleanNum,
  perimetro_cadera: cleanNum,
  fr_min: cleanNum,
  temperatura: z.coerce.number().gt(30).lt(45).optional(),
  imc: cleanNum,               
  complexion: z.enum(['BAJO PESO', 'NORMAL', 'SOBREPESO', 'OBESIDAD', 'OBESIDAD SEVERA']).optional()
});

// ----------------------------------------------------------------------
// 8. AGUDEZA VISUAL (Imagen 7)
// IMPL-20260817-01-C1: 11 campos con catálogo ZIN + refine tolerante (DA-1).
// 8 visión (Snellen 10 valores) + reflejos (4) + test_ishihara (3) +
// campimetria (4). UI usa <select>; schema preserva registros legacy.
// ----------------------------------------------------------------------
export const AgudezaVisualSchema = z.object({
  vision_lejana_od: tolerantZinEnum(VISION_SNELLEN_VALUES).default('NO APLICA'),
  vision_lejana_oi: tolerantZinEnum(VISION_SNELLEN_VALUES).default('NO APLICA'),
  vision_cercana_od: tolerantZinEnum(VISION_SNELLEN_VALUES).default('NO APLICA'),
  vision_cercana_oi: tolerantZinEnum(VISION_SNELLEN_VALUES).default('NO APLICA'),
  lejana_corregida_od: tolerantZinEnum(VISION_SNELLEN_VALUES).default('NO APLICA'),
  lejana_corregida_oi: tolerantZinEnum(VISION_SNELLEN_VALUES).default('NO APLICA'),
  cercana_corregida_od: tolerantZinEnum(VISION_SNELLEN_VALUES).default('NO APLICA'),
  cercana_corregida_oi: tolerantZinEnum(VISION_SNELLEN_VALUES).default('NO APLICA'),
  reflejos: tolerantZinEnum(REFLEJOS_VALUES).default('PRESENTES Y NORMOREFLECTICOS'),
  test_ishihara: tolerantZinEnum(TEST_ISHIHARA_VALUES).optional(),
  campimetria: tolerantZinEnum(CAMPIMETRIA_VALUES).optional(),
});

// ----------------------------------------------------------------------
// 9. EXPLORACIÓN FÍSICA GENERAL (Imagen 8)
// ----------------------------------------------------------------------
export const ExploracionFisicaSchema = z.object({
  neurologico: cleanString,
  cabeza: cleanString,
  piel_y_faneras: cleanString,
  oidos_cad: cleanString,
  oidos_cai: cleanString,
  ojos: cleanString,
  boca_estado: cleanString,
  boca_alineacion: cleanString,
  nariz: cleanString,
  faringe: cleanString,
  cuello: cleanString,
  torax: cleanString,
  corazon: cleanString,
  campos_pulmonares: cleanString,
  abdomen: cleanString,
  genitourinario: cleanString,
  columna_vertebral: cleanString,
  test_adam: cleanString,
  ms_superiores: cleanString,
  fuerza_muscular_daniels_sup: cleanString,
  ms_inferiores: cleanString,
  fuerza_muscular_daniels_inf: cleanString,
  circulacion_venosa: cleanString,
  arco_de_movilidad: cleanString,
  tono_muscular: cleanString,
  coordinacion: cleanString,
  test_romberg: cleanString,
  signo_bragard: cleanString,
  prueba_finkelstein: cleanString,
  signo_tinel: cleanString,
  prueba_phanel: cleanString,
  prueba_lasegue: cleanString,
  presencia_quiste_sinovial: cleanString,
  especificar_quiste: cleanString
});

// ----------------------------------------------------------------------
// 10. IMPRESIÓN DIAGNÓSTICA Y APTITUD (sección médico — IMPL-20260325-01)
// Campos ampliados segun Esquema Examen Medico Dividido — ARCH-20260325-09
// ----------------------------------------------------------------------
export const ImpresiónAptitudSchema = z.object({
  aptitud: z.enum(['APTO', 'APTO CON RESTRICCIONES', 'NO APTO', 'PENDIENTE DE RESULTADOS']).optional(),
  restricciones: cleanString,
  impresion_diagnostica: cleanString,
  observaciones_finales: cleanString,
  medico_evaluador: cleanString,
  // Campos faltantes identificados en ARCH-20260325-09
  estado_nutricional: cleanString,
  salud_bucal: cleanString,
  agudeza_visual_resumen: cleanString,
  presion_arterial_resumen: cleanString,
  medico_revisor: cleanString,
});

// ----------------------------------------------------------------------
// 11. MÓDULO MÉDICO COMPLETO (Exploración + Impresión — IMPL-20260325-01)
//     Se persiste en physicalExamData del MedicalExam.
//     Incluye Módulo 1 capturado in-studio sin depender del portal público (ARCH-20260325-09).
//     A partir de ARCH-20260809-01 incluye también `antecedentes_captured`
//     (snapshot por cita de las 5 secciones declarativas del paciente —
//     no sobrescribe el historial maestro longitudinal).
// ----------------------------------------------------------------------

/**
 * Snapshot por cita de los antecedentes declarativos del paciente.
 * Reusa `ClinicalHistoryDataSchema` (las 5 secciones canónicas) y añade
 * `_provenance` opcional para trazabilidad de la fuente (portal / longitudinal
 * / captura directa del médico / mixto).
 * @id IMPL-20260809-01
 * @spec ARCH-20260809-01 — outer-tab "Antecedentes" en Examen Médico
 */
export const AntecedentesCapturaSchema = ClinicalHistoryDataSchema.extend({
  _provenance: z
    .object({
      source: z.enum(['portal', 'longitudinal', 'captured', 'mixed']),
      updatedAt: z.string().datetime().optional(),
      capturedBy: z.string().optional(),
    })
    .optional(),
})

export type AntecedentesCaptura = z.infer<typeof AntecedentesCapturaSchema>

export const ExamenMedicoCompletoSchema = ExploracionFisicaSchema
  .merge(ImpresiónAptitudSchema)
  .extend({
    antecedentes_medico: cleanString,
    /** Módulo 1 — cuestionario del paciente capturado en sala (ARCH-20260325-09) */
    modulo1: z.record(z.string(), z.any()).optional(),
    /**
     * Snapshot por cita de los antecedentes — ARCH-20260809-01.
     * Opcional: exámenes existentes sin este campo siguen parseando OK.
     */
    antecedentes_captured: AntecedentesCapturaSchema.optional(),
  });
