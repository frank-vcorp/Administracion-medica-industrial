import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** Ruta pública servida por Next (`frontend/public/docs/...`). */
export const PATIENT_PREPARATION_TRIPTYCH_PUBLIC_PATH = '/docs/tips-para-pacientes.pdf'

export const PATIENT_PREPARATION_TRIPTYCH_FILENAME = 'tips-para-pacientes.pdf'

export async function readPatientPreparationTriptychPdf(): Promise<Buffer> {
  const absolute = path.join(
    process.cwd(),
    'public',
    'docs',
    PATIENT_PREPARATION_TRIPTYCH_FILENAME,
  )
  return readFile(absolute)
}

/** URL pública del tríptico (fallback si el gateway aún no tiene send-document-key). */
export function resolvePublicPatientTriptychUrl(): string {
  const base =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  return `${base.replace(/\/$/, '')}${PATIENT_PREPARATION_TRIPTYCH_PUBLIC_PATH}`
}
