/**
 * §6 Inmunizaciones — proyección PDF desde Módulo 1 (snapshot existente).
 */
import type { PDFDocument } from 'pdf-lib'
import { modulo1FromPhysicalExam } from '@/lib/clinical/modulo1-text'
import { fillSodexoInmunizacionesRows } from '@/lib/sodexo-pdf-inmunizaciones-rows'

type PdfForm = ReturnType<PDFDocument['getForm']>

function vacSi(raw: unknown): boolean {
  const u = String(raw ?? '').trim().toUpperCase()
  return u === 'SI' || (u.length > 0 && u !== 'NEGADO' && u !== 'NO APLICA')
}

function setCheck(form: PdfForm, name: string, on: boolean) {
  if (!on) return
  try {
    form.getCheckBox(name).check()
  } catch {
    // ignore
  }
}

function setText(form: PdfForm, name: string, value: string) {
  if (!value.trim()) return
  try {
    form.getTextField(name).setText(value)
  } catch {
    // ignore
  }
}

/** Básica: Niega / Sí + filas tetanos, hepatitis, influenza (texto auxiliar). */
export function fillSodexoInmunizaciones(
  form: PdfForm,
  physicalOrModulo1: Record<string, unknown> | null | undefined,
  inmunizacionesTexto: string | null | undefined,
) {
  const m1 = physicalOrModulo1
    ? modulo1FromPhysicalExam(physicalOrModulo1)
    : {}

  const keys = [
    'm1_vac_toxoide',
    'm1_vac_hepatitisb',
    'm1_vac_influenza',
    'm1_vac_neumococo',
    'm1_vac_rubeola',
    'm1_vac_sarampion',
    'm1_vac_otras',
  ] as const
  const anySi = keys.some((k) => vacSi(m1[k]))
  setCheck(form, 'Check Box542', !anySi)
  setCheck(form, 'Check Box543', anySi)

  if (vacSi(m1.m1_vac_toxoide)) setCheck(form, 'Check Box544', true)
  if (vacSi(m1.m1_vac_hepatitisb)) setCheck(form, 'Check Box560', true)
  if (vacSi(m1.m1_vac_influenza)) setCheck(form, 'Check Box559', true)
  if (vacSi(m1.m1_vac_neumococo)) setCheck(form, 'Check Box553', true)
  if (vacSi(m1.m1_vac_rubeola)) setCheck(form, 'Check Box554', true)
  if (vacSi(m1.m1_vac_sarampion)) setCheck(form, 'Check Box555', true)
  if (vacSi(m1.m1_vac_otras)) setCheck(form, 'Check Box556', true)

  setCheck(form, 'Check Box557', !anySi)
  setCheck(form, 'Check Box558', anySi)

  fillSodexoInmunizacionesRows(form, m1)

  setText(form, 'Texto541', inmunizacionesTexto ?? '')
  for (const [i, k] of keys.entries()) {
    if (!vacSi(m1[k])) continue
    const field = `Texto57${2 + (i % 8)}`
    setText(form, field, String(m1[k]))
  }
}
