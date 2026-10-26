/**
 * Utilidades AcroForm compartidas para REG-SO-01.
 */
import { TextAlignment, type PDFDocument } from 'pdf-lib'

export type PdfForm = ReturnType<PDFDocument['getForm']>

const SODEXO_TEXT_FONT_SIZE = 7

/** Campos cortos del impreso — centrado para alinear con la celda. */
const CENTER_ALIGNED_TEXT_FIELDS = new Set([
  'Edad',
  'Num Ext',
  'Num Int',
  'Texto72',
  'Texto73',
  'Texto74',
  'Antigüedad',
  'Peso',
  'Estatura',
  'IMC',
  'Pulso',
  'FR',
  'Texto48',
])

export function sodexoSetText(form: PdfForm, fieldName: string, value: string | null | undefined) {
  const text = (value ?? '').trim()
  if (!text) return
  try {
    const field = form.getTextField(fieldName)
    field.setText(text)
    try {
      field.setFontSize(SODEXO_TEXT_FONT_SIZE)
      if (CENTER_ALIGNED_TEXT_FIELDS.has(fieldName)) {
        field.setAlignment(TextAlignment.Center)
      }
    } catch {
      // plantilla con fuente embebida
    }
  } catch {
    // ignore
  }
}

export function sodexoSetCheck(form: PdfForm, fieldName: string, checked: boolean) {
  if (!checked) return
  try {
    form.getCheckBox(fieldName).check()
  } catch {
    // ignore
  }
}

export function sodexoIsChecked(form: PdfForm, fieldName: string): boolean {
  try {
    return form.getCheckBox(fieldName).isChecked()
  } catch {
    return false
  }
}

export type SodexoNoSiPair = { no: string; si: string }

/** Marca «Niega» si ninguna casilla del par está marcada. */
export function sodexoDefaultNiegaPair(form: PdfForm, pair: SodexoNoSiPair) {
  if (sodexoIsChecked(form, pair.no) || sodexoIsChecked(form, pair.si)) return
  sodexoSetCheck(form, pair.no, true)
}

export type SodexoNormalPair = { normal: string; abnormal: string }

/** Marca «Normal» (izquierda) si el par está vacío. */
export function sodexoDefaultNormalPair(form: PdfForm, pair: SodexoNormalPair) {
  if (sodexoIsChecked(form, pair.normal) || sodexoIsChecked(form, pair.abnormal)) return
  sodexoSetCheck(form, pair.normal, true)
}
