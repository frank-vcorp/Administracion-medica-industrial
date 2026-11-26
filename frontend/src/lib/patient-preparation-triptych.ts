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
  try {
    return await readFile(absolute)
  } catch (fsErr) {
    // En despliegues serverless (Vercel), `public/` puede no quedar en `process.cwd()`.
    const publicUrl = resolvePublicPatientTriptychUrl()
    const res = await fetch(publicUrl, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) {
      throw fsErr instanceof Error
        ? fsErr
        : new Error(`No se pudo descargar el tríptico (${res.status})`)
    }
    const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
    const buf = Buffer.from(await res.arrayBuffer())
    const hasPdfHeader = buf.subarray(0, 5).toString('ascii') === '%PDF-'
    if (!contentType.includes('pdf') && !hasPdfHeader) {
      throw new Error('La respuesta pública del tríptico no es un PDF válido')
    }
    return buf
  }
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
