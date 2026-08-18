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
 * - `impresionDiagnostica` ← `physicalExamData.impresion_diagnostica` (string),
 *   o `''`.
 * - `recomendaciones` ← `physicalExamData.recomendaciones` (string), o `''`.
 * - `examenFisico` ← `physicalExamData.examen_medico_texto` (string), o `''`.
 * - `fechaEmision` ← `defaults.fechaEmision ?? new Date()`.
 * - `medicoEvaluador` ← `defaults.medicoEvaluador` (opcional).
 * - `medicoRevisor` ← `defaults.medicoRevisor` (opcional).
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

  const impresionDiagnostica =
    typeof physicalExamData.impresion_diagnostica === 'string'
      ? physicalExamData.impresion_diagnostica
      : ''

  const recomendaciones =
    typeof physicalExamData.recomendaciones === 'string'
      ? physicalExamData.recomendaciones
      : ''

  const examenFisico =
    typeof physicalExamData.examen_medico_texto === 'string'
      ? physicalExamData.examen_medico_texto
      : ''

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
