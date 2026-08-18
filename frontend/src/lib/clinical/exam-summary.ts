/**
 * @file Helpers para construir el resumen ejecutivo del reporte de aptitud
 * (IMPL-20260817-09-C1, Corte 2).
 *
 * **Regla explícita de Frank (2026-08-17):** *"Quiero que se autopoble. Quiero
 * que el médico solo llene lo estrictamente necesario."*
 *
 * Este módulo implementa `buildExamSummary` que arma los **9 campos** del
 * resumen ejecutivo del PDF de aptitud (`ESTADO NUTRICIONAL`, `AGUDEZA VISUAL`,
 * `SALUD BUCAL`, `EXAMEN MEDICO`, `PRESION ARTERIAL`, `AUDIOMETRIA`,
 * `ESPIROMETRIA`, `LABORATORIOS`, `RADIOGRAFIA`) desde dos fuentes:
 *
 * 1. **`exam`** — captura manual del examen físico (`physicalExamData`):
 *    campos 1-5 + texto diagnóstico + textos manuales de estudios.
 * 2. **`iaResults`** — resultados de IA (audiometría, espirometría) que tienen
 *    prioridad sobre los textos manuales si están disponibles (DA-5).
 *
 * Los campos que faltan se devuelven como `''` (string vacío) para que la UI
 * pueda renderizarlos como `Pendiente de resultado` / placeholder en el
 * preview. El médico NO edita estos campos directamente — si quiere ajustar,
 * va a las pestañas de origen y vuelve.
 *
 * @id IMPL-20260817-09-C1
 * @spec SPEC_ARCH-20260817-02 §2.7 (DA-5), §6
 * @decision DA-5 (ARCH-20260817-02) — tabla 9 campos auto-poblada mixto
 *           (manual + IA), en vivo al editar, congelado al firmar.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Forma mínima del examen físico que necesita `buildExamSummary`. */
export interface ExamSnapshot {
  /** Resumen clínico — captura manual del examen. */
  estado_nutricional?: string | null
  agudeza_visual_resumen?: string | null
  salud_bucal?: string | null
  presion_arterial_resumen?: string | null
  /** Texto diagnóstico del examen (campo "EXAMEN MEDICO" en el PDF). */
  examen_medico_texto?: string | null
  /** Textos manuales opcionales para campos IA (placeholder si no llega IA). */
  audiometria_texto?: string | null
  espirometria_texto?: string | null
  laboratorios_texto?: string | null
  radiografia_texto?: string | null
}

/** Resultados de IA disponibles (prioridad sobre texto manual). */
export interface IaResults {
  audiometria_resumen?: string | null
  espirometria_resumen?: string | null
  /** Otros campos IA futuros (labs, RX) — se ignoran si no se pasan. */
  [k: string]: string | null | undefined
}

/** Resumen ejecutivo de 9 campos para el PDF de aptitud (literales verbatim). */
export interface ExamSummary {
  estado_nutricional: string
  agudeza_visual: string
  salud_bucal: string
  examen_medico: string
  presion_arterial: string
  audiometria: string
  espirometria: string
  laboratorios: string
  radiografia: string
}

/** Etiquetas verbatim del PDF canónico (REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf).
 *  Reutilizable por UI y PDF route. */
export const EXAM_SUMMARY_LABELS: readonly [
  keyof ExamSummary,
  string
][] = [
  ['estado_nutricional', 'ESTADO NUTRICIONAL'],
  ['agudeza_visual', 'AGUDEZA VISUAL'],
  ['salud_bucal', 'SALUD BUCAL'],
  ['examen_medico', 'EXAMEN MEDICO'],
  ['presion_arterial', 'PRESION ARTERIAL'],
  ['audiometria', 'AUDIOMETRIA'],
  ['espirometria', 'ESPIROMETRIA'],
  ['laboratorios', 'LABORATORIOS'],
  ['radiografia', 'RADIOGRAFIA'],
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normaliza un valor opcional a string (vacío si null/undefined). */
function s(v: string | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

/** Prioridad: IA > manual > vacío. */
function pick(ia: string | null | undefined, manual: string | null | undefined): string {
  const iaStr = s(ia)
  if (iaStr.trim() !== '') return iaStr
  return s(manual)
}

// ─── Builder principal ────────────────────────────────────────────────────────

/**
 * Construye el resumen ejecutivo de 9 campos a partir del estado del examen y
 * los resultados de IA disponibles.
 *
 * **Regla DA-5:** los campos 1-5 (estructurales) se jalan de `exam`
 * (captura manual del examen físico). Los campos 6-9 (audiometría,
 * espirometría, laboratorios, radiografía) se jalan de `iaResults` cuando
 * están disponibles; si no, caen al texto manual o quedan vacíos (la UI los
 * muestra como `Pendiente de resultado`).
 *
 * **NO pisa edición manual previa** — esta función solo ARMA el resumen desde
 * el estado actual; no persiste ni sobrescribe nada (DA-2: el auto-poblamiento
 * es propuesta inicial, el médico puede editar en su pestaña de origen).
 *
 * @param exam - Snapshot del examen físico (campos manuales).
 * @param iaResults - Resultados IA disponibles (opcional).
 * @returns Objeto con los 9 campos del resumen ejecutivo del PDF de aptitud.
 */
export function buildExamSummary(
  exam: ExamSnapshot,
  iaResults?: IaResults | null
): ExamSummary {
  return {
    estado_nutricional: s(exam.estado_nutricional),
    agudeza_visual: s(exam.agudeza_visual_resumen),
    salud_bucal: s(exam.salud_bucal),
    examen_medico: s(exam.examen_medico_texto),
    presion_arterial: s(exam.presion_arterial_resumen),
    audiometria: pick(iaResults?.audiometria_resumen, exam.audiometria_texto),
    espirometria: pick(iaResults?.espirometria_resumen, exam.espirometria_texto),
    laboratorios: s(exam.laboratorios_texto),
    radiografia: s(exam.radiografia_texto),
  }
}
