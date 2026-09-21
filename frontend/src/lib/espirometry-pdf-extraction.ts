/**
 * Vista de extracción espirométrica para el PDF validado (tabla + metadatos).
 */
import type { EspirometriaParametrosRow } from '@/components/clinical/EspirometriaClinicalCriteriaPanel'

export type EspirometryPdfParamRow = {
  label: string
  m1: string
  m1Pct: string
  m2: string
  m2Pct: string
  m3: string
  m3Pct: string
  ref: string
  lln: string
}

export type EspirometryPdfExtractionView = {
  paciente: Array<{ label: string; value: string }>
  estudio: Array<{ label: string; value: string }>
  condiciones: Array<{ label: string; value: string }>
  parametros: EspirometryPdfParamRow[]
  repetibilidadAtsErs: string | null
}

function unwrapExtracted(structuredData: unknown): Record<string, unknown> {
  const sd = (structuredData ?? {}) as Record<string, unknown>
  if (sd.extracted_data && typeof sd.extracted_data === 'object' && !Array.isArray(sd.extracted_data)) {
    return sd.extracted_data as Record<string, unknown>
  }
  return sd
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return null
}

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '—'
    return Number.isInteger(v) ? String(v) : v.toFixed(2)
  }
  const t = String(v).trim()
  return t || '—'
}

function readManeuver(row: EspirometriaParametrosRow, key: 'm1' | 'm2' | 'm3'): unknown {
  const alt = `${key}_value` as const
  return row[key] ?? row[alt]
}

function readPct(row: EspirometriaParametrosRow, key: 'm1' | 'm2' | 'm3'): unknown {
  const pctKey = `${key}_pct_ref` as keyof EspirometriaParametrosRow
  return row[pctKey]
}

function pushField(
  target: Array<{ label: string; value: string }>,
  label: string,
  value: unknown,
): void {
  const formatted = fmtCell(value)
  if (formatted !== '—') target.push({ label, value: formatted })
}

function buildMetaSection(
  source: Record<string, unknown> | null,
  fields: Array<{ key: string; label: string }>,
): Array<{ label: string; value: string }> {
  if (!source) return []
  const out: Array<{ label: string; value: string }> = []
  for (const { key, label } of fields) {
    pushField(out, label, source[key])
  }
  return out
}

function buildRepetibilidadAtsErs(calidad: Record<string, unknown> | null): string | null {
  if (!calidad) return null
  const fvc = fmtCell(calidad.repetibilidad_ats_ers_fvc)
  const fev1 = fmtCell(calidad.repetibilidad_ats_ers_fev1)
  if (fvc === '—' && fev1 === '—') return null
  return `FVC: ${fvc}, FEV1: ${fev1}`
}

export function buildEspirometryPdfExtractionView(
  structuredData: unknown,
): EspirometryPdfExtractionView {
  const extracted = unwrapExtracted(structuredData)
  const paciente = asRecord(extracted.paciente)
  const estudio = asRecord(extracted.estudio)
  const condiciones = asRecord(extracted.condiciones)
  const calidad = asRecord(extracted.calidad)

  const parametrosRaw = Array.isArray(extracted.parametros)
    ? (extracted.parametros as EspirometriaParametrosRow[])
    : []

  const parametros: EspirometryPdfParamRow[] = parametrosRaw
    .filter(row => row && typeof row === 'object')
    .map(row => ({
      label: fmtCell(row.label ?? row.key),
      m1: fmtCell(readManeuver(row, 'm1')),
      m1Pct: fmtCell(readPct(row, 'm1')),
      m2: fmtCell(readManeuver(row, 'm2')),
      m2Pct: fmtCell(readPct(row, 'm2')),
      m3: fmtCell(readManeuver(row, 'm3')),
      m3Pct: fmtCell(readPct(row, 'm3')),
      ref: fmtCell(row.ref ?? row.ref_value),
      lln: fmtCell(row.lln ?? row.lln_value),
    }))

  return {
    paciente: buildMetaSection(paciente, [
      { key: 'nombre_completo', label: 'Nombre' },
      { key: 'sexo', label: 'Sexo' },
      { key: 'edad_anios', label: 'Edad (a)' },
      { key: 'talla_cm', label: 'Talla (cm)' },
      { key: 'peso_kg', label: 'Peso (Kg)' },
      { key: 'imc', label: 'IMC' },
      { key: 'fuma', label: 'I. Fuma' },
      { key: 'motivo', label: 'Motivo' },
      { key: 'procedencia', label: 'Procedencia' },
    ]),
    estudio: buildMetaSection(estudio, [
      { key: 'referencia', label: 'Referencia' },
      { key: 'fecha_estudio', label: 'Fecha' },
      { key: 'hora_estudio', label: 'Hora' },
      { key: 'tipo_reporte', label: 'Tipo' },
      { key: 'version_software', label: 'Versión' },
    ]),
    condiciones: buildMetaSection(condiciones, [
      { key: 'tecnico', label: 'Técnico' },
      { key: 'transductor', label: 'Transductor' },
      { key: 'temperatura_c', label: 'Temp (°C)' },
      { key: 'presion_mmhg', label: 'Pres (mmHg)' },
      { key: 'humedad_pct', label: 'Humedad (%)' },
      { key: 'referencia_ecuacion', label: 'Referencias' },
      { key: 'factor_etnico', label: 'F. étnico' },
      { key: 'factor_btps', label: 'F. BTPS' },
    ]),
    parametros,
    repetibilidadAtsErs: buildRepetibilidadAtsErs(calidad),
  }
}
