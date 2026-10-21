import { SODEXO_EXAMEN_FISICO_CATALOG } from '@/lib/sodexo-examen-fisico-catalog'
import type { SodexoEfRowValue } from '@/lib/sodexo-examen-fisico-types'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'

const PIEL_KEYS = ['98_cicatrices', '98_tatuajes', '98_nevus', '98_unas', '98_dermatosis'] as const

function applyRow(form: PdfForm, entry: (typeof SODEXO_EXAMEN_FISICO_CATALOG)[number], row: SodexoEfRowValue) {
  if (entry.kind === 'normal_anormal' && entry.pdf) {
    if (row.resultado === 'NORMAL') sodexoSetCheck(form, entry.pdf.normal, true)
    if (row.resultado === 'ANORMAL') sodexoSetCheck(form, entry.pdf.abnormal, true)
    if (entry.pdf.desc && row.desc?.trim()) sodexoSetText(form, entry.pdf.desc, row.desc)
    return
  }
  if (entry.kind === 'signo' && entry.signo) {
    if (row.resultado === 'NEG') sodexoSetCheck(form, entry.signo.neg, true)
    if (row.resultado === 'POS') sodexoSetCheck(form, entry.signo.pos, true)
    return
  }
  if (entry.kind === 'texto' && entry.textField && row.desc?.trim()) {
    sodexoSetText(form, entry.textField, row.desc)
  }
}

export function fillSodexoExamenFisicoFromExtension(
  form: PdfForm,
  map: Record<string, SodexoEfRowValue> | null | undefined,
) {
  if (!map) return

  const pielParts: string[] = []
  for (const entry of SODEXO_EXAMEN_FISICO_CATALOG) {
    const row = map[entry.key]
    if (!row) continue
    if (PIEL_KEYS.includes(entry.key as (typeof PIEL_KEYS)[number])) {
      const line = row.desc?.trim()
      if (line) pielParts.push(`${entry.label}: ${line}`)
      continue
    }
    applyRow(form, entry, row)
  }
  if (pielParts.length) {
    sodexoSetText(form, 'Texto882', pielParts.join(' · '))
  }
}
