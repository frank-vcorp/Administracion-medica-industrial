/**
 * Sección 5 — Personal patológico (REG-SO-01).
 *
 * Capa **solo PDF**: lee el snapshot ya capturado en la papeleta AMI (`patologicos`
 * en `antecedentes_captured` / historia clínica) y marca casillas del AcroForm.
 * No modifica formularios ni casillas de captura en UI.
 */
import type { PDFDocument } from 'pdf-lib'
import { sodexoDefaultNiegaPair } from '@/lib/sodexo-pdf-acroform'
import { SODEXO_PATOLOGICOS_ALL_PAIRS } from '@/lib/sodexo-pdf-patologicos-pairs'

type PdfForm = ReturnType<PDFDocument['getForm']>

export type SodexoPatologiaRow = {
  descField: string
  checkNo: string
  checkSi: string
  /** Clave en `patologicos` (PatologicosSchema). */
  amiKey: string
}

/** Filas izquierda / derecha calibradas por posición AcroForm (página 2 del PDF). */
export const SODEXO_PATOLOGICOS_LEFT: SodexoPatologiaRow[] = [
  { descField: 'Texto524', checkNo: 'Check Box434', checkSi: 'Check Box435', amiKey: 'fracturas' },
  { descField: 'Texto525', checkNo: 'Check Box436', checkSi: 'Check Box440', amiKey: 'hernias' },
  { descField: 'Texto526', checkNo: 'Check Box437', checkSi: 'Check Box441', amiKey: 'pat_c_vertebral' },
  { descField: 'Texto527', checkNo: 'Check Box438', checkSi: 'Check Box442', amiKey: 'traumatismos_craneales' },
  { descField: 'Texto528', checkNo: 'Check Box439', checkSi: 'Check Box443', amiKey: 'parotiditis' },
  { descField: 'Texto479', checkNo: 'Check Box446', checkSi: 'Check Box447', amiKey: 'epilepsia' },
  { descField: 'Texto480', checkNo: 'Check Box452', checkSi: 'Check Box455', amiKey: 'migrana' },
  { descField: 'Texto481', checkNo: 'Check Box453', checkSi: 'Check Box454', amiKey: 'psiquiatricas' },
  { descField: 'Texto522', checkNo: 'Check Box430', checkSi: 'Check Box431', amiKey: 'cirugias' },
  { descField: 'Texto523', checkNo: 'Check Box432', checkSi: 'Check Box433', amiKey: 'transfusiones' },
]

export const SODEXO_PATOLOGICOS_RIGHT: SodexoPatologiaRow[] = [
  { descField: 'Texto489', checkNo: 'Check Box386', checkSi: 'Check Box387', amiKey: 'asma' },
  { descField: 'Texto488', checkNo: 'Check Box390', checkSi: 'Check Box391', amiKey: 'alergias' },
  { descField: 'Texto487', checkNo: 'Check Box392', checkSi: 'Check Box393', amiKey: 'dermatitis' },
  { descField: 'Texto485', checkNo: 'Check Box395', checkSi: 'Check Box398', amiKey: 'diabetes' },
  { descField: 'Texto486', checkNo: 'Check Box396', checkSi: 'Check Box399', amiKey: 'endocrinopatias' },
  { descField: 'Texto473', checkNo: 'Check Box460', checkSi: 'Check Box461', amiKey: 'has' },
  { descField: 'Texto474', checkNo: 'Check Box462', checkSi: 'Check Box463', amiKey: 'cardiopatias' },
  { descField: 'Texto475', checkNo: 'Check Box464', checkSi: 'Check Box465', amiKey: 'bronquitis' },
  { descField: 'Texto491', checkNo: 'Check Box382', checkSi: 'Check Box383', amiKey: 'gastritis' },
  { descField: 'Texto490', checkNo: 'Check Box384', checkSi: 'Check Box385', amiKey: 'colitis' },
  { descField: 'Texto494', checkNo: 'Check Box378', checkSi: 'Check Box379', amiKey: 'tuberculosis' },
  { descField: 'Texto495', checkNo: 'Check Box376', checkSi: 'Check Box377', amiKey: 'hepatitis' },
  { descField: 'Texto496', checkNo: 'Check Box372', checkSi: 'Check Box375', amiKey: 'enf_trans_sexual' },
  { descField: 'Texto497', checkNo: 'Check Box370', checkSi: 'Check Box373', amiKey: 'neumonias' },
  { descField: 'Texto498', checkNo: 'Check Box368', checkSi: 'Check Box369', amiKey: 'renales' },
  { descField: 'Texto493', checkNo: 'Check Box380', checkSi: 'Check Box381', amiKey: 'varices' },
]

/** Enfermedades sin fila dedicada: se listan en aclaración si están en SI. */
export const SODEXO_PATOLOGICOS_EXTRA_KEYS = [
  'tifoidea',
  'exantematicas',
  'cancer',
  'hemorroides',
  'desmayos',
  'vertigo',
  'ginecologicos',
  'otras',
] as const

export type PatologiaParsed = {
  negado: boolean
  si: boolean
  descripcion: string
}

export function parsePatologiaEntry(raw: unknown): PatologiaParsed {
  if (raw == null) return { negado: true, si: false, descripcion: '' }
  if (typeof raw === 'string') {
    const u = raw.trim().toUpperCase()
    if (!u || u === 'NEGADO' || u === 'NO APLICA') {
      return { negado: true, si: false, descripcion: '' }
    }
    return { negado: false, si: true, descripcion: raw.trim() }
  }
  if (typeof raw === 'object' && raw !== null && 'estado' in raw) {
    const estado = String((raw as { estado?: string }).estado ?? 'NEGADO').toUpperCase()
    const det = (raw as { detalle?: Record<string, string> }).detalle
    const descripcion = [det?.desde_cuando, det?.tratamiento, det?.observaciones]
      .map((x) => (x ?? '').trim())
      .filter(Boolean)
      .join('; ')
    if (estado === 'SI') return { negado: false, si: true, descripcion }
    if (estado === 'NEGADO' || estado === 'NO APLICA') {
      return { negado: true, si: false, descripcion: '' }
    }
    return { negado: false, si: true, descripcion: estado }
  }
  return { negado: true, si: false, descripcion: '' }
}

function setText(form: PdfForm, fieldName: string, value: string) {
  if (!value.trim()) return
  try {
    form.getTextField(fieldName).setText(value)
  } catch {
    // ignore
  }
}

function setCheck(form: PdfForm, fieldName: string, checked: boolean) {
  if (!checked) return
  try {
    form.getCheckBox(fieldName).check()
  } catch {
    // ignore
  }
}

function applyRow(form: PdfForm, row: SodexoPatologiaRow, parsed: PatologiaParsed) {
  if (parsed.negado) {
    setCheck(form, row.checkNo, true)
    return
  }
  if (parsed.si) {
    setCheck(form, row.checkSi, true)
    setText(form, row.descField, parsed.descripcion)
  }
}

export function fillSodexoPatologicos(
  form: PdfForm,
  patologicos: Record<string, unknown> | null | undefined,
): string {
  const record = patologicos ?? {}
  for (const row of [...SODEXO_PATOLOGICOS_LEFT, ...SODEXO_PATOLOGICOS_RIGHT]) {
    applyRow(form, row, parsePatologiaEntry(record[row.amiKey]))
  }

  const extras: string[] = []
  for (const key of SODEXO_PATOLOGICOS_EXTRA_KEYS) {
    const p = parsePatologiaEntry(record[key])
    if (p.si) {
      const label = key.replace(/_/g, ' ')
      extras.push(`${label}: ${p.descripcion || 'Sí'}`)
    }
  }
  return extras.join('\n')
}

/** Marca «Niega» en filas §5 sin dato AMI (paridad con ejemplo impreso). */
export function applySodexoPatologicosDefaultNiega(form: PdfForm) {
  for (const pair of SODEXO_PATOLOGICOS_ALL_PAIRS) {
    sodexoDefaultNiegaPair(form, pair)
  }
}
