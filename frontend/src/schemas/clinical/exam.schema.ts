import { z } from 'zod';
import { ClinicalHistoryDataSchema } from './history.schema';
import { tolerantZinEnum } from './zin.helper';

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

/** Escala Snellen de agudeza visual (11 valores — CAMPIMETRÍA.xlsx + ZIN). */
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
  '20/13',
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

/** Campimetría — 4 opciones; default clínico = normal (texto CAMPIMETRÍA.xlsx CAMPI). */
export const CAMPIMETRIA_VALUES = [
  'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES',
  'ALTERADOS',
  'NO APLICA',
  'VER ESTUDIO ANEXO',
] as const

export type CampimetriaValue = (typeof CAMPIMETRIA_VALUES)[number]

/** Test de Ishihara — 3 opciones; default clínico = normal (AYUDA CAMPI en CAMPIMETRÍA.xlsx). */
export const TEST_ISHIHARA_VALUES = [
  'NORMAL (LEE 12, 8, 6, 29, 57, 45)',
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
 * IMPL-20260817-03: helper extraído a `./zin.helper.ts` para evitar ciclo
 * de import `exam.schema ↔ history.schema`. Importar desde `./zin.helper`.
 *
 * Justificación del `.refine()` siempre-permisivo: sirve como marcador
 * contractual para endurecer en una SPEC futura cuando se decida migrar
 * datos legacy (DA-1 → DA-?).
 *
 * @id IMPL-20260817-01-C1
 * @spec SPEC_ARCH-20260817-01 §2.1
 */

// ────────────────────────────────────────────────────────────────────────────
// EXPLORACIÓN FÍSICA + HEREDO-FAMILIARES — Catálogos ZIN (ARCH-20260817-01 / DA-1)
// IMPL-20260817-01-C2 — Corte 2.
// Heredo-familiares (9 campos) + Exploración Física (9 combos) + 16 plantillas
// ZIN literales (fuente: `NOTA MEDICA EJEMPLO.pdf`, §B del análisis ZIN).
// DA-1 (Opción A): schema tolerante — acepta enum + cualquier string legacy.
// Ver SPEC §4.2, §4.3, §4.4.
// @id IMPL-20260817-01-C2
// @spec SPEC_ARCH-20260817-01 §4.2-§4.4
// ────────────────────────────────────────────────────────────────────────────

/** Heredo-Familiares — 7 campos con catálogo ZIN canónico (NEGADOS/OTROS). */
export const HEREDOFAMILIARES_VALUES = [
  'NEGADOS',
  'PADRE',
  'MADRE',
  'AMBOS',
  'HERMANOS',
  'AB PATERNO',
  'AB MATERNO',
  'OTROS',
] as const

export type HeredofamiliaresValue = (typeof HEREDOFAMILIARES_VALUES)[number]

/** Heredo-Familiares — campo `mentales` con 3 opciones (NEGADO/SI/NO APLICA). */
export const HEREDOFAMILIARES_MENTALES_VALUES = ['NEGADO', 'SI', 'NO APLICA'] as const

export type HeredofamiliaresMentalesValue =
  (typeof HEREDOFAMILIARES_MENTALES_VALUES)[number]

/** Exploración Física — Arco de Movilidad (3 opciones). */
export const ARCO_MOVILIDAD_VALUES = [
  'PRESENTES Y NORMALES',
  'LIMITADOS',
  'AUSENTES',
] as const

export type ArcoMovilidadValue = (typeof ARCO_MOVILIDAD_VALUES)[number]

/** Exploración Física — Tono Muscular (3 opciones). */
export const TONO_MUSCULAR_VALUES = ['NORMAL', 'HIPERTROFIA', 'HIPOTROFIA'] as const

export type TonoMuscularValue = (typeof TONO_MUSCULAR_VALUES)[number]

/** Exploración Física — Coordinación (2 opciones). */
export const COORDINACION_VALUES = ['NORMAL', 'ALTERADA'] as const

export type CoordinacionValue = (typeof COORDINACION_VALUES)[number]

/** Exploración Física — Test de Adam (escoliosis) (2 opciones). */
export const TEST_ADAM_VALUES = ['NEGATIVO', 'POSITIVO'] as const

export type TestAdamValue = (typeof TEST_ADAM_VALUES)[number]

/** Exploración Física — Presencia Quiste Sinovial (4 opciones). */
export const PRESENCIA_QUISTE_SINOVIAL_VALUES = [
  'NORMAL',
  'DISMINUIDA',
  'DISMINUIDA CORREGIDA',
  'AUSENTE',
] as const

export type PresenciaQuisteSinovialValue =
  (typeof PRESENCIA_QUISTE_SINOVIAL_VALUES)[number]

/** Exploración Física — Test Romberg (4 opciones). */
export const TEST_ROMBERG_VALUES = [
  'NEGATIVO',
  'POSITIVO BILATERAL',
  'POSITIVO DERECHO',
  'POSITIVO IZQUIERDO',
] as const

export type TestRombergValue = (typeof TEST_ROMBERG_VALUES)[number]

/** Exploración Física — Signo Bragard (2 opciones). */
export const SIGNO_BRAGARD_VALUES = ['NEGATIVO', 'POSITIVO'] as const

export type SignoBragardValue = (typeof SIGNO_BRAGARD_VALUES)[number]

/** Exploración Física — Signo Tinel (4 opciones). */
export const SIGNO_TINEL_VALUES = [
  'NEGATIVO',
  'POSITIVO BILATERAL',
  'POSITIVO DERECHO',
  'POSITIVO IZQUIERDO',
] as const

export type SignoTinelValue = (typeof SIGNO_TINEL_VALUES)[number]

/** Exploración Física — Pruebas Finkelstein/Phanel/Lasegue (4 opciones). */
export const PRUEBA_LATERALIDAD_VALUES = [
  'NEGATIVO',
  'POSITIVO BILATERAL',
  'POSITIVO DERECHO',
  'POSITIVO IZQUIERDO',
] as const

export type PruebaLateralidadValue = (typeof PRUEBA_LATERALIDAD_VALUES)[number]

/** Exploración Física — Circulación Venosa (CEAP — 7 opciones). */
export const CIRCULACION_VENOSA_VALUES = [
  'C0: SIN SIGNOS VISIBLES NI PALPABLES',
  'C1: TELANGIECTASIAS O VENAS RETICULARES',
  'C2: VARICES',
  'C3: EDEMA',
  'C4: TRASTORNOS TRÓFICOS',
  'C5: ULCERA CURADA',
  'C6: ULCERA ACTIVA',
] as const

export type CirculacionVenosaValue = (typeof CIRCULACION_VENOSA_VALUES)[number]

/** Exploración Física — Salud Bucal (4 opciones). */
export const SALUD_BUCAL_VALUES = ['CARIES', 'SARRO', 'CARIES Y SARRO', 'SIN DATOS'] as const

export type SaludBucalValue = (typeof SALUD_BUCAL_VALUES)[number]

/** Estado Nutricional (Resumen Clínico — ImpresiónAptitudSchema) — 6 opciones. */
export const ESTADO_NUTRICIONAL_VALUES = [
  'BAJO PESO',
  'NORMAL',
  'SOBREPESO',
  'OBESIDAD G1',
  'OBESIDAD G2',
  'OBESIDAD G3',
] as const

export type EstadoNutricionalValue = (typeof ESTADO_NUTRICIONAL_VALUES)[number]

// ────────────────────────────────────────────────────────────────────────────
// APTITUD — 5 valores del PDF canónico (ARCH-20260817-02 / DA-1, IMPL-20260817-08)
// Adoptados del `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf` (4 literales)
// + `PENDIENTE DE RESULTADOS` operativa (cuando faltan estudios).
// DA-1 (Opción A): schema tolerante — acepta los 5 valores del nuevo enum
// + legacy `'NO APTO'` (registros previos) + cualquier string legacy.
// NO se migran datos. Sin tocar `prisma/schema.prisma`.
// @id IMPL-20260817-08-C1
// @spec SPEC_ARCH-20260817-02 §2.1
// ────────────────────────────────────────────────────────────────────────────

/** Aptitud — 5 valores canónicos del PDF de referencia + `PENDIENTE DE RESULTADOS`. */
export const APTITUD_VALUES = [
  'APTO',
  'APTO CONDICIONADO',
  'APTO CON RESTRICCIONES',
  'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO',
  'PENDIENTE DE RESULTADOS',
] as const

export type AptitudValue = (typeof APTITUD_VALUES)[number]

/** Aptitud — valores legacy aceptados por DA-1 (registros previos sin migración). */
export const LEGACY_APTITUD_VALUES = ['NO APTO'] as const

/** Schema Zod tolerante para campo `aptitud` (DA-1). Acepta:
 *  - Los 5 valores del nuevo enum (`APTITUD_VALUES`).
 *  - Los legacy (`LEGACY_APTITUD_VALUES`: `'NO APTO'`).
 *  - String vacío (compatibilidad con campo opcional).
 *  - Cualquier string no-vacío (registros legacy en BD — DA-1 Opción A).
 *
 *  Migración: `aptitud` pasa de `z.enum(['APTO','APTO CON RESTRICCIONES','NO APTO','PENDIENTE DE RESULTADOS'])`
 *  a `tolerantZinEnum(APTITUD_VALUES)`. La tolerancia cubre registros legacy con
 *  `'NO APTO'` y cualquier variante tipográfica (Frank: "lo copia igualito" del PDF
 *  canónico implica que el enum nuevo se usa para CAPTURA NUEVA; legacy se conserva).
 *
 *  @id IMPL-20260817-08-C1
 *  @spec SPEC_ARCH-20260817-02 §2.1, §6
 */
export const aptitudSchema = tolerantZinEnum(APTITUD_VALUES)

// ────────────────────────────────────────────────────────────────────────────
// RESUMEN VISUAL + PRESIÓN ARTERIAL — enums cortos (ARCH-20260817-02 / DA-6)
// IMPL-20260817-08-C2 — Corte 1.
// `agudeza_visual_resumen` y `presion_arterial_resumen` pasan de `cleanString`
// a `tolerantZinEnum` con catálogos cortos alineados al ZIN (`ddlIDAgudezaNormal`,
// `dllIDPresionArt`) y al PDF de referencia (`DISMINUIDA`, `NORMAL AL MOMENTO…`).
// DA-1 (Opción A): schema tolerante preserva registros legacy.
// @id IMPL-20260817-08-C2
// @spec SPEC_ARCH-20260817-02 §2.6, §6
// ────────────────────────────────────────────────────────────────────────────

/** Agudeza Visual resumen (Resumen Clínico) — 4 opciones (fiel al PDF). */
export const AGUDEZA_VISUAL_RESUMEN_VALUES = [
  'NORMAL',
  'DISMINUIDA',
  'NORMAL ALTA',
  'BAJA AL MOMENTO DE LA TOMA',
] as const

export type AgudezaVisualResumenValue = (typeof AGUDEZA_VISUAL_RESUMEN_VALUES)[number]

/** Presión Arterial resumen (Resumen Clínico) — 3 opciones (catálogo ZIN `dllIDPresionArt`). */
export const PRESION_ARTERIAL_RESUMEN_VALUES = [
  'NORMAL AL MOMENTO DE LA TOMA',
  'ALTA',
  'BAJA',
] as const

export type PresionArterialResumenValue = (typeof PRESION_ARTERIAL_RESUMEN_VALUES)[number]

/**
 * Patrones Sí/No/No aplica para acordeones "Especifique" (D-5).
 * Aplica a: `txtHLPEspecificar` (factor de riesgo laboral), `txtAPTDrogasEspec`,
 * `txtAPTEjercicioEsp`, `txtAPTTatuajesEsp`, `txtAPEspecificacion` (patológico),
 * y a `estado_nutricional`/`salud_bucal` en el resumen clínico.
 */
export const SI_NO_NA_VALUES = ['NEGADO', 'SI', 'NO APLICA'] as const

export type SiNoNaValue = (typeof SI_NO_NA_VALUES)[number]

// ────────────────────────────────────────────────────────────────────────────
// MÓDULO 1 — ANTECEDENTES GINECOLÓGICOS + INMUNIZACIONES (IMPL-20260817-07)
// Catálogos ZIN para sub-tab "declarativa" del Examen Médico.
// DA-1: schema sigue siendo tolerante (registros legacy string libre);
// los catálogos sólo se usan para construir `<select>` con opciones canónicas.
// Ver SPEC §4.6.
// @id IMPL-20260817-07
// @spec SPEC_ARCH-20260817-01 §4.6
// ────────────────────────────────────────────────────────────────────────────

/** Módulo 1 — IVS (vida sexual activa) — 3 opciones. */
export const AG_IVS_VALUES = ['N/A', 'ACTIVA', 'NO ACTIVA'] as const

export type AgIvsValue = (typeof AG_IVS_VALUES)[number]

/** Módulo 1 — Métodos anticonceptivos / VSA (aplica a ritmo y DOC) — 7 opciones. */
export const AG_VSA_VALUES = [
  'NINGUNO',
  'DE BARRERA',
  'HORMONAL',
  'DIU',
  'OTB',
  'RITMO',
  'OTRO',
] as const

export type AgVsaValue = (typeof AG_VSA_VALUES)[number]

/** Módulo 1 — Helper numérico 0-11 (gesta/parto/cesárea/MPF). */
export const AG_NUMERIC_0_11 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const

export type AgNumeric0_11 = (typeof AG_NUMERIC_0_11)[number]

/** Módulo 1 — Aborto Sí/No. */
export const AG_ABORTO_VALUES = ['SI', 'NO'] as const

export type AgAbortoValue = (typeof AG_ABORTO_VALUES)[number]

/** Módulo 1 — Antecedentes reproductivos masculinos: M.P.F. (ZIN `ddlARMPF`). */
export const AR_MPF_VALUES = [
  'NINGUNO',
  'PRESERVATIVO',
  'VASECTOMIA',
  'HORMONAL(Pareja)',
  'DIU(Pareja)',
  'OTB(Pareja)',
] as const

export type ArMpfValue = (typeof AR_MPF_VALUES)[number]

/** Módulo 1 — Vacunas — acordeón Sí/No/No aplica (alias semántico de SI_NO_NA_VALUES). */
export const VAC_SI_NO_VALUES = SI_NO_NA_VALUES

export type VacSiNoValue = (typeof VAC_SI_NO_VALUES)[number]

/**
 * Plantillas ZIN literales — Exploración Física (16 textos).
 * Extraídas verbatim del `NOTA MEDICA EJEMPLO.pdf` (ver análisis ZIN §B).
 * Frank: "Lo copia igualito que el ZIN" → sin paráfrasis, sin normalización.
 *
 * Se usan como valor predeterminado en Exploración Física (editable caso a caso).
 * El schema Zod sigue siendo `cleanString` (string libre).
 *
 * @id IMPL-20260817-01-C2
 * @spec SPEC_ARCH-20260817-01 §4.3
 */
export const PLANTILLAS_EF = {
  neurologico: 'Alerta, orientado en tiempo, lugar y persona. Cooperador.',
  cabeza: 'Cráneo normocéfalo, sin hundimientos ni exostosis.',
  piel_y_faneras: 'Sin datos de palidez, ictericia o cianosis.',
  oidos_cad: 'Permeable, MT íntegra, cono luminoso permeable.',
  oidos_cai: 'Permeable, MT íntegra, cono luminoso permeable.',
  ojos: 'Pupilas isocóricas, normorrefléxicas.',
  nariz: 'Alineada, septum alineado.',
  faringe: 'Sin datos patológicos.',
  cuello: 'Cilíndrico, tráquea central.',
  torax: 'Mesomórfico, movimientos de amplexión y amplexación normales.',
  corazon: 'Ruidos cardíacos rítmicos, sin soplos.',
  campos_pulmonares: 'Bien ventilados, sin ruidos agregados.',
  abdomen: 'Globoso, blando, depresible, sin dolor.',
  genitourinario: 'Giordano negativo bilateral.',
  columna_vertebral: 'Clínicamente alineada.',
  ms_superiores: 'Íntegros, fuerza y sensibilidad conservada.',
  ms_inferiores: 'Íntegros, sensibilidad conservada.',
} as const

export type PlantillaEfKey = keyof typeof PLANTILLAS_EF

/** Valores predeterminados de combos ZIN en Exploración Física (opción “normal”). */
const EXPLORACION_SELECT_DEFAULTS: Record<string, string> = {
  boca_estado: 'SIN DATOS',
  test_adam: 'NEGATIVO',
  circulacion_venosa: 'C0: SIN SIGNOS VISIBLES NI PALPABLES',
  arco_de_movilidad: 'PRESENTES Y NORMALES',
  tono_muscular: 'NORMAL',
  coordinacion: 'NORMAL',
  test_romberg: 'NEGATIVO',
  signo_bragard: 'NEGATIVO',
  prueba_finkelstein: 'NEGATIVO',
  signo_tinel: 'NEGATIVO',
  prueba_phanel: 'NEGATIVO',
  prueba_lasegue: 'NEGATIVO',
  presencia_quiste_sinovial: 'NORMAL',
}

/** Texto libre EF sin plantilla ZIN (placeholder histórico → valor inicial). */
const EXPLORACION_TEXT_DEFAULTS: Record<string, string> = {
  boca_alineacion: 'Normal',
  fuerza_muscular_daniels_sup: '5/5',
  fuerza_muscular_daniels_inf: '5/5',
  especificar_quiste: '',
}

/** Default canónico de un campo de Hallazgos por aparato y sistema. */
export function getExploracionFieldDefault(fieldName: string): string {
  if (fieldName in PLANTILLAS_EF) {
    return PLANTILLAS_EF[fieldName as PlantillaEfKey]
  }
  return EXPLORACION_SELECT_DEFAULTS[fieldName]
    ?? EXPLORACION_TEXT_DEFAULTS[fieldName]
    ?? ''
}

/**
 * Prellena campos EF vacíos con plantillas/combos normales (persiste al guardar).
 * No sobrescribe valores ya capturados en BD.
 */
export function applyExploracionFisicaDefaults(
  persisted: Record<string, string>,
): Record<string, string> {
  const next = { ...persisted }
  const allDefaults: Record<string, string> = {
    ...PLANTILLAS_EF,
    ...EXPLORACION_SELECT_DEFAULTS,
    ...EXPLORACION_TEXT_DEFAULTS,
  }
  for (const [key, defaultValue] of Object.entries(allDefaults)) {
    if (!String(next[key] ?? '').trim()) {
      next[key] = defaultValue
    }
  }
  return next
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
// 8 visión (Snellen 11 valores) + reflejos (4) + test_ishihara (3) +
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
  test_ishihara: tolerantZinEnum(TEST_ISHIHARA_VALUES).default(
    'NORMAL (LEE 12, 8, 6, 29, 57, 45)',
  ),
  campimetria: tolerantZinEnum(CAMPIMETRIA_VALUES).default(
    'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES',
  ),
});

// ----------------------------------------------------------------------
// 9. EXPLORACIÓN FÍSICA GENERAL (Imagen 8)
// IMPL-20260817-01-C2: 9 campos con catálogo ZIN vía `tolerantZinEnum`
// (DA-1). Los 16 campos con plantilla ZIN (`neurologico`, `cabeza`, etc.)
// siguen como `cleanString` (texto libre editable, default = PLANTILLAS_EF).
// Ver SPEC §4.2 (combos) + §4.3 (plantillas).
// ----------------------------------------------------------------------
export const ExploracionFisicaSchema = z.object({
  neurologico: cleanString,
  cabeza: cleanString,
  piel_y_faneras: cleanString,
  oidos_cad: cleanString,
  oidos_cai: cleanString,
  ojos: cleanString,
  boca_estado: tolerantZinEnum(SALUD_BUCAL_VALUES),
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
  test_adam: tolerantZinEnum(TEST_ADAM_VALUES),
  ms_superiores: cleanString,
  fuerza_muscular_daniels_sup: cleanString,
  ms_inferiores: cleanString,
  fuerza_muscular_daniels_inf: cleanString,
  circulacion_venosa: tolerantZinEnum(CIRCULACION_VENOSA_VALUES),
  arco_de_movilidad: tolerantZinEnum(ARCO_MOVILIDAD_VALUES),
  tono_muscular: tolerantZinEnum(TONO_MUSCULAR_VALUES),
  coordinacion: tolerantZinEnum(COORDINACION_VALUES),
  test_romberg: tolerantZinEnum(TEST_ROMBERG_VALUES),
  signo_bragard: tolerantZinEnum(SIGNO_BRAGARD_VALUES),
  prueba_finkelstein: tolerantZinEnum(PRUEBA_LATERALIDAD_VALUES),
  signo_tinel: tolerantZinEnum(SIGNO_TINEL_VALUES),
  prueba_phanel: tolerantZinEnum(PRUEBA_LATERALIDAD_VALUES),
  prueba_lasegue: tolerantZinEnum(PRUEBA_LATERALIDAD_VALUES),
  presencia_quiste_sinovial: tolerantZinEnum(PRESENCIA_QUISTE_SINOVIAL_VALUES),
  especificar_quiste: cleanString,
  // IMPL-20260817-01-C2: campo opcional para acordeón "Especifique hallazgos
  // positivos" (ZIN: txtEFEspecificar). Aparece cuando alguna prueba = POSITIVO.
  especifique_positivos: cleanString,
});

// ----------------------------------------------------------------------
// 10. IMPRESIÓN DIAGNÓSTICA Y APTITUD (sección médico — IMPL-20260325-01)
// Campos ampliados segun Esquema Examen Medico Dividido — ARCH-20260325-09
// IMPL-20260817-01-C2: `estado_nutricional` y `salud_bucal` migran a
// `tolerantZinEnum` (ZIN combos — DA-1). Ver SPEC §4.2.
// ----------------------------------------------------------------------
export const ImpresiónAptitudSchema = z.object({
  // === DIAGNÓSTICOS SEPARADOS POR PRUEBA (Frank 2026-08-17) ===
  // IMPL-20260817-12-C1 (ARCH-20260817-02 Corte 4.5 — fix schema):
  // Frank señaló que el modelo correcto es "cada prueba con su slot
  // independiente en BD". El campo único `impresion_diagnostica` mezclaba
  // las 5 pruebas y los campos 6-9 del resumen ejecutivo (audiometría,
  // espirometría, laboratorios, radiografía) se perdían al persistir.
  //
  // DA-1: los 5 slots son `.optional()` para preservar registros legacy
  // con `impresion_diagnostica` consolidado. Helpers deben preferir el
  // slot nuevo si existe, con fallback al legacy.
  examen_medico_texto: cleanString.optional(),
  audiometria_texto: cleanString.optional(),
  espirometria_texto: cleanString.optional(),
  laboratorios_texto: cleanString.optional(),
  radiografia_texto: cleanString.optional(),

  // === LEGACY (DA-1) ===
  // IMPL-20260817-12-C1: campo antiguo consolidado, ahora opcional para
  // retrocompatibilidad. Los nuevos slots por prueba son la fuente de
  // verdad; este se conserva solo para parsear datos legacy sin migración.
  impresion_diagnostica: cleanString.optional(),

  // === RESUMEN EJECUTIVO (auto-poblado por buildExamSummary) ===
  // Campos faltantes identificados en ARCH-20260325-09
  estado_nutricional: tolerantZinEnum(ESTADO_NUTRICIONAL_VALUES),
  salud_bucal: tolerantZinEnum(SALUD_BUCAL_VALUES),
  // IMPL-20260817-08-C2 (ARCH-20260817-02 DA-6): enums cortos ZIN alineados al PDF.
  // Mantener `.optional()` — el original `cleanString` lo era, y registros legacy
  // sin estos campos siguen parseando (DA-1 preserva compat).
  agudeza_visual_resumen: tolerantZinEnum(AGUDEZA_VISUAL_RESUMEN_VALUES).optional(),
  presion_arterial_resumen: tolerantZinEnum(PRESION_ARTERIAL_RESUMEN_VALUES).optional(),

  // === CONSOLIDADO (decisión del médico) ===
  // IMPL-20260817-08-C1 (ARCH-20260817-02 DA-1): enum de aptitud pasa de 4 a 5
  // valores del PDF canónico. Schema tolerante preserva legacy `'NO APTO'`.
  aptitud: aptitudSchema.optional(),
  restricciones: cleanString,
  observaciones_finales: cleanString,
  medico_evaluador: cleanString,
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
