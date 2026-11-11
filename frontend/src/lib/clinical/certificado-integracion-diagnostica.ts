/**
 * Auto-composición de `integracion_diagnostica` (certificado VI) desde antecedentes SÍ
 * y signos vitales del certificado — mismo criterio F04 que examen médico, sin historia laboral.
 */
import {
  HEREDOFAMILIARES_DESCRIPCIONES,
  readHeredoFamiliaresDisplay,
} from '@/lib/antecedentes-fields'
import { parseHeredoFamiliaresSelection } from '@/lib/heredo-familiares-multiselect'
import { deriveAgudezaVisualResumen } from '@/lib/clinical/agudeza-visual'
import {
  buildImpresionDiagnosticaFromAntecedentesYExamen,
  hasPatologicoSi,
  isImpresionDiagnosticaPlaceholder,
  type AntecedentesCapturedSnapshot,
} from '@/lib/clinical/impresion-diagnostica'
import type { ExamForHallazgos } from '@/lib/clinical/recommendations'
import type { CertificadoMedicoPayload } from '@/schemas/clinical/certificado-medico.schema'

export { isImpresionDiagnosticaPlaceholder as isIntegracionDiagnosticaPlaceholder }

function sectionRecord(
  antecedentes: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> {
  const raw = antecedentes?.[key]
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

function heredoFieldIsPositive(field: string, hf: Record<string, unknown>): boolean {
  if (field === 'mentales') {
    const m = String(hf.mentales ?? '').trim()
    const esp = String(hf.mentales_especifique ?? '').trim()
    return m === 'SI' || esp.length > 0
  }
  const v = String(hf[field] ?? '').trim()
  if (!v) return false
  const sel = parseHeredoFamiliaresSelection(v)
  return sel.length > 0 && !sel.includes('NEGADOS')
}

export function hasHeredofamiliarSi(
  antecedentes?: AntecedentesCapturedSnapshot | Record<string, unknown> | null,
): boolean {
  if (!antecedentes || typeof antecedentes !== 'object') return false
  const hf = sectionRecord(antecedentes, 'heredo_familiares')
  for (const item of HEREDOFAMILIARES_DESCRIPCIONES) {
    if (heredoFieldIsPositive(item.field, hf)) return true
  }
  return false
}

export function hasAntecedenteSiForCertificadoIntegracion(
  antecedentes?: AntecedentesCapturedSnapshot | Record<string, unknown> | null,
): boolean {
  return hasPatologicoSi(antecedentes) || hasHeredofamiliarSi(antecedentes)
}

function collectHeredofamiliaresSiLines(hf: Record<string, unknown>): string[] {
  const lines: string[] = []
  for (const item of HEREDOFAMILIARES_DESCRIPCIONES) {
    if (!heredoFieldIsPositive(item.field, hf)) continue
    const display = readHeredoFamiliaresDisplay(hf, item.field).trim()
    if (!display || display === 'Negado') continue
    lines.push(`${item.label}: ${display}`)
  }
  return lines
}

function joinSentences(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.endsWith('.') ? p : `${p}.`))
    .join(' ')
}

/** Extrae pares Snellen desde texto precargado en certificado (p. ej. `20/20 OD / 20/25 OI`). */
function parseSnellenPairFromCertificadoText(text: string | undefined): {
  od: string
  oi: string
} {
  const matches = String(text ?? '').match(/\d+\/\d+/g) ?? []
  return { od: matches[0] ?? '', oi: matches[1] ?? matches[0] ?? '' }
}

export function examForHallazgosFromCertificadoSignos(
  signos: CertificadoMedicoPayload['signos_vitales'],
): ExamForHallazgos {
  const complexion = String(signos.complexion ?? '').trim().toUpperCase()
  let estado_nutricional: string | null = null
  if (complexion === 'SOBREPESO') estado_nutricional = 'SOBREPESO'
  else if (complexion === 'OBESIDAD') estado_nutricional = 'OBESIDAD'
  else if (complexion === 'BAJO PESO') estado_nutricional = 'BAJO PESO'

  const sist = parseInt(String(signos.ta_sistolica ?? '').trim(), 10)
  const diast = parseInt(String(signos.ta_diastolica ?? '').trim(), 10)
  let presion_arterial_resumen: string | null = null
  if (Number.isFinite(sist) && Number.isFinite(diast)) {
    if (sist >= 140 || diast >= 90) presion_arterial_resumen = 'ALTA'
    else if (sist <= 90 || diast <= 60) presion_arterial_resumen = 'BAJA'
    else presion_arterial_resumen = 'NORMAL AL MOMENTO DE LA TOMA'
  }

  const { od, oi } = parseSnellenPairFromCertificadoText(signos.agudeza_vl)
  const agudeza_visual_resumen = deriveAgudezaVisualResumen(od, oi) || null

  return {
    estado_nutricional,
    presion_arterial_resumen,
    agudeza_visual_resumen,
  }
}

export function buildIntegracionDiagnosticaCertificado(input: {
  antecedentes?: Record<string, unknown> | null
  signos: CertificadoMedicoPayload['signos_vitales']
}): string {
  if (!hasAntecedenteSiForCertificadoIntegracion(input.antecedentes)) return ''

  const ant = input.antecedentes ?? {}
  const hf = sectionRecord(ant, 'heredo_familiares')
  const heredoLines = collectHeredofamiliaresSiLines(hf)

  const sinHistoriaLaboral: Record<string, unknown> = {
    ...ant,
    historia_laboral: {},
  }

  const fromPatologicosYSignos = buildImpresionDiagnosticaFromAntecedentesYExamen({
    antecedentes: sinHistoriaLaboral,
    exam: examForHallazgosFromCertificadoSignos(input.signos),
    especifiquePositivos: null,
  })

  if (heredoLines.length === 0) {
    return fromPatologicosYSignos
  }

  const heredoBlock = `Antecedentes heredo-familiares: ${joinSentences(heredoLines)}`
  if (!fromPatologicosYSignos.trim()) {
    return `${heredoBlock} Examen físico y estudios sin hallazgos agudos adicionales en la correlación clínica.`
  }
  return `${heredoBlock} ${fromPatologicosYSignos}`.replace(/\s+/g, ' ').trim()
}
