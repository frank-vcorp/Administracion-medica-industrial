/**
 * @fileoverview Resumen compacto del cuestionario de Espirometría
 *   (FEATURE-20260824-02). Se muestra después de guardar o editar:
 *
 *   - Estado: completado / incompleto.
 *   - Fecha de captura (capturedAt).
 *   - Botón Editar cuestionario (reabre el modal).
 *
 * NO emite diagnóstico, NO muestra datos sensibles crudos. Sólo metadatos
 * del snapshot y conteos de respuestas Sí/No para feedback rápido.
 *
 * @id IMPL-FEATURE-20260824-02
 */
'use client'

import type { EspirometriaQuestionnairePayload } from '@/schemas/clinical/espirometria-questionnaire.schema'

export type EspirometriaQuestionnaireSummaryProps = {
  payload: EspirometriaQuestionnairePayload | null
  onEdit: () => void
}

function formatCapturedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function countSi(antecedentes: EspirometriaQuestionnairePayload['antecedentes']): {
  si: number
  no: number
  total: number
} {
  const boolKeys = [
    'espirometria_previa',
    'dificultad_respirar',
    'exposicion_ocupacional',
    'fuma_o_fumo',
    'antecedente_cardiopulmonar_o_epilepsia',
    'usa_inhalador',
    'cirugia_reciente',
  ] as const
  let si = 0
  let no = 0
  for (const k of boolKeys) {
    if (antecedentes[k] === 'SI') si++
    else if (antecedentes[k] === 'NO') no++
  }
  return { si, no, total: boolKeys.length }
}

export default function EspirometriaQuestionnaireSummary({
  payload,
  onEdit,
}: EspirometriaQuestionnaireSummaryProps) {
  if (!payload) {
    // El componente padre decide si muestra el call-to-action en lugar de
    // invocar este componente; aquí siempre recibimos un payload presente.
    return null
  }
  const counts = countSi(payload.antecedentes)

  return (
    <div
      className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-2"
      data-testid="espirometria-questionnaire-summary"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-teal-800 flex items-center gap-2">
            <span aria-hidden="true">📋</span>
            Cuestionario de Espirometría completado
          </p>
          <p className="text-xs text-teal-700 mt-1">
            Guardado el {formatCapturedAt(payload.capturedAt)}.
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="bg-white hover:bg-teal-100 text-teal-700 border border-teal-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          data-testid="espirometria-questionnaire-edit"
        >
          Editar cuestionario
        </button>
      </div>
      <p className="text-[11px] text-teal-700">
        Antecedentes: {counts.si} respuestas «Sí» y {counts.no} «No» de{' '}
        {counts.total} preguntas Sí/No. Este contexto se envía al
        prediagnóstico IA.
      </p>
    </div>
  )
}
