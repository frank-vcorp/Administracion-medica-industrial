import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib'
import { SME_LEGAL_NAME_FULL } from '@/lib/brand-constants'
import {
  formatInformedConsentDate,
  INFORMED_CONSENT_BODY_INTRO,
  INFORMED_CONSENT_FORMAT_CODE,
  INFORMED_CONSENT_LEGAL_NOTE,
  INFORMED_CONSENT_MANIFESTATION_INTRO,
  INFORMED_CONSENT_MANIFESTATION_ITEMS,
  INFORMED_CONSENT_MANIFESTATION_TITLE,
  INFORMED_CONSENT_PRIVACY_TITLE,
  INFORMED_CONSENT_SECTIONS,
  INFORMED_CONSENT_TITLE,
  SME_ADDRESS_FULL,
  SME_ARCO_EMAIL,
  SME_ARCO_PHONE,
} from '@/lib/informed-consent-content'

export interface InformedConsentPdfInput {
  patientFullName: string
  signedAt: Date
  /** PNG data URL (`data:image/png;base64,...`) de la firma autógrafa. */
  signatureDataUrl: string
  companyName?: string | null
  workerUniversalId?: string | null
  jobPosition?: string | null
  expedientId?: string | null
}

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 46
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const TOP_START_Y = 742
const BOTTOM_LIMIT_Y = 52

const SME_PURPLE = rgb(0.349, 0.173, 0.51)
const SME_TEAL = rgb(0, 0.686, 0.667)
const TEXT_DARK = rgb(0.1, 0.13, 0.18)
const TEXT_MUTED = rgb(0.38, 0.43, 0.5)
const BORDER_LIGHT = rgb(0.84, 0.87, 0.91)
const BOX_BG = rgb(0.97, 0.98, 0.99)

const CP1252_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
])

function sanitizeWinAnsi(raw: string): string {
  const preNormalized = raw
    .replace(/\u00A0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[✓✔]/g, 'Si')
    .replace(/☐/g, '[ ]')
    .replace(/☑/g, '[X]')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')

  let out = ''
  for (const ch of preNormalized) {
    const code = ch.codePointAt(0) ?? 0
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.has(code)) {
      out += ch
    } else if (code >= 0x20) {
      out += '-'
    }
  }
  return out
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const clean = sanitizeWinAnsi(text).trim()
  if (!clean) return []

  const words = clean.split(/\s+/)
  const lines: string[] = []
  let current = ''

  const pushOversizedToken = (token: string) => {
    let chunk = ''
    for (const char of token) {
      const candidate = chunk + char
      if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(chunk)
        chunk = char
      } else {
        chunk = candidate
      }
    }
    if (chunk) current = chunk
  }

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) {
      lines.push(current)
      current = ''
    }
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word
    } else {
      pushOversizedToken(word)
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

function parsePngDataUrl(dataUrl: string): Uint8Array {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim())
  if (!match) {
    throw new Error('La firma debe ser una imagen PNG en data URL.')
  }
  return Uint8Array.from(Buffer.from(match[1], 'base64'))
}

class ConsentPdfWriter {
  public readonly pages: PDFPage[] = []
  private currentPage!: PDFPage
  private y = TOP_START_Y

  constructor(
    private readonly pdfDoc: PDFDocument,
    private readonly font: PDFFont,
    private readonly fontBold: PDFFont,
    private readonly patientName: string,
    private readonly dateLabel: string,
  ) {}

  addPage(withRunningHeader: boolean): void {
    const page = this.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.pages.push(page)
    this.currentPage = page
    if (withRunningHeader) {
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: SME_PURPLE })
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 2, color: SME_TEAL })
      page.drawText(
        sanitizeWinAnsi(`${SME_LEGAL_NAME_FULL} (SME) — Consentimiento Informado`),
        { x: MARGIN_X, y: PAGE_HEIGHT - 24, size: 7.5, font: this.fontBold, color: TEXT_MUTED },
      )
      const rightLabel = sanitizeWinAnsi(`${this.patientName} · ${this.dateLabel}`)
      const rightWidth = this.font.widthOfTextAtSize(rightLabel, 7.5)
      page.drawText(rightLabel, {
        x: PAGE_WIDTH - MARGIN_X - rightWidth,
        y: PAGE_HEIGHT - 24,
        size: 7.5,
        font: this.font,
        color: TEXT_MUTED,
      })
      this.y = PAGE_HEIGHT - 44
    } else {
      this.y = TOP_START_Y
    }
  }

  ensureSpace(requiredHeight: number): void {
    if (this.y - requiredHeight < BOTTOM_LIMIT_Y) {
      this.addPage(true)
    }
  }

  drawFirstPageHeader(meta: {
    companyName?: string | null
    workerUniversalId?: string | null
    jobPosition?: string | null
    expedientId?: string | null
  }): void {
    this.addPage(false)
    const p = this.currentPage

    // Encabezado SME morado + franja teal
    p.drawRectangle({ x: 0, y: PAGE_HEIGHT - 68, width: PAGE_WIDTH, height: 68, color: SME_PURPLE })
    p.drawRectangle({ x: 0, y: PAGE_HEIGHT - 71, width: PAGE_WIDTH, height: 3, color: SME_TEAL })

    p.drawText(sanitizeWinAnsi(`${SME_LEGAL_NAME_FULL.toUpperCase()} ("SME")`), {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 26,
      size: 9,
      font: this.fontBold,
      color: rgb(0.84, 0.96, 0.96),
    })

    p.drawText(sanitizeWinAnsi(INFORMED_CONSENT_TITLE), {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 44,
      size: 12.5,
      font: this.fontBold,
      color: rgb(1, 1, 1),
    })

    p.drawText(sanitizeWinAnsi(`Domicilio: ${SME_ADDRESS_FULL}`), {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 58,
      size: 7.5,
      font: this.font,
      color: rgb(0.91, 0.9, 0.96),
    })

    // Caja de datos del titular
    const rows: Array<[string, string]> = [
      ['Persona titular:', this.patientName || '-'],
      ['Fecha:', this.dateLabel],
    ]
    if (meta.companyName?.trim()) rows.push(['Empresa contratante:', meta.companyName.trim()])
    if (meta.workerUniversalId?.trim()) rows.push(['ID Trabajador:', meta.workerUniversalId.trim()])
    if (meta.expedientId?.trim()) rows.push(['Folio de cita:', meta.expedientId.trim()])
    if (meta.jobPosition?.trim()) rows.push(['Puesto:', meta.jobPosition.trim()])

    const numGridRows = Math.ceil(rows.length / 2)
    const boxTop = PAGE_HEIGHT - 84
    const rowHeight = 15
    const boxHeight = 14 + numGridRows * rowHeight

    p.drawRectangle({
      x: MARGIN_X,
      y: boxTop - boxHeight,
      width: CONTENT_WIDTH,
      height: boxHeight,
      color: BOX_BG,
      borderColor: BORDER_LIGHT,
      borderWidth: 0.75,
    })

    const colWidth = CONTENT_WIDTH / 2 - 12
    rows.forEach(([label, value], idx) => {
      const col = idx % 2
      const row = Math.floor(idx / 2)
      const cellX = MARGIN_X + 10 + col * (CONTENT_WIDTH / 2)
      const cellY = boxTop - 16 - row * rowHeight
      const labelText = sanitizeWinAnsi(label)
      const labelW = this.fontBold.widthOfTextAtSize(labelText, 8.2)
      p.drawText(labelText, {
        x: cellX,
        y: cellY,
        size: 8.2,
        font: this.fontBold,
        color: TEXT_DARK,
      })
      const valueText = sanitizeWinAnsi(value)
      const truncated = wrapText(valueText, this.font, 8.2, Math.max(40, colWidth - labelW - 4))[0] ?? ''
      p.drawText(truncated, {
        x: cellX + labelW + 4,
        y: cellY,
        size: 8.2,
        font: this.font,
        color: TEXT_DARK,
      })
    })

    this.y = boxTop - boxHeight - 16
  }

  drawParagraph(text: string, opts?: { size?: number; lineHeight?: number; indent?: number; boldPrefix?: string; gapAfter?: number }): void {
    const size = opts?.size ?? 8.8
    const lineHeight = opts?.lineHeight ?? 11.8
    const indent = opts?.indent ?? 0
    const gapAfter = opts?.gapAfter ?? 5
    const fullText = opts?.boldPrefix ? `${opts.boldPrefix}${text}` : text
    const lines = wrapText(fullText, this.font, size, CONTENT_WIDTH - indent)

    for (let i = 0; i < lines.length; i++) {
      this.ensureSpace(lineHeight + 2)
      const line = lines[i]
      if (i === 0 && opts?.boldPrefix && line.startsWith(sanitizeWinAnsi(opts.boldPrefix))) {
        const prefixClean = sanitizeWinAnsi(opts.boldPrefix)
        const rest = line.slice(prefixClean.length)
        this.currentPage.drawText(prefixClean, {
          x: MARGIN_X + indent,
          y: this.y,
          size,
          font: this.fontBold,
          color: TEXT_DARK,
        })
        const prefixW = this.fontBold.widthOfTextAtSize(prefixClean, size)
        if (rest) {
          this.currentPage.drawText(rest, {
            x: MARGIN_X + indent + prefixW,
            y: this.y,
            size,
            font: this.font,
            color: TEXT_DARK,
          })
        }
      } else {
        this.currentPage.drawText(line, {
          x: MARGIN_X + indent,
          y: this.y,
          size,
          font: this.font,
          color: TEXT_DARK,
        })
      }
      this.y -= lineHeight
    }

    this.y -= gapAfter
  }

  drawCenteredHeading(text: string): void {
    this.ensureSpace(24)
    const clean = sanitizeWinAnsi(text)
    const size = 10
    const width = this.fontBold.widthOfTextAtSize(clean, size)
    this.currentPage.drawText(clean, {
      x: Math.max(MARGIN_X, (PAGE_WIDTH - width) / 2),
      y: this.y,
      size,
      font: this.fontBold,
      color: SME_PURPLE,
    })
    this.y -= 16
  }

  drawSectionTitle(roman: string, title: string): void {
    const cleanTitle = sanitizeWinAnsi(`${roman}. ${title}`)
    const lines = wrapText(cleanTitle, this.fontBold, 8.8, CONTENT_WIDTH)
    // Garantizar encabezado + al menos 2 líneas de cuerpo juntas
    this.ensureSpace(lines.length * 11.5 + 28)
    for (const line of lines) {
      this.currentPage.drawText(line, {
        x: MARGIN_X,
        y: this.y,
        size: 8.8,
        font: this.fontBold,
        color: TEXT_DARK,
      })
      this.y -= 11.5
    }
    this.y -= 1
  }

  drawSignatureBlock(signatureImage: Awaited<ReturnType<PDFDocument['embedPng']>>): void {
    this.ensureSpace(155)
    this.y -= 8

    const boxHeight = 135
    const boxBottom = this.y - boxHeight
    const p = this.currentPage

    p.drawRectangle({
      x: MARGIN_X,
      y: boxBottom,
      width: CONTENT_WIDTH,
      height: boxHeight,
      color: BOX_BG,
      borderColor: BORDER_LIGHT,
      borderWidth: 0.75,
    })

    const { width: sigW, height: sigH } = signatureImage.scaleToFit(210, 56)
    const sigX = MARGIN_X + 18 + (210 - sigW) / 2
    const sigBaseY = boxBottom + 56
    p.drawImage(signatureImage, {
      x: sigX,
      y: sigBaseY + (56 - sigH) / 2,
      width: sigW,
      height: sigH,
    })

    // Línea de firma
    p.drawLine({
      start: { x: MARGIN_X + 18, y: sigBaseY - 2 },
      end: { x: MARGIN_X + 228, y: sigBaseY - 2 },
      thickness: 0.8,
      color: TEXT_DARK,
    })
    p.drawText(sanitizeWinAnsi('Firma autógrafa de la persona titular'), {
      x: MARGIN_X + 18,
      y: sigBaseY - 13,
      size: 7.8,
      font: this.fontBold,
      color: TEXT_DARK,
    })

    // Columna derecha: nombre y fecha
    const infoX = MARGIN_X + 252
    p.drawText(sanitizeWinAnsi('Persona titular:'), {
      x: infoX,
      y: sigBaseY + 34,
      size: 8,
      font: this.fontBold,
      color: TEXT_MUTED,
    })
    const nameLines = wrapText(this.patientName || '-', this.fontBold, 9.2, CONTENT_WIDTH - 266)
    p.drawText(nameLines[0] ?? '-', {
      x: infoX,
      y: sigBaseY + 21,
      size: 9.2,
      font: this.fontBold,
      color: TEXT_DARK,
    })
    p.drawText(sanitizeWinAnsi(`Fecha de aceptación y firma: ${this.dateLabel}`), {
      x: infoX,
      y: sigBaseY + 4,
      size: 8,
      font: this.font,
      color: TEXT_DARK,
    })

    // Nota legal al pie de la caja
    const noteLines = wrapText(INFORMED_CONSENT_LEGAL_NOTE, this.font, 7.2, CONTENT_WIDTH - 32)
    let noteY = boxBottom + 28
    for (const line of noteLines.slice(0, 3)) {
      p.drawText(line, {
        x: MARGIN_X + 16,
        y: noteY,
        size: 7.2,
        font: this.font,
        color: TEXT_MUTED,
      })
      noteY -= 9
    }

    this.y = boxBottom - 10
  }

  stampFooters(): void {
    const total = this.pages.length
    const leftFooter = sanitizeWinAnsi(
      `${INFORMED_CONSENT_FORMAT_CODE} | ARCO: ${SME_ARCO_EMAIL} · Tel. ${SME_ARCO_PHONE}`,
    )

    this.pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN_X, y: 36 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: 36 },
        thickness: 0.5,
        color: BORDER_LIGHT,
      })
      page.drawText(leftFooter, {
        x: MARGIN_X,
        y: 24,
        size: 7,
        font: this.font,
        color: TEXT_MUTED,
      })
      const pageLabel = sanitizeWinAnsi(`Página ${index + 1} de ${total}`)
      const labelW = this.font.widthOfTextAtSize(pageLabel, 7)
      page.drawText(pageLabel, {
        x: PAGE_WIDTH - MARGIN_X - labelW,
        y: 24,
        size: 7,
        font: this.font,
        color: TEXT_MUTED,
      })
    })
  }
}

/**
 * Genera el PDF multipágina firmado del Consentimiento Informado y Aviso de Privacidad Integral SME
 * (sin depender de archivos estáticos externos).
 */
export async function buildInformedConsentPdf(input: InformedConsentPdfInput): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const dateLabel = formatInformedConsentDate(input.signedAt)
  const patientName = input.patientFullName.trim()
  const signatureBytes = parsePngDataUrl(input.signatureDataUrl)
  const signatureImage = await pdfDoc.embedPng(signatureBytes)

  const writer = new ConsentPdfWriter(pdfDoc, font, fontBold, patientName, dateLabel)

  writer.drawFirstPageHeader({
    companyName: input.companyName,
    workerUniversalId: input.workerUniversalId,
    jobPosition: input.jobPosition,
    expedientId: input.expedientId,
  })

  writer.drawParagraph(INFORMED_CONSENT_BODY_INTRO, {
    boldPrefix: `Yo ${patientName || '-'} `,
    size: 8.8,
    lineHeight: 12,
    gapAfter: 8,
  })

  writer.drawCenteredHeading(INFORMED_CONSENT_PRIVACY_TITLE)

  for (const section of INFORMED_CONSENT_SECTIONS) {
    writer.drawSectionTitle(section.roman, section.title)
    for (const paragraph of section.paragraphs) {
      writer.drawParagraph(paragraph, { size: 8.4, lineHeight: 11.2, gapAfter: 4 })
    }
    if (section.bullets) {
      for (const bullet of section.bullets) {
        writer.drawParagraph(`- ${bullet}`, {
          size: 8.3,
          lineHeight: 11,
          indent: 12,
          gapAfter: 2.5,
        })
      }
      writer.drawParagraph('', { gapAfter: 2 })
    }
    if (section.numberedItems) {
      section.numberedItems.forEach((item, idx) => {
        writer.drawParagraph(`${idx + 1}. ${item}`, {
          size: 8.3,
          lineHeight: 11,
          indent: 12,
          gapAfter: 2.5,
        })
      })
      writer.drawParagraph('', { gapAfter: 2 })
    }
    if (section.closingParagraph) {
      writer.drawParagraph(section.closingParagraph, { size: 8.4, lineHeight: 11.2, gapAfter: 4 })
    }
  }

  writer.ensureSpace(48)
  writer.drawSectionTitle('ANEXO', INFORMED_CONSENT_MANIFESTATION_TITLE)
  writer.drawParagraph(INFORMED_CONSENT_MANIFESTATION_INTRO, {
    size: 8.5,
    lineHeight: 11.4,
    gapAfter: 4,
  })
  for (const item of INFORMED_CONSENT_MANIFESTATION_ITEMS) {
    writer.drawParagraph(`[X] ${item}`, {
      size: 8.3,
      lineHeight: 11.2,
      indent: 8,
      gapAfter: 3,
    })
  }

  writer.drawSignatureBlock(signatureImage)
  writer.stampFooters()

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

export function informedConsentFileKey(workerId: string, appointmentId: string): string {
  const ts = Date.now()
  return `consent/${workerId}/${appointmentId}-${ts}.pdf`
}

/** Ingreso directo recepción (sin cita en agenda). */
export function informedConsentFileKeyReceptionWalkIn(workerId: string): string {
  return `consent/${workerId}/reception-walk-in-${Date.now()}.pdf`
}
