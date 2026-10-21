import type { PDFDocument } from 'pdf-lib'
import {
  SODEXO_INMUNIZACIONES_CATALOG,
  type SodexoInmunizacionFila,
  type SodexoInmunizacionesSodexo,
} from '@/lib/sodexo-inmunizaciones-catalog'
import { prefillInmunizacionesSodexoFromModulo1 } from '@/lib/sodexo-inmunizaciones-prefill'

type PdfForm = ReturnType<PDFDocument['getForm']>

function setCheck(form: PdfForm, name: string | undefined, on: boolean) {
  if (!on || !name) return
  try {
    form.getCheckBox(name).check()
  } catch {
    // ignore
  }
}

function setText(form: PdfForm, name: string | undefined, value: string | null | undefined) {
  if (!name) return
  const text = (value ?? '').trim()
  if (!text) return
  try {
    form.getTextField(name).setText(text)
  } catch {
    // ignore
  }
}

function resolveFila(
  key: SodexoInmunizacionFila | undefined,
  amiRaw: unknown,
): SodexoInmunizacionFila | null {
  if (key?.estado === 'NEGADO' || key?.estado === 'SI') return key
  const u = String(amiRaw ?? '').trim().toUpperCase()
  if (!u || u === 'NEGADO' || u === 'NO APLICA') {
    return u ? { estado: 'NEGADO' } : null
  }
  return { estado: 'SI', fecha: typeof amiRaw === 'string' ? amiRaw : '' }
}

export function fillSodexoInmunizacionesFromExtension(
  form: PdfForm,
  ext: SodexoInmunizacionesSodexo | null | undefined,
  modulo1: Record<string, unknown> | null | undefined,
  observacionesFallback?: string | null,
) {
  const fromAmi = prefillInmunizacionesSodexoFromModulo1(modulo1)
  const filas = { ...fromAmi.filas, ...(ext?.filas ?? {}) }

  for (const row of SODEXO_INMUNIZACIONES_CATALOG) {
    const amiRaw = row.amiKey ? modulo1?.[row.amiKey] : undefined
    const fila = resolveFila(filas[row.key], amiRaw)
    if (!fila) continue
    if (fila.estado === 'NEGADO') {
      setCheck(form, row.pdf.checkNo, true)
      continue
    }
    if (fila.estado === 'SI') {
      setCheck(form, row.pdf.checkSi, true)
      setText(form, row.pdf.fecha, fila.fecha)
      setText(form, row.pdf.imss, fila.imss)
      setText(form, row.pdf.ssa, fila.ssa)
      setText(form, row.pdf.otros, fila.otros)
      if (row.marca) setText(form, row.pdf.marca, fila.marca)
    }
  }

  const obs = (ext?.observaciones ?? '').trim() || (observacionesFallback ?? '').trim()
  setText(form, 'Texto541', obs)
}
