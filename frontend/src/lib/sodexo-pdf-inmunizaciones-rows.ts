/**
 * §6 Inmunizaciones — filas AcroForm (fecha / IMSS / SSA / otros por vacuna).
 */
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'

type VacRow = {
  moduloKey: string
  siCheck: string
  fecha?: string
  imss?: string
  ssa?: string
  otros?: string
}

const BASIC_ROWS: VacRow[] = [
  {
    moduloKey: 'm1_vac_toxoide',
    siCheck: 'Check Box544',
    fecha: 'Texto578',
    imss: 'Texto579',
    ssa: 'Texto576',
    otros: 'Texto574',
  },
  {
    moduloKey: 'm1_vac_hepatitisb',
    siCheck: 'Check Box560',
    fecha: 'Texto575',
    imss: 'Texto573',
    ssa: 'Texto571',
    otros: 'Texto572',
  },
  {
    moduloKey: 'm1_vac_influenza',
    siCheck: 'Check Box559',
    fecha: 'Texto577',
  },
  {
    moduloKey: 'm1_vac_neumococo',
    siCheck: 'Check Box553',
  },
]

const COMPLEMENT_ROWS: VacRow[] = [
  { moduloKey: 'm1_vac_covid', siCheck: 'Check Box557' },
  { moduloKey: 'm1_vac_hepatitis_ab', siCheck: 'Check Box558' },
  { moduloKey: 'm1_vac_neumococo_comp', siCheck: 'Check Box553' },
]

function vacSi(raw: unknown): boolean {
  const u = String(raw ?? '').trim().toUpperCase()
  return u === 'SI' || (u.length > 0 && u !== 'NEGADO' && u !== 'NO APLICA')
}

function vacDetail(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'object' && raw !== null && 'detalle' in raw) {
    const d = (raw as { detalle?: Record<string, string> }).detalle
    return [d?.fecha, d?.observaciones, d?.desde_cuando].filter(Boolean).join(' ')
  }
  return String(raw).trim()
}

export function fillSodexoInmunizacionesRows(
  form: PdfForm,
  physicalOrModulo1: Record<string, unknown> | null | undefined,
) {
  const m1 = physicalOrModulo1 ?? {}
  for (const row of BASIC_ROWS) {
    const raw = m1[row.moduloKey]
    if (!vacSi(raw)) continue
    sodexoSetCheck(form, row.siCheck, true)
    const detail = vacDetail(raw)
    if (row.fecha) sodexoSetText(form, row.fecha, detail)
    if (row.imss && detail) sodexoSetText(form, row.imss, 'SI')
    if (row.ssa && detail) sodexoSetText(form, row.ssa, detail.slice(0, 24))
    if (row.otros && detail) sodexoSetText(form, row.otros, detail)
  }
  for (const row of COMPLEMENT_ROWS) {
    if (vacSi(m1[row.moduloKey])) sodexoSetCheck(form, row.siCheck, true)
  }
}
