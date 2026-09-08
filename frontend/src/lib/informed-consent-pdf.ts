import fs from 'fs/promises'
import path from 'path'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export interface InformedConsentPdfInput {
  patientFullName: string
  signedAt: Date
  /** PNG data URL (`data:image/png;base64,...`) de la firma autógrafa. */
  signatureDataUrl: string
}

const TEMPLATE_REL = path.join('public', 'templates', 'consentimiento-informado.pdf')

/** Posiciones calibradas sobre el PDF oficial (letter 612×792). */
const LAYOUT = {
  date: { x: 430, y: 615, size: 11 },
  name: { x: 108, y: 570, size: 11, maxWidth: 420 },
  signature: { x: 130, y: 72, width: 220, height: 50 },
} as const

function formatConsentDate(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function parsePngDataUrl(dataUrl: string): Uint8Array {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim())
  if (!match) {
    throw new Error('La firma debe ser una imagen PNG en data URL.')
  }
  return Uint8Array.from(Buffer.from(match[1], 'base64'))
}

async function loadTemplateBytes(): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), TEMPLATE_REL)
  return await fs.readFile(templatePath)
}

/**
 * Superpone nombre, fecha y firma autógrafa sobre la plantilla oficial AMI.
 */
export async function buildInformedConsentPdf(input: InformedConsentPdfInput): Promise<Buffer> {
  const templateBytes = await loadTemplateBytes()
  const pdfDoc = await PDFDocument.load(templateBytes)
  const page = pdfDoc.getPages()[0]
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const dateLabel = formatConsentDate(input.signedAt)
  const name = input.patientFullName.trim()

  page.drawText(dateLabel, {
    x: LAYOUT.date.x,
    y: LAYOUT.date.y,
    size: LAYOUT.date.size,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })

  page.drawText(name, {
    x: LAYOUT.name.x,
    y: LAYOUT.name.y,
    size: LAYOUT.name.size,
    font: fontBold,
    color: rgb(0.05, 0.05, 0.05),
    maxWidth: LAYOUT.name.maxWidth,
  })

  const signatureBytes = parsePngDataUrl(input.signatureDataUrl)
  const signatureImage = await pdfDoc.embedPng(signatureBytes)
  page.drawImage(signatureImage, {
    x: LAYOUT.signature.x,
    y: LAYOUT.signature.y,
    width: LAYOUT.signature.width,
    height: LAYOUT.signature.height,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

export function informedConsentFileKey(workerId: string, appointmentId: string): string {
  const ts = Date.now()
  return `consent/${workerId}/${appointmentId}-${ts}.pdf`
}
