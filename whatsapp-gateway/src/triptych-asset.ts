import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** Claves de PDF embebidos en `assets/` del gateway (S23-03). */
export const GATEWAY_DOCUMENT_KEYS = {
  patient_preparation_triptych: 'tips-para-pacientes.pdf',
} as const

export type GatewayDocumentKey = keyof typeof GATEWAY_DOCUMENT_KEYS

export async function readGatewayDocumentAsset(key: GatewayDocumentKey): Promise<{
  buffer: Buffer
  fileName: string
  mimetype: string
}> {
  const fileName = GATEWAY_DOCUMENT_KEYS[key]
  const filePath = path.join(process.cwd(), 'assets', fileName)
  const buffer = await readFile(filePath)
  return { buffer, fileName, mimetype: 'application/pdf' }
}
