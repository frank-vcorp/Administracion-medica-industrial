/**
 * §9 Examen físico — casillas Normal / Anormal (página 3).
 */
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoDefaultNormalPair, type SodexoNormalPair } from '@/lib/sodexo-pdf-acroform'

export const SODEXO_EXAMEN_FISICO_NORMAL_PAIRS: SodexoNormalPair[] = [
  { normal: 'Check Box676', abnormal: 'Check Box677' },
  { normal: 'Check Box674', abnormal: 'Check Box675' },
  { normal: 'Check Box672', abnormal: 'Check Box673' },
  { normal: 'Check Box670', abnormal: 'Check Box671' },
  { normal: 'Check Box668', abnormal: 'Check Box669' },
  { normal: 'Check Box666', abnormal: 'Check Box667' },
  { normal: 'Check Box664', abnormal: 'Check Box665' },
  { normal: 'Check Box662', abnormal: 'Check Box663' },
  { normal: 'Check Box660', abnormal: 'Check Box661' },
  { normal: 'Check Box658', abnormal: 'Check Box659' },
]

function looksAbnormal(text: string | null | undefined): boolean {
  const u = (text ?? '').trim().toUpperCase()
  if (!u) return false
  if (u.includes('NORMAL') && !u.includes('ANORMAL')) return false
  return (
    u.includes('ANORMAL') ||
    u.includes('ALTER') ||
    u.includes('PATOL') ||
    u.includes('DOLOR') ||
    u.includes('MASA') ||
    u.includes('DEFORM')
  )
}

/** Tras volcar texto de exploración, marca Normal en filas sin hallazgo anormal explícito. */
export function fillSodexoExamenFisicoNormals(
  form: PdfForm,
  exploracion: Record<string, string | null | undefined>,
) {
  const anyAbnormal = Object.values(exploracion).some((v) => looksAbnormal(v))
  if (!anyAbnormal && Object.values(exploracion).some((v) => (v ?? '').trim())) {
    for (const pair of SODEXO_EXAMEN_FISICO_NORMAL_PAIRS) {
      sodexoDefaultNormalPair(form, pair)
    }
  }
}
