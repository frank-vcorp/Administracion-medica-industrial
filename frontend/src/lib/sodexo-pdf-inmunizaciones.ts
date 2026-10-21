/**
 * §6 Inmunizaciones — proyección PDF (extensión Sodexo + respaldo Módulo 1).
 */
import type { PDFDocument } from 'pdf-lib'
import { modulo1FromPhysicalExam } from '@/lib/clinical/modulo1-text'
import type { SodexoInmunizacionesSodexo } from '@/lib/sodexo-inmunizaciones-catalog'
import { fillSodexoInmunizacionesFromExtension } from '@/lib/sodexo-pdf-inmunizaciones-fill'

type PdfForm = ReturnType<PDFDocument['getForm']>

export function fillSodexoInmunizaciones(
  form: PdfForm,
  physicalOrModulo1: Record<string, unknown> | null | undefined,
  inmunizacionesTexto: string | null | undefined,
  inmunizacionesSodexo?: SodexoInmunizacionesSodexo | null,
) {
  const m1 = physicalOrModulo1 ? modulo1FromPhysicalExam(physicalOrModulo1) : {}
  fillSodexoInmunizacionesFromExtension(form, inmunizacionesSodexo, m1, inmunizacionesTexto)
}
