/**
 * Utilidades puras para construir y decodificar el código QR de citas.
 * Soporta URL directa de check-in (`/appointments?checkin=EXP-...`),
 * formato JSON legado (`{"exp":"EXP-..."}`) y folio directo (`EXP-...`).
 */

const EXPEDIENT_FOLIO_PATTERN = /^[A-Z]{2,8}-\d{4,}$/i

export function buildAppointmentCheckInUrl(expedientId: string, baseUrl: string): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '')
  return `${cleanBase}/appointments?checkin=${encodeURIComponent(expedientId.trim())}`
}

export function parseAppointmentQrExpedientId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    try {
      const parsed = trimmed.startsWith('/')
        ? new URL(trimmed, 'http://localhost')
        : new URL(trimmed)
      const param =
        parsed.searchParams.get('checkin')?.trim() ||
        parsed.searchParams.get('exp')?.trim() ||
        ''
      if (EXPEDIENT_FOLIO_PATTERN.test(param)) {
        return param
      }
    } catch {
      /* continuar a JSON/folio */
    }
  }

  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed) as { exp?: unknown }
      if (typeof data?.exp === 'string' && EXPEDIENT_FOLIO_PATTERN.test(data.exp.trim())) {
        return data.exp.trim()
      }
    } catch {
      return null
    }
  }

  if (EXPEDIENT_FOLIO_PATTERN.test(trimmed)) {
    return trimmed
  }

  return null
}

export function parseDataUrlBase64(
  dataUrl: string | null | undefined,
): { mimetype: string; dataBase64: string } | null {
  if (!dataUrl) return null
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim())
  if (!match) return null
  return {
    mimetype: match[1],
    dataBase64: match[2],
  }
}
