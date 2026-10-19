/**
 * §9 encabezado — estado general / mental / lateralidad.
 */
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck } from '@/lib/sodexo-pdf-acroform'

export function fillSodexoExamenEncabezado(form: PdfForm) {
  sodexoSetCheck(form, 'Check Box679', true)
  sodexoSetCheck(form, 'Check Box685', true)
  sodexoSetCheck(form, 'Check Box687', true)
  sodexoSetCheck(form, 'Check Box26', true)
}
