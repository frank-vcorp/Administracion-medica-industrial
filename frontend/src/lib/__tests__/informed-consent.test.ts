import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  getInformedConsentPrivacyParagraphs,
  INFORMED_CONSENT_BODY_INTRO,
  INFORMED_CONSENT_FORMAT_CODE,
  INFORMED_CONSENT_LEGAL_NOTE,
  INFORMED_CONSENT_MANIFESTATION_INTRO,
  INFORMED_CONSENT_MANIFESTATION_ITEMS,
  INFORMED_CONSENT_MANIFESTATION_TITLE,
  INFORMED_CONSENT_PRIVACY_FOOTER,
  INFORMED_CONSENT_PRIVACY_TITLE,
  INFORMED_CONSENT_SECTIONS,
  INFORMED_CONSENT_SUBTITLE,
  INFORMED_CONSENT_TITLE,
  SME_ARCO_EMAIL,
  SME_ARCO_PHONE,
} from '@/lib/informed-consent-content'
import { buildInformedConsentPdf } from '@/lib/informed-consent-pdf'

const EXPECTED_ROMANS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
] as const

const MINIMAL_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('informed-consent SME inline & PDF', () => {
  it('incluye exactamente las 19 secciones I a XIX en orden romano', () => {
    expect(INFORMED_CONSENT_SECTIONS.map((s) => s.roman)).toEqual([...EXPECTED_ROMANS])
  })

  it('no contiene referencias heredadas a Sodexo, Realso ni al contacto ARCO anterior', () => {
    const allChunks: string[] = [
      INFORMED_CONSENT_TITLE,
      INFORMED_CONSENT_SUBTITLE,
      INFORMED_CONSENT_BODY_INTRO,
      INFORMED_CONSENT_PRIVACY_TITLE,
      INFORMED_CONSENT_PRIVACY_FOOTER,
      INFORMED_CONSENT_FORMAT_CODE,
      ...getInformedConsentPrivacyParagraphs(),
      ...INFORMED_CONSENT_SECTIONS.flatMap((s) => [
        s.roman,
        s.title,
        ...s.paragraphs,
        ...(s.bullets ?? []),
        ...(s.numberedItems ?? []),
        ...(s.closingParagraph ? [s.closingParagraph] : []),
      ]),
      INFORMED_CONSENT_MANIFESTATION_TITLE,
      INFORMED_CONSENT_MANIFESTATION_INTRO,
      ...INFORMED_CONSENT_MANIFESTATION_ITEMS,
      INFORMED_CONSENT_LEGAL_NOTE,
    ]
    const fullText = allChunks.join('\n').toLowerCase()

    expect(fullText).not.toContain('sodexo')
    expect(fullText).not.toContain('realso')
    expect(fullText).not.toContain('calidad@medicaindustrial.com')
    expect(fullText).not.toContain('480 05 48')
  })

  it('sección I identifica a Soluciones Médico Empresariales y domicilio en Querétaro', () => {
    const sec1 = INFORMED_CONSENT_SECTIONS[0]
    expect(sec1.roman).toBe('I')
    const sec1Text = sec1.paragraphs.join(' ')
    expect(sec1Text).toContain('Soluciones Médico Empresariales, S. de R.L. de C.V.')
    expect(sec1Text).toContain('Circuito del Mesón #135')
  })

  it('sección XII y pie de aviso usan los datos ARCO oficiales de SME', () => {
    const sec12 = INFORMED_CONSENT_SECTIONS.find((s) => s.roman === 'XII')
    expect(sec12).toBeDefined()
    const sec12Text = sec12!.paragraphs.join(' ')

    expect(SME_ARCO_EMAIL).toBe('informes@medicaindustrial.com')
    expect(SME_ARCO_PHONE).toBe('(442) 480 29 03')
    expect(sec12Text).toContain('informes@medicaindustrial.com')
    expect(sec12Text).toContain('(442) 480 29 03')
    expect(INFORMED_CONSENT_PRIVACY_FOOTER).toContain('informes@medicaindustrial.com')
    expect(INFORMED_CONSENT_PRIVACY_FOOTER).toContain('(442) 480 29 03')
  })

  it('incluye las 5 manifestaciones expresas de la persona titular', () => {
    expect(INFORMED_CONSENT_MANIFESTATION_ITEMS).toHaveLength(5)
    for (const item of INFORMED_CONSENT_MANIFESTATION_ITEMS) {
      expect(item.trim().length).toBeGreaterThan(20)
    }
  })

  it('genera un PDF multipágina válido con pdf-lib, metadatos, acentos y firma PNG', async () => {
    const buffer = await buildInformedConsentPdf({
      patientFullName: 'José María Núñez Peña',
      signedAt: new Date('2026-11-25T16:30:00Z'),
      signatureDataUrl: MINIMAL_PNG_DATA_URL,
      companyName: 'Systron Industrial S.A. de C.V.',
      workerUniversalId: 'WRK-2026-0042',
      jobPosition: 'Operador de Producción ✓',
      expedientId: 'EXP-2026045',
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')

    const parsed = await PDFDocument.load(buffer)
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(2)
  })
})
