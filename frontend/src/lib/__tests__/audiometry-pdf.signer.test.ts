/**
 * El PDF impreso lleva el nombre de la cuenta que lo genera y, si el
 * perfil tiene imagen de firma, esa imagen. Sin imagen no hay trazo.
 */
import { describe, it, expect } from 'vitest'
import { inflateSync } from 'node:zlib'
import { PNG } from 'pngjs'
import { PDFDocument, PDFName, PDFDict, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import {
  buildAudiometriaPdfData,
  generateAudiometriaValidatedPdf,
} from '@/lib/audiometry-pdf'

const CUENTA = 'Prueba Cuenta Audiometria'

function firmaDeCuenta(): { dataUrl: string; bytes: Buffer } {
  const png = new PNG({ width: 28, height: 12 })
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) << 2
      png.data[i] = x % 2 === 0 ? 18 : 210
      png.data[i + 1] = 40
      png.data[i + 2] = y % 2 === 0 ? 90 : 20
      png.data[i + 3] = 255
    }
  }
  const bytes = PNG.sync.write(png)
  return {
    bytes,
    dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
  }
}

function pdfPlainText(buffer: Buffer): string {
  const parts: string[] = [buffer.toString('latin1')]
  const latin = parts[0]
  let cursor = 0
  while (cursor < latin.length) {
    const start = latin.indexOf('stream', cursor)
    if (start < 0) break
    let dataStart = start + 'stream'.length
    if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) dataStart += 2
    else if (buffer[dataStart] === 0x0a) dataStart += 1
    const end = latin.indexOf('endstream', dataStart)
    if (end < 0) break
    const slice = buffer.subarray(dataStart, end)
    try {
      parts.push(inflateSync(slice).toString('latin1'))
    } catch {
      // El stream no está comprimido.
    }
    cursor = end + 'endstream'.length
  }
  return parts.join('\n')
}

function pdfVisibleText(buffer: Buffer): string {
  const raw = pdfPlainText(buffer)
  const chunks: string[] = []
  const re = /<([0-9A-Fa-f\s]+)>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw))) {
    const hex = match[1].replace(/\s+/g, '')
    if (hex.length < 2 || hex.length % 2 !== 0) continue
    chunks.push(Buffer.from(hex, 'hex').toString('latin1'))
  }
  return chunks.join('')
}

function embeddedImageCount(buffer: Buffer): number {
  const text = pdfPlainText(buffer)
  return (text.match(/\/Subtype\s*\/Image/g) ?? []).length
}

async function imageSamples(buffer: Buffer): Promise<Buffer[]> {
  const pdf = await PDFDocument.load(buffer)
  const samples: Buffer[] = []
  for (const page of pdf.getPages()) {
    const resources = page.node.Resources()
    const xObject = resources?.lookup(PDFName.of('XObject'), PDFDict)
    if (!(xObject instanceof PDFDict)) continue
    for (const [, ref] of xObject.entries()) {
      const stream = pdf.context.lookup(ref)
      if (!(stream instanceof PDFRawStream)) continue
      if (stream.dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Image')) continue
      samples.push(Buffer.from(decodePDFRawStream(stream).decode()))
    }
  }
  return samples
}

const estudio = {
  reviewId: 'signer-audio',
  doctorStatus: 'REVIEWED_ACCEPTED' as const,
  doctorDiagnosis: 'Umbrales dentro de lo esperado.',
  doctorNotes: null,
  doctorRecommendations: 'Nuevo estudio en un año.',
  reviewCreatedAt: new Date('2026-03-02T15:00:00.000Z'),
  prediagnosisData: {},
  extractionStructuredData: {
    estudio: { fecha_estudio: '02/03/2026' },
    oido_derecho: { va: { 500: 20, 1000: 20, 2000: 20, 3000: 20 } },
    oido_izquierdo: { va: { 500: 10, 1000: 10, 2000: 10, 3000: 10 } },
  },
  studyName: 'Audiometría',
  studyType: 'Audiometria',
  patient: {
    firstName: 'Ana',
    lastName: 'López',
    universalId: 'TRAB-100',
    companyName: 'Norte Industrial',
  },
  logoDataUrl: null,
  sourceCropDataUrl: null,
  sourceCropAspectRatio: null,
}

describe('PDF de audiometría — firmante de la cuenta', () => {
  it('imprime el nombre de la cuenta y embebe la firma de su perfil', async () => {
    const firma = firmaDeCuenta()
    const data = buildAudiometriaPdfData({
      ...estudio,
      medico: {
        fullName: CUENTA,
        professionalLicense: '5544332',
        signatureImageUrl: firma.dataUrl,
      },
    })
    expect(data.medico.fullName).toBe(CUENTA)
    expect(data.medico.signatureImageUrl).toBe(firma.dataUrl)

    const result = await generateAudiometriaValidatedPdf({
      reviewId: 'signer-audio',
      data,
    })
    const pdf = await PDFDocument.load(result.buffer)
    expect(pdf.getPageCount()).toBe(1)
    const text = pdfVisibleText(result.buffer)
    expect(text.toUpperCase()).toContain(CUENTA.toUpperCase())
    expect(text).toContain('5544332')
    expect(text).not.toContain('Marta Ruiz')
    expect(text).not.toContain('Erika')
    expect(text.toUpperCase()).toContain('REALIZ')
    const trazo = Buffer.from([18, 40, 90, 210, 40, 90])
    const samples = await imageSamples(result.buffer)
    expect(samples.some((sample) => sample.includes(trazo))).toBe(true)
  })

  it('sin firma del perfil conserva el nombre y no dibuja un trazo', async () => {
    const data = buildAudiometriaPdfData({
      ...estudio,
      reviewId: 'signer-audio-sin-firma',
      medico: {
        fullName: CUENTA,
        professionalLicense: '',
        signatureImageUrl: '',
      },
    })
    expect(data.medico.professionalLicense).toBe('—')
    expect(data.medico.signatureImageUrl).toBe('')

    const firma = firmaDeCuenta()
    const conFirma = await generateAudiometriaValidatedPdf({
      reviewId: 'signer-audio',
      data: buildAudiometriaPdfData({
        ...estudio,
        medico: {
          fullName: CUENTA,
          professionalLicense: '5544332',
          signatureImageUrl: firma.dataUrl,
        },
      }),
    })
    const result = await generateAudiometriaValidatedPdf({
      reviewId: 'signer-audio-sin-firma',
      data,
    })
    const text = pdfVisibleText(result.buffer)
    expect(text.toUpperCase()).toContain(CUENTA.toUpperCase())
    expect(text).toContain('Ced. Prof.')
    expect(text).not.toContain('5544332')
    expect(text).not.toContain('Marta Ruiz')
    expect(text).not.toContain('Erika')
    const trazo = Buffer.from([18, 40, 90, 210, 40, 90])
    const conMuestras = await imageSamples(conFirma.buffer)
    const sinMuestras = await imageSamples(result.buffer)
    expect(conMuestras.some((sample) => sample.includes(trazo))).toBe(true)
    expect(sinMuestras.some((sample) => sample.includes(trazo))).toBe(false)
    expect(embeddedImageCount(result.buffer)).toBeLessThan(embeddedImageCount(conFirma.buffer))
  })
})
