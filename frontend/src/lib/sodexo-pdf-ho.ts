/**
 * §3 Historia ocupacional — tabla 4 filas (texto en rejilla AcroForm).
 */
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetText } from '@/lib/sodexo-pdf-acroform'

/** Campos por fila (empresa/área, ocupación, tiempos auxiliares en plantilla). */
const HO_ROW_FIELDS = [
  { empresa: 'Texto75', ocupacion: 'Texto119', tiempo: 'Texto123' },
  { empresa: 'Texto126', ocupacion: 'Texto118', tiempo: 'Texto122' },
  { empresa: 'Texto117', ocupacion: 'Texto125', tiempo: 'Texto121' },
  { empresa: 'Texto29', ocupacion: 'Texto32', tiempo: 'Texto31' },
] as const

function splitHoLines(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
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
  const filas = opts.ext?.historia_ocupacional_filas?.filter(
    (f) => f.empresa?.trim() || f.ocupacion?.trim() || f.tiempo?.trim() || f.agentes_riesgo?.trim(),
  )
  if (filas?.length) {
    for (let i = 0; i < Math.min(4, filas.length); i++) {
      const row = filas[i]
      const fields = HO_ROW_FIELDS[i]
      sodexoSetText(form, fields.empresa, row.empresa ?? '')
      sodexoSetText(form, fields.ocupacion, row.ocupacion ?? '')
      sodexoSetText(form, fields.tiempo, row.tiempo ?? '')
      if (row.agentes_riesgo?.trim()) {
        sodexoSetText(form, i === 3 ? 'Texto30' : 'Texto33', row.agentes_riesgo)
      }
    }
    return
  }

  const lines = splitHoLines(opts.narrativa)
  if (opts.empresaActual || opts.puestoActual) {
    sodexoSetText(form, HO_ROW_FIELDS[3].empresa, opts.empresaActual ?? '')
    sodexoSetText(form, HO_ROW_FIELDS[3].ocupacion, opts.puestoActual ?? '')
    sodexoSetText(form, HO_ROW_FIELDS[3].tiempo, opts.areaActual ?? '')
  }
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    sodexoSetText(form, HO_ROW_FIELDS[i].empresa, lines[i])
  }
  if (opts.riesgos) {
    sodexoSetText(form, 'Texto30', opts.riesgos)
    sodexoSetText(form, 'Texto33', opts.riesgos)
  }
}
