/**
 * §7 Historia gineco-obstétrica — casillas y campos desde Módulo 1 (snapshot).
 */
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'
import { modulo1FromPhysicalExam } from '@/lib/clinical/modulo1-text'

function s(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

const DISMENORREA_PAIR = { no: 'Check Box416', si: 'Check Box417' }
const DISMENORREA_INCAP_PAIR = { no: 'Check Box368', si: 'Check Box369' }

export function fillSodexoGineco(
  form: PdfForm,
  physicalOrModulo1: Record<string, unknown> | null | undefined,
  sexo: string | null | undefined,
  patologicosGineco: unknown,
) {
  const isFemale = /^(F|FEMENINO|Mujer)/i.test(s(sexo))
  if (!isFemale) return

  const m1 = physicalOrModulo1 ? modulo1FromPhysicalExam(physicalOrModulo1) : {}

  setText(form, 'Texto570', [s(m1.m1_gine_ritmo), s(m1.m1_gine_menarca) ? `Menarca ${m1.m1_gine_menarca}` : '']
    .filter(Boolean)
    .join(' · '))

  const obstetric = [
    s(m1.m1_gine_fum) && `FUM ${m1.m1_gine_fum}`,
    s(m1.m1_gine_gesta) && `G ${m1.m1_gine_gesta}`,
    s(m1.m1_gine_parto) && `P ${m1.m1_gine_parto}`,
    s(m1.m1_gine_cesarea) && `C ${m1.m1_gine_cesarea}`,
    s(m1.m1_gine_aborto) && `A ${m1.m1_gine_aborto}`,
    s(m1.m1_gine_fup_uc) && `FUP ${m1.m1_gine_fup_uc}`,
    s(m1.m1_gine_doc) && `Vivos/DOC ${m1.m1_gine_doc}`,
  ]
    .filter(Boolean)
    .join(' · ')
  if (obstetric) setText(form, 'Texto912', obstetric)

  const mpf = s(m1.m1_gine_mpf)
  if (mpf) setText(form, 'Método de planificación', mpf)

  const cito = s(m1.m1_gine_fup_uc) || s(m1.m1_gine_exp_mamaria)
  setText(form, 'Ultima Citología', cito || 'NO REFIERE')

  const ginePato = parseGinecoPatologico(patologicosGineco)
  if (ginePato.negado) sodexoSetCheck(form, DISMENORREA_PAIR.no, true)
  else if (ginePato.si) {
    sodexoSetCheck(form, DISMENORREA_PAIR.si, true)
    if (ginePato.incapacitante) sodexoSetCheck(form, DISMENORREA_INCAP_PAIR.si, true)
  }
}

function setText(form: PdfForm, name: string, value: string) {
  sodexoSetText(form, name, value)
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
    return {
      negado: false,
      si: true,
      incapacitante: u.includes('INCAPACIT'),
    }
  }
  if (typeof raw === 'object' && raw !== null && 'estado' in raw) {
    const estado = String((raw as { estado?: string }).estado ?? '').toUpperCase()
    const det = (raw as { detalle?: Record<string, string> }).detalle
    const obs = s(det?.observaciones).toUpperCase()
    if (estado === 'NEGADO' || estado === 'NO APLICA') {
      return { negado: true, si: false, incapacitante: false }
    }
    return {
      negado: false,
      si: true,
      incapacitante: obs.includes('INCAPACIT'),
    }
  }
  return { negado: true, si: false, incapacitante: false }
}
