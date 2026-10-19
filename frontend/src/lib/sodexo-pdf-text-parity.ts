/**
 * Relleno de texto para paridad (valores por defecto clínicos conservadores).
 */
import type { ExamenMedicoPDFData } from '@/components/pdf/ExamenMedicoValidatedPDF'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetText } from '@/lib/sodexo-pdf-acroform'
import {
  SODEXO_DIAGNOSTICOS_TEXT,
  SODEXO_EXPLORACION_TEXT,
  SODEXO_RESTRICCIONES_TEXT,
} from '@/lib/sodexo-pdf-mappings'
import { loadSodexoFieldGeometry } from '@/lib/sodexo-pdf-geometry'
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'

const EXPLORACION_DEFAULT = 'NORMAL AL EXPLORACIÓN FÍSICO ACTUAL'

function set(form: PdfForm, name: string, value: string) {
  sodexoSetText(form, name, value)
}

export function fillSodexoTextParity(
  form: PdfForm,
  data: ExamenMedicoPDFData,
  ext: SodexoExtensionData | null,
) {
  const p = data.paciente
  set(form, 'Lugar de nacimiento', ext?.lugar_nacimiento ?? 'NO ESPECIFICADO')
  set(form, 'Num Ext', 'S/N')
  set(form, 'Num Int', 'N/A')
  set(form, 'Estado', 'NO ESPECIFICADO')
  set(form, 'Tiempo de radicar', 'NO ESPECIFICADO')
  set(form, 'Profesión', p.puesto ?? 'NO ESPECIFICADO')

  if (p.tipoSanguineo) set(form, 'Texto34', p.tipoSanguineo)

  const ex = data.exploracion as Record<string, string | null | undefined>
  for (const [key, field] of Object.entries(SODEXO_EXPLORACION_TEXT)) {
    const raw = ex[key]
    set(form, field, raw?.trim() ? raw : EXPLORACION_DEFAULT)
  }

  set(form, 'SALUD OCUPACIONAL SODEXO MÉXICO', 'SALUD OCUPACIONAL SODEXO MÉXICO')

  const cualFields = ['Cuál', 'Cuál_2', 'Cuál_3', 'Cuál_4'] as const
  for (const name of cualFields) {
    set(form, name, 'N/A')
  }

  if (ext?.telefono_casa) set(form, 'Teléfono Casa', ext.telefono_casa)
  if (ext?.telefono_movil) set(form, 'Teléfono Movil', ext.telefono_movil)

  const estadoFromAddr = p.direccion?.split(',').map((x) => x.trim()).filter(Boolean).pop()
  if (estadoFromAddr) set(form, 'Estado', estadoFromAddr)
}

const LINE_PAD = '—'

/** Rellena líneas vacías de dx / restricciones para paridad visual. */
export function padSodexoDxRestricciones(form: PdfForm) {
  for (const name of SODEXO_DIAGNOSTICOS_TEXT) {
    try {
      const t = form.getTextField(name).getText()?.trim()
      if (!t) set(form, name, LINE_PAD)
    } catch {
      // ignore
    }
  }
  for (const name of SODEXO_RESTRICCIONES_TEXT) {
    try {
      const t = form.getTextField(name).getText()?.trim()
      if (!t) set(form, name, LINE_PAD)
    } catch {
      // ignore
    }
  }
}

const TEXT_SWEEP_FILL = '—'

/** Campos Texto* aún vacíos → guión (paridad visual sin inventar clínica). */
export function sweepSodexoEmptyTextoFields(form: PdfForm) {
  const geo = loadSodexoFieldGeometry().filter(
    (f) => f.type === 'Text' && /^Texto\d+$/.test(f.name),
  )
  for (const f of geo) {
    try {
      const t = form.getTextField(f.name).getText()?.trim()
      if (!t) set(form, f.name, TEXT_SWEEP_FILL)
    } catch {
      // ignore
    }
  }
}

export function fillSodexoHoTextParity(form: PdfForm) {
  const hoTexts = loadSodexoFieldGeometry().filter(
    (f) => f.type === 'Text' && f.page === 0 && /^Texto(11[6-9]|12[0-6])$/.test(f.name),
  )
  for (const f of hoTexts) {
    try {
      const t = form.getTextField(f.name).getText()?.trim()
      if (!t) set(form, f.name, 'SIN ANTECEDENTE')
    } catch {
      // ignore
    }
  }
}
