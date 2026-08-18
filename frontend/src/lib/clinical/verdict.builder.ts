/**
 * @file Helper para auto-poblar el dictamen final de aptitud desde el snapshot
 * del examen (IMPL-20260817-10-C1, ARCH-20260817-02 Corte 3 — DA-2).
 *
 * **Regla explícita de Frank (2026-08-17):**
 * > *"Quiero que se autopoble. Quiero que el médico solo llene lo
 * > estrictamente necesario."*
 *
 * Hasta ahora (pre-DA-2), el médico debía **volver a escribir a mano** el
 * dictamen en `EventFlowController` aunque ya lo había capturado en la pestaña
 * "Impresión y Aptitud" del `ExamenMedicoEstudio`. Esto era duplicación de
 * captura (deficiencia estructural #1 del ADR).
 *
 * Este helper **propone** los valores del dictamen desde `physicalExamData`:
 * - `aptitud` ← `physicalExamData.aptitud` (5 valores del PDF canónico, DA-1).
 * - `impresionDiagnostica` ← `physicalExamData.impresion_diagnostica`.
 * - `recomendaciones` ← `physicalExamData.recomendaciones` (si existe legacy).
 * - `examenFisico` ← `physicalExamData.examen_medico_texto` (texto del examen).
 *
 * **Preservación de edición manual:** si se pasa `existing` (el dictamen ya
 * persistido o ya editado por el médico), el helper lo devuelve intacto —
 * nunca pisa la edición humana.
 *
 * **Default de aptitud:** si `physicalExamData.aptitud` está ausente o no es
 * string, devuelve `'PENDIENTE DE RESULTADOS'` (operativa: el médico aún no
 * eligió aptitud y no debe firmar un dictamen sin valor).
 *
 * **Función pura, importable desde cliente y servidor** — vive en `lib/clinical/`
 * (mismo patrón que `aptitud.helper.ts`, `exam-summary.ts`, `recommendations.ts`).
 *
 * **Reversibilidad:** si en una SPEC futura `MedicalVerdict` migra a columnas
 * Prisma estructuradas (`aptitud`, `impresionDiagnostica`, etc.), este helper se
 * mantiene — solo cambia el callsite que persiste el resultado.
 *
 * @id IMPL-20260817-10-C1
 * @spec SPEC_ARCH-20260817-02 §2.2 (DA-2), §3.3 (Corte 3 #14-16)
 * @decision DA-2 (ARCH-20260817-02) — auto-poblamiento dictamen
 *           desde pestaña Impresión/Aptitud (no pisa edición manual).
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Forma del dictamen propuesto por el helper (input para
 * `EventFlowController` y futuro ensamblaje de `MedicalVerdict`). */
export interface VerdictBuildOutput {
  /** Literal del enum de aptitud (5 valores DA-1 + legacy `'NO APTO'`). */
  aptitud: string
  /** Texto diagnóstico capturado en la pestaña Impresión/Aptitud. */
  impresionDiagnostica: string
  /** Recomendaciones (si estaban pre-capturadas en physicalExamData legacy). */
  recomendaciones: string
  /** Texto del examen físico (campo `EXAMEN MEDICO` de la tabla resumen). */
  examenFisico: string
  /** Fecha de emisión del dictamen (default: `new Date()` al invocar). */
  fechaEmision: Date
  /** Cédula/nombre del médico evaluador (default: vacío si no se pasa). */
  medicoEvaluador?: string
  /** Cédula/nombre del médico revisor (default: vacío si no se pasa). */
  medicoRevisor?: string
}

/** Partial del output — usado para preservar edición manual previa. */
export type PartialVerdictBuildOutput = Partial<VerdictBuildOutput>

/** Defaults opcionales (médico evaluador, fecha, etc.). */
export interface VerdictBuildDefaults {
  medicoEvaluador?: string
  medicoRevisor?: string
  fechaEmision?: Date
}

// ─── Default aptitud ──────────────────────────────────────────────────────────

/** Default operativo cuando el médico aún no eligió aptitud. */
export const DEFAULT_APTITUD = 'PENDIENTE DE RESULTADOS' as const

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Auto-pobla un dictamen desde el `physicalExamData` del examen.
 *
 * Si `existing` está presente y no es null, se devuelve intacto
 * (preserva edición manual previa del médico).
 *
 * Si `existing` es null/undefined, devuelve una propuesta basada en
 * `physicalExamData`:
 * - `aptitud` ← `physicalExamData.aptitud` (string), o `DEFAULT_APTITUD`.
 * - `impresionDiagnostica` ← concatenación de los 5 slots por prueba
 *   (`examen_medico_texto`, `audiometria_texto`, `espirometria_texto`,
 *   `laboratorios_texto`, `radiografia_texto`) con prefijo del nombre de
 *   la prueba (`"Examen médico: ..."`, etc.). Si ninguno está presente,
 *   fallback al campo legacy `impresion_diagnostica` (DA-1).
 * - `recomendaciones` ← `physicalExamData.recomendaciones` (string), o `''`.
 * - `examenFisico` ← `physicalExamData.examen_medico_texto` (string), o
 *   fallback a `impresion_diagnostica` legacy si no hay slot nuevo (DA-1).
 * - `fechaEmision` ← `defaults.fechaEmision ?? new Date()`.
 * - `medicoEvaluador` ← `defaults.medicoEvaluador` (opcional).
 * - `medicoRevisor` ← `defaults.medicoRevisor` (opcional).
 *
 * **IMPL-20260817-12-C1 (Corte 4.5 — fix schema):** "Cada prueba con su
 * slot independiente en BD" (Frank 2026-08-17). Antes había 1 solo campo
 * `impresion_diagnostica` que mezclaba todo; ahora se concatenan los 5
 * slots para construir el "Diagnóstico Final" del dictamen.
 *
 * **Defensa en profundidad:** todos los campos se normalizan a `string` con
 * `typeof === 'string'` para tolerar datos corruptos / legacy en BD.
 *
 * @param physicalExamData - JSON del examen (`MedicalExam.physicalExamData`).
 * @param existing - Dictamen existente (opcional). Si está presente, se
 *                   devuelve intacto para preservar edición manual previa.
 * @param defaults - Defaults operacionales (médico evaluador, fecha, etc.).
 * @returns Datos propuestos para crear/actualizar el dictamen.
 */
export function buildVerdictFromExam(
  physicalExamData: Record<string, unknown>,
  existing?: PartialVerdictBuildOutput | null,
  defaults?: VerdictBuildDefaults
): VerdictBuildOutput {
  // DA-2: preservar edición manual previa del médico.
  if (existing) {
    return {
      aptitud: existing.aptitud ?? DEFAULT_APTITUD,
      impresionDiagnostica: existing.impresionDiagnostica ?? '',
      recomendaciones: existing.recomendaciones ?? '',
      examenFisico: existing.examenFisico ?? '',
      fechaEmision: existing.fechaEmision ?? defaults?.fechaEmision ?? new Date(),
      medicoEvaluador: existing.medicoEvaluador ?? defaults?.medicoEvaluador,
      medicoRevisor: existing.medicoRevisor ?? defaults?.medicoRevisor,
    }
  }

  const aptitud =
    typeof physicalExamData.aptitud === 'string' && physicalExamData.aptitud.length > 0
      ? physicalExamData.aptitud
      : DEFAULT_APTITUD

  const recomendaciones =
    typeof physicalExamData.recomendaciones === 'string'
      ? physicalExamData.recomendaciones
      : ''

  // IMPL-20260817-12-C1: leer los 5 slots por prueba + legacy fallback.
  const legacy = typeof physicalExamData.impresion_diagnostica === 'string'
    ? physicalExamData.impresion_diagnostica
    : ''

  const examenMedicoTexto = typeof physicalExamData.examen_medico_texto === 'string'
    ? physicalExamData.examen_medico_texto
    : ''

  const audiometriaTexto = typeof physicalExamData.audiometria_texto === 'string'
    ? physicalExamData.audiometria_texto
    : ''

  const espirometriaTexto = typeof physicalExamData.espirometria_texto === 'string'
    ? physicalExamData.espirometria_texto
    : ''

  const laboratoriosTexto = typeof physicalExamData.laboratorios_texto === 'string'
    ? physicalExamData.laboratorios_texto
    : ''

  const radiografiaTexto = typeof physicalExamData.radiografia_texto === 'string'
    ? physicalExamData.radiografia_texto
    : ''

  // Construir el texto consolidado del "Diagnóstico Final" del dictamen
  // concatenando los 5 slots con prefijo del nombre de la prueba.
  const consolidatedParts: string[] = []
  if (examenMedicoTexto) consolidatedParts.push(`Examen médico: ${examenMedicoTexto}`)
  if (audiometriaTexto) consolidatedParts.push(`Audiometría: ${audiometriaTexto}`)
  if (espirometriaTexto) consolidatedParts.push(`Espirometría: ${espirometriaTexto}`)
  if (laboratoriosTexto) consolidatedParts.push(`Laboratorios: ${laboratoriosTexto}`)
  if (radiografiaTexto) consolidatedParts.push(`Radiografía: ${radiografiaTexto}`)

  const impresionDiagnostica = consolidatedParts.length > 0
    ? consolidatedParts.join('. ')
    : legacy // DA-1 fallback

  // `examenFisico` es el texto del campo "EXAMEN MEDICO" en el PDF
  // (tabla resumen 9 campos). Preferencia: slot nuevo, fallback legacy.
  const examenFisico = examenMedicoTexto || legacy

  return {
    aptitud,
    impresionDiagnostica,
    recomendaciones,
    examenFisico,
    fechaEmision: defaults?.fechaEmision ?? new Date(),
    medicoEvaluador: defaults?.medicoEvaluador,
    medicoRevisor: defaults?.medicoRevisor,
  }
}
