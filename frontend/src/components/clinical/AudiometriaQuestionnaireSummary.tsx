/**
 * @fileoverview Resumen compacto del cuestionario auditivo de Audiometría
 *   (FEATURE-20260825-02). Se muestra después de guardar o editar:
 *
 *   - Estado: completado / incompleto.
 *   - Fecha de captura (capturedAt).
 *   - Conteo de respuestas Sí/No (sin mostrar texto sensible crudo).
 *   - Botón Editar cuestionario (reabre el modal).
 *
 * NO emite diagnóstico, NO muestra datos sensibles crudos.
 *
 * @id IMPL-FEATURE-20260825-02
 */
'use client'

import type { AudiometriaQuestionnairePayload } from '@/schemas/clinical/audiometria-questionnaire.schema'

export type AudiometriaQuestionnaireSummaryProps = {
  payload: AudiometriaQuestionnairePayload | null
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

function countSi(
  antecedentes: AudiometriaQuestionnairePayload['antecedentes'],
): { si: number; no: number; total: number } {
  const boolKeys = [
    'audiometria_previa',
    'dificultad_auditiva',
    'exposicion_ruido_laboral',
    'exposicion_ruido_recreativa',
    'explosion_o_trauma',
    'infecciones_oticas',
    'tinnitus_o_mareos',
    'medicamentos_otoxicos',
  ] as const
  let si = 0
  let no = 0
  for (const k of boolKeys) {
    if (antecedentes[k] === 'SI') si++
    else if (antecedentes[k] === 'NO') no++
  }
  return { si, no, total: boolKeys.length }
}

export default function AudiometriaQuestionnaireSummary({
  payload,
  onEdit,
}: AudiometriaQuestionnaireSummaryProps) {
  if (!payload) {
    return null
  }
  const counts = countSi(payload.antecedentes)

  return (
    <div
      className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-2"
      data-testid="audiometria-questionnaire-summary"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-teal-800 flex items-center gap-2">
            <span aria-hidden="true">📋</span>
            Cuestionario de Audiometría completado
          </p>
          <p className="text-xs text-teal-700 mt-1">
            Guardado el {formatCapturedAt(payload.capturedAt)}.
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="bg-white hover:bg-teal-100 text-teal-700 border border-teal-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          data-testid="audiometria-questionnaire-edit"
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