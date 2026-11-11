/** Rutas técnicas Zod → etiqueta legible en español (modo oración). */
export const ZOD_FIELD_LABELS: Record<string, string> = {
  peso_kg: 'Peso (kg)',
  talla_m: 'Talla (m)',
  ta_sistolica: 'Tensión arterial (sistólica)',
  ta_diastolica: 'Tensión arterial (diastólica)',
  fc_min: 'Frecuencia cardíaca',
  vision_lejana_od: 'Agudeza visual — ojo derecho (lejana)',
  vision_lejana_oi: 'Agudeza visual — ojo izquierdo (lejana)',
  vision_cercana_od: 'Agudeza visual — ojo derecho (cercana)',
  vision_cercana_oi: 'Agudeza visual — ojo izquierdo (cercana)',
  impresion_diagnostica: 'Impresión diagnóstica',
  recomendaciones_clinicas: 'Recomendaciones clínicas',
  antecedentes: 'Antecedentes',
  medico_cedula: 'Cédula profesional del médico',
  medico_nombre: 'Nombre del médico',
  medico_titulo: 'Título del médico',
  medico_universidad: 'Universidad del médico',
  integracion_diagnostica: 'Integración diagnóstica',
  exploracion_fisica: 'Exploración física',
  dictamen_laboral: 'Dictamen laboral',
  dictamen_laboral_texto: 'Texto del dictamen',
  lugar_expedicion: 'Lugar de expedición',
  domicilio_atencion: 'Domicilio de atención',
  motivo_consulta: 'Motivo de consulta',
  workerId: 'Trabajador',
  companyId: 'Empresa',
  branchId: 'Sucursal',
  scheduledAt: 'Fecha y hora de la cita',
  firstName: 'Nombre(s)',
  lastName: 'Apellidos',
  medicalProfileId: 'Perfil médico',
  date: 'Fecha',
  time: 'Hora',
  exceptionComment: 'Comentario operativo',
  exceptionReason: 'Motivo de excepción',
  informedConsentSignatureDataUrl: 'Firma del consentimiento',
  frontFileDataUrl: 'Evidencia frontal del documento',
  name: 'Nombre',
  rfc: 'RFC',
  basic: 'Datos básicos',
}

function pathSegmentLabel(segment: string): string {
  if (ZOD_FIELD_LABELS[segment]) return ZOD_FIELD_LABELS[segment]
  const spaced = segment.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function zodPathToPlainLanguage(path: (string | number)[]): string {
  if (path.length === 0) return 'Formulario'
  return path
    .map((p) => (typeof p === 'number' ? `Ítem ${p + 1}` : pathSegmentLabel(String(p))))
    .join(' · ')
}

export function fieldKeyToPlainLanguage(fieldKey: string): string {
  if (fieldKey === '_root' || fieldKey === '_form') return 'Formulario'
  return zodPathToPlainLanguage(fieldKey.split('.'))
}
