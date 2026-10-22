import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'
import { SODEXO_GINECO_TOXICO_EXTENSION_ROWS } from '@/lib/sodexo-gineco-extension-rows'
import { prefillGinecoSodexoFromModulo1 } from '@/lib/sodexo-gineco-prefill'
import { modulo1FromPhysicalExam } from '@/lib/clinical/modulo1-text'

const DISMENORREA_NO = 'Check Box416'
const DISMENORREA_SI = 'Check Box417'
const DISMENORREA_INCAP_NO = 'Check Box368'
const DISMENORREA_INCAP_SI = 'Check Box369'

function s(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function pick(
  extVal: string | null | undefined,
  m1Val: string | null | undefined,
): string {
  const e = s(extVal)
  if (e) return e
  return s(m1Val)
}

function resolveGinecoExt(
  ext: SodexoExtensionData['gineco_sodexo'],
  m1: Record<string, unknown>,
): NonNullable<SodexoExtensionData['gineco_sodexo']> {
  const base = prefillGinecoSodexoFromModulo1(m1)
  const g = ext ?? {}
  return {
    ...base,
    ...g,
    ciclos: pick(g.ciclos, base.ciclos),
    fum: pick(g.fum, base.fum),
    gesta: pick(g.gesta, base.gesta),
    parto: pick(g.parto, base.parto),
    cesarea: pick(g.cesarea, base.cesarea),
    aborto: pick(g.aborto, base.aborto),
    vivos: pick(g.vivos, base.vivos),
    fup: pick(g.fup, base.fup),
    metodo_planificacion: pick(g.metodo_planificacion, base.metodo_planificacion),
    ultima_citologia: pick(g.ultima_citologia, base.ultima_citologia),
  }
}

function dismenorreaFromExt(
  g: NonNullable<SodexoExtensionData['gineco_sodexo']>,
): 'NO' | 'SI' | 'INCAPACITANTE' | null {
  if (g.dismenorrea === 'NO' || g.dismenorrea === 'NEGADO') return 'NO'
  if (g.dismenorrea === 'INCAPACITANTE') return 'INCAPACITANTE'
  if (g.dismenorrea === 'SI') {
    return g.dismenorrea_incapacitante ? 'INCAPACITANTE' : 'SI'
  }
  return null
}

export function fillSodexoGinecoFromExtension(
  form: PdfForm,
  physicalOrModulo1: Record<string, unknown> | null | undefined,
  ginecoExt: SodexoExtensionData['gineco_sodexo'],
  patologicosGineco: unknown,
) {
  const m1 = physicalOrModulo1 ? modulo1FromPhysicalExam(physicalOrModulo1) : {}
  const g = resolveGinecoExt(ginecoExt, m1)

  sodexoSetText(form, 'Texto570', g.ciclos ?? '')
  const obstetric = [
    g.fum && `FUM ${g.fum}`,
    g.gesta && `G ${g.gesta}`,
    g.parto && `P ${g.parto}`,
    g.cesarea && `C ${g.cesarea}`,
    g.aborto && `A ${g.aborto}`,
    g.vivos && `Vivos ${g.vivos}`,
    g.fup && `FUP ${g.fup}`,
  ]
    .filter(Boolean)
    .join(' · ')
  if (obstetric) sodexoSetText(form, 'Texto912', obstetric)

  if (g.metodo_planificacion) sodexoSetText(form, 'Método de planificación', g.metodo_planificacion)
  const cito = g.ultima_citologia || 'NO REFIERE'
  sodexoSetText(form, 'Ultima Citología', cito)

  let dism = dismenorreaFromExt(g)
  if (!dism) {
    const p = parseGinecoPatologico(patologicosGineco)
    if (p.negado) dism = 'NO'
    else if (p.incapacitante) dism = 'INCAPACITANTE'
    else if (p.si) dism = 'SI'
  }
  if (dism === 'NO') sodexoSetCheck(form, DISMENORREA_NO, true)
  else if (dism === 'SI') sodexoSetCheck(form, DISMENORREA_SI, true)
  else if (dism === 'INCAPACITANTE') {
    sodexoSetCheck(form, DISMENORREA_SI, true)
    sodexoSetCheck(form, DISMENORREA_INCAP_SI, true)
  }

  const tox = g.toxicos_medicamentos ?? {}
  for (const row of SODEXO_GINECO_TOXICO_EXTENSION_ROWS) {
    const st = tox[row.id]
    if (st === 'NEGADO') sodexoSetCheck(form, row.no, true)
    else if (st === 'SI') sodexoSetCheck(form, row.si, true)
  }
}

function parseGinecoPatologico(raw: unknown): {
  negado: boolean
  si: boolean
  incapacitante: boolean
} {
  if (raw == null) return { negado: true, si: false, incapacitante: false }
  if (typeof raw === 'string') {
    const u = raw.toUpperCase()
    if (!u || u === 'NEGADO') return { negado: true, si: false, incapacitante: false }
    return { negado: false, si: true, incapacitante: u.includes('INCAPACIT') }
  }
  if (typeof raw === 'object' && raw !== null && 'estado' in raw) {
    const estado = String((raw as { estado?: string }).estado ?? '').toUpperCase()
    const det = (raw as { detalle?: Record<string, string> }).detalle
    const obs = s(det?.observaciones).toUpperCase()
    if (estado === 'NEGADO' || estado === 'NO APLICA') {
      return { negado: true, si: false, incapacitante: false }
    }
    return { negado: false, si: true, incapacitante: obs.includes('INCAPACIT') }
  }
  return { negado: true, si: false, incapacitante: false }
}
