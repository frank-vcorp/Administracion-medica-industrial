/**
 * Comparación de nombre del paciente (expediente) vs extracción de PDF/XML.
 * Minuta 8-Sep #2–#3: bloquear subida cuando el documento no corresponde al trabajador.
 */

import prisma from '@/lib/prisma'

export function normalizePersonName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tokens significativos (ignora iniciales de una letra sueltas). */
function nameTokens(normalized: string): string[] {
  return normalized.split(' ').filter((t) => t.length > 1)
}

/**
 * Extrae el nombre del paciente del payload estructurado del pipeline de IA.
 */
export function extractPatientNameFromStructuredData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>

  if (typeof root.paciente === 'string' && root.paciente.trim()) {
    return root.paciente.trim()
  }

  const pacienteObj = root.paciente
  if (pacienteObj && typeof pacienteObj === 'object') {
    const nombre = (pacienteObj as Record<string, unknown>).nombre_completo
    if (typeof nombre === 'string' && nombre.trim()) return nombre.trim()
  }

  const detalle = root.paciente_detalle
  if (detalle && typeof detalle === 'object') {
    const nombre = (detalle as Record<string, unknown>).nombre_completo
    if (typeof nombre === 'string' && nombre.trim()) return nombre.trim()
  }

  return null
}

/**
 * Coincidencia estricta: todos los tokens del nombre en expediente deben
 * aparecer en el nombre extraído del documento (orden irrelevante).
 */
export function patientNamesMatch(workerFullName: string, extractedName: string): boolean {
  const workerNorm = normalizePersonName(workerFullName)
  const extractedNorm = normalizePersonName(extractedName)
  if (!workerNorm || !extractedNorm) return false
  if (workerNorm === extractedNorm) return true

  const workerParts = nameTokens(workerNorm)
  const extractedSet = new Set(nameTokens(extractedNorm))
  if (workerParts.length === 0) return false

  const allWorkerTokensFound = workerParts.every((t) => extractedSet.has(t))
  if (!allWorkerTokensFound) return false

  // Al menos un apellido del documento debe estar en el expediente (evita homónimos parciales).
  const extractedParts = nameTokens(extractedNorm)
  const workerSet = new Set(workerParts)
  const overlap = extractedParts.filter((t) => workerSet.has(t)).length
  return overlap >= Math.min(2, workerParts.length)
}

export type PatientNameMismatchDetail = {
  workerFullName: string
  extractedName: string
}

export function buildPatientNameMismatchMessage(detail: PatientNameMismatchDetail): string {
  return (
    `El nombre en el documento («${detail.extractedName}») no coincide con el paciente del expediente ` +
    `(«${detail.workerFullName}»). Verifique el archivo o los datos del trabajador antes de subir.`
  )
}

export async function assertExtractedPatientNameMatchesEvent(
  eventId: string,
  extractedData: unknown,
): Promise<
  | { ok: true }
  | { ok: false; error: string; errorCode: 'PATIENT_NAME_MISMATCH' }
> {
  const extractedName = extractPatientNameFromStructuredData(extractedData)
  if (!extractedName) {
    return { ok: true }
  }

  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    select: {
      worker: { select: { firstName: true, lastName: true } },
    },
  })
  if (!event?.worker) {
    return { ok: true }
  }

  const workerFullName = `${event.worker.firstName} ${event.worker.lastName}`.trim()
  if (!patientNamesMatch(workerFullName, extractedName)) {
    return {
      ok: false,
      errorCode: 'PATIENT_NAME_MISMATCH',
      error: buildPatientNameMismatchMessage({ workerFullName, extractedName }),
    }
  }

  return { ok: true }
}
