/**
 * §3 Historia ocupacional — tabla AcroForm (filas 1, 2, 3, Actual).
 */
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'
import { hoTableForUi, normalizeHoFila, type SodexoHoFila } from '@/lib/sodexo-ho-table'
import { SODEXO_HO_ACCIDENTES_TEXT, SODEXO_HO_PDF_ROWS } from '@/lib/sodexo-pdf-ho-rows'

function splitHoLines(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function formatTiempo(row: SodexoHoFila): string {
  const a = row.anios?.trim()
  const m = row.meses?.trim()
  if (a && m) return `${a} años ${m} meses`
  if (a) return `${a} años`
  if (m) return `${m} meses`
  return row.tiempo?.trim() ?? ''
}

function setNegadoSiCheck(form: PdfForm, noBox: string, siBox: string, value: 'NEGADO' | 'SI' | null | undefined) {
  if (value === 'NEGADO') sodexoSetCheck(form, noBox, true)
  else if (value === 'SI') sodexoSetCheck(form, siBox, true)
}

function fillHoPdfRow(form: PdfForm, pdfRowIndex: number, row: SodexoHoFila) {
  const pdf = SODEXO_HO_PDF_ROWS[pdfRowIndex]
  if (!pdf) return
  const empresa = row.empresa_area?.trim() || row.empresa?.trim()
  sodexoSetText(form, pdf.empresa, empresa)
  sodexoSetText(form, pdf.ocupacion, row.ocupacion)
  sodexoSetText(form, pdf.tiempo, formatTiempo(row))
  sodexoSetText(form, pdf.indemn_fecha, row.indemnizado_fecha)
  if (row.examen_ingreso) sodexoSetCheck(form, pdf.examen[0], true)
  if (row.examen_periodico) sodexoSetCheck(form, pdf.examen[1], true)
  if (row.examen_retiro) sodexoSetCheck(form, pdf.examen[2], true)
  if (row.examen_no) sodexoSetCheck(form, pdf.examen[3], true)
  setNegadoSiCheck(form, pdf.rt[0], pdf.rt[1], row.rt)
  setNegadoSiCheck(form, pdf.secuelas[0], pdf.secuelas[1], row.secuelas)
  setNegadoSiCheck(form, pdf.indemnizado[0], pdf.indemnizado[1], row.indemnizado)
}

export function fillSodexoHistoriaOcupacionalTabla(
  form: PdfForm,
  opts: {
    ext?: SodexoExtensionData | null
    empresaActual?: string | null
    areaActual?: string | null
    puestoActual?: string | null
    narrativa?: string | null
    riesgos?: string | null
  },
) {
  const ext = opts.ext
  const hoUi = hoTableForUi({
    historia_ocupacional_filas: ext?.historia_ocupacional_filas ?? null,
  } as SodexoExtensionData)

  const actualRow = normalizeHoFila(
    hoUi.actual.empresa_area?.trim() || hoUi.actual.ocupacion?.trim()
      ? hoUi.actual
      : {
          empresa_area: opts.empresaActual ?? '',
          empresa: opts.empresaActual ?? '',
          ocupacion: opts.puestoActual ?? '',
          anios: '',
          meses: '',
          tiempo: opts.areaActual ?? '',
          es_actual: true,
        },
  )
  const hist = hoUi.historico.map(normalizeHoFila)
  const pdfRows: SodexoHoFila[] = [
    hist[0] ?? normalizeHoFila({}),
    hist[1] ?? normalizeHoFila({}),
    hist[2] ?? normalizeHoFila({}),
    actualRow,
  ]

  const anyStructured = pdfRows.some(
    (r) => r.empresa_area?.trim() || r.empresa?.trim() || r.ocupacion?.trim(),
  )
  if (anyStructured) {
    for (let i = 0; i < 4; i++) {
      fillHoPdfRow(form, i, pdfRows[i])
    }
    if (ext?.historia_ocupacional_accidentes?.trim()) {
      sodexoSetText(form, SODEXO_HO_ACCIDENTES_TEXT, ext.historia_ocupacional_accidentes)
    }
    return
  }

  const lines = splitHoLines(opts.narrativa)
  if (opts.empresaActual || opts.puestoActual) {
    sodexoSetText(form, SODEXO_HO_PDF_ROWS[3].empresa, opts.empresaActual ?? '')
    sodexoSetText(form, SODEXO_HO_PDF_ROWS[3].ocupacion, opts.puestoActual ?? '')
    sodexoSetText(form, SODEXO_HO_PDF_ROWS[3].tiempo, opts.areaActual ?? '')
  }
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    sodexoSetText(form, SODEXO_HO_PDF_ROWS[i].empresa, lines[i])
  }
  if (opts.riesgos) {
    sodexoSetText(form, 'Texto30', opts.riesgos)
    sodexoSetText(form, 'Texto33', opts.riesgos)
  }
}
