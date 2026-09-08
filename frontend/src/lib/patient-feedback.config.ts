const DEFAULT_SURVEY_PATH = '/feedback/satisfaction'

export function buildServiceRatingMessage(patientFirstName: string): string {
  const name = patientFirstName.trim() || 'paciente'
  return [
    `Hola ${name}, gracias por visitarnos en Soluciones Médico Empresariales.`,
    '¿Cómo calificarías tu atención hoy? Responde del 1 al 10.',
    'Tu opinión nos ayuda a mejorar.',
  ].join(' ')
}

export function normalizeMexicoPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  if (digits.length === 10) return `52${digits}`
  if (digits.startsWith('52') && digits.length >= 12) return digits
  return digits
}

export function buildWhatsAppRatingLink(phone: string, patientFirstName: string): string | null {
  const normalized = normalizeMexicoPhone(phone)
  if (!normalized) return null
  const text = encodeURIComponent(buildServiceRatingMessage(patientFirstName))
  return `https://wa.me/${normalized}?text=${text}`
}

/** URL de encuesta (#14). Configurable vía env; fallback ruta in-app. */
export function getSatisfactionSurveyUrl(origin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SATISFACTION_SURVEY_URL?.trim()
  if (configured) {
    if (configured.startsWith('http')) return configured
    if (origin) return `${origin}${configured.startsWith('/') ? configured : `/${configured}`}`
    return configured.startsWith('/') ? configured : `/${configured}`
  }
  return DEFAULT_SURVEY_PATH
}
