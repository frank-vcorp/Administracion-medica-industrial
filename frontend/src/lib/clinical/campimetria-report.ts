/**
 * Texto de impresión / recomendaciones del reporte 005-2018 (derivado, no se teclea).
 * @id IMPL-FEATURE-20260914-01
 */
import type { CampimetriaQuestionnairePayload } from '@/schemas/clinical/campimetria-questionnaire.schema'
import type { InheritedAcuity } from '@/lib/clinical/campimetria-inherited'

export function buildCampimetriaImpresion(input: {
  payload: CampimetriaQuestionnairePayload
  acuity: InheritedAcuity
}): string {
  const av =
    input.acuity.pending
      ? 'AGUDEZA VISUAL PENDIENTE EN PAPELETA'
      : input.acuity.resumen === 'DISMINUIDA' ||
          input.acuity.resumen === 'BAJA AL MOMENTO DE LA TOMA'
        ? 'AGUDEZA VISUAL DISMINUIDA'
        : 'AGUDEZA VISUAL NORMAL'

  const camposNormal =
    input.payload.confrontacion.ojo_derecho ===
      'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES' &&
    input.payload.confrontacion.ojo_izquierdo ===
      'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES'
  const campos = camposNormal
    ? 'CAMPOS VISUALES EN PARAMETROS NORMALES'
    : 'CAMPOS VISUALES ALTERADOS'

  const color =
    input.payload.ishihara.resultado === 'NORMAL'
      ? 'SIN ALTERACION EN DISCRIMINACION DE COLORES'
      : input.payload.ishihara.resultado === 'NO APLICA'
        ? 'PRUEBA DE ISHIHARA NO APLICA'
        : 'ALTERACION EN DISCRIMINACION DE COLORES'

  return `${av}, ${campos}, ${color}`
}

export function buildCampimetriaRecomendaciones(input: {
  payload: CampimetriaQuestionnairePayload
  acuity: InheritedAcuity
}): string {
  const parts = ['VALORACION OFTALMOLOGICA ANUAL']
  if (
    input.payload.ishihara.resultado === 'ALTERADO' ||
    input.payload.confrontacion.ojo_derecho === 'ALTERADOS' ||
    input.payload.confrontacion.ojo_izquierdo === 'ALTERADOS' ||
    input.acuity.resumen === 'DISMINUIDA'
  ) {
    parts.push('VALORACION CON OFTALMOLOGIA / OPTOMETRISTA')
  }
  return parts.join('. ')
}
