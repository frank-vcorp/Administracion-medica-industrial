/**
 * Herencia de papeleta para el reporte de campimetría (no se captura de nuevo).
 * @id IMPL-FEATURE-20260914-01
 */

import { deriveAgudezaVisualResumen } from '@/lib/clinical/agudeza-visual'

export type InheritedAcuity = {
  vision_lejana_od?: string
  vision_lejana_oi?: string
  vision_cercana_od?: string
  vision_cercana_oi?: string
  lejana_corregida_od?: string
  lejana_corregida_oi?: string
  cercana_corregida_od?: string
  cercana_corregida_oi?: string
  resumen?: string
  pending: boolean
}

export type InheritedAntecedente = {
  label: string
  estado: string
  detalle?: string
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>
  }
  return null
}

function patologiaLine(raw: unknown): { estado: string; detalle?: string } | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return null
    return { estado: t }
  }
  const obj = asRecord(raw)
  if (!obj) return null
  const estado = String(obj.estado ?? '').trim() || '—'
  const detalle = asRecord(obj.detalle)
  const parts = detalle
    ? [detalle.desde_cuando, detalle.tratamiento, detalle.observaciones]
        .map(x => String(x ?? '').trim())
        .filter(Boolean)
    : []
  return { estado, detalle: parts.join(' · ') || undefined }
}

export function inheritAcuityFromExam(
  eyeAcuityData: Record<string, unknown> | null | undefined,
): InheritedAcuity {
  const e = eyeAcuityData ?? {}
  const lejanaOd = String(e.vision_lejana_od ?? '').trim()
  const lejanaOi = String(e.vision_lejana_oi ?? '').trim()
  const pending = !lejanaOd && !lejanaOi
  return {
    vision_lejana_od: lejanaOd || undefined,
    vision_lejana_oi: lejanaOi || undefined,
    vision_cercana_od: String(e.vision_cercana_od ?? '').trim() || undefined,
    vision_cercana_oi: String(e.vision_cercana_oi ?? '').trim() || undefined,
    lejana_corregida_od: String(e.lejana_corregida_od ?? '').trim() || undefined,
    lejana_corregida_oi: String(e.lejana_corregida_oi ?? '').trim() || undefined,
    cercana_corregida_od: String(e.cercana_corregida_od ?? '').trim() || undefined,
    cercana_corregida_oi: String(e.cercana_corregida_oi ?? '').trim() || undefined,
    resumen: pending
      ? undefined
      : deriveAgudezaVisualResumen(lejanaOd, lejanaOi) || undefined,
    pending,
  }
}

/** Convierte `eyeAcuityData.campimetria` del examen/agudeza a valor de confrontación (O9-21). */
export function mapExamCampimetriaToConfrontacion(
  raw: unknown,
): 'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES' | 'ALTERADOS' | 'NO APLICA' | null {
  const s = String(raw ?? '').trim().toUpperCase()
  if (!s || s === 'NO APLICA') {
    if (String(raw ?? '').trim() === 'NO APLICA') return 'NO APLICA'
    return null
  }
  if (s.includes('ALTER')) return 'ALTERADOS'
  if (s.includes('NORMAL') || s.includes('PARAMETRO')) {
    return 'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES'
  }
  return null
}

export type CampimetriaAgudezaHeredada = Omit<InheritedAcuity, 'pending'> & {
  pending?: boolean
}

export function acuityToCampimetriaPayloadSnapshot(
  acuity: InheritedAcuity,
): CampimetriaAgudezaHeredada {
  const { pending, ...rest } = acuity
  return { ...rest, pending }
}

export function applyExamEyeDataToCampimetriaDraft<
  T extends {
    confrontacion: {
      ojo_izquierdo: string
      ojo_derecho: string
    }
    agudeza_heredada?: CampimetriaAgudezaHeredada | null
  },
>(draft: T, eyeAcuityData: Record<string, unknown> | null | undefined): T {
  const acuity = inheritAcuityFromExam(eyeAcuityData)
  const confront = mapExamCampimetriaToConfrontacion(eyeAcuityData?.campimetria)
  return {
    ...draft,
    agudeza_heredada: acuity.pending ? null : acuityToCampimetriaPayloadSnapshot(acuity),
    confrontacion: confront
      ? { ojo_izquierdo: confront, ojo_derecho: confront }
      : draft.confrontacion,
  }
}

export function inheritAntecedentesFromPapeleta(input: {
  physicalExamData?: Record<string, unknown> | null
  longitudinalData?: Record<string, unknown> | null
}): InheritedAntecedente[] {
  const captured = asRecord(input.physicalExamData?.antecedentes_captured)
  const fromExam =
    asRecord(captured?.patologicos) ?? asRecord(input.physicalExamData?.patologicos)
  const fromHist = asRecord(input.longitudinalData?.patologicos)
  const src = fromExam ?? fromHist ?? {}
  const keys: Array<{ key: string; label: string }> = [
    { key: 'diabetes', label: 'Diabetes' },
    { key: 'has', label: 'Hipertensión arterial' },
    { key: 'cirugias', label: 'Cirugías (expediente)' },
  ]
  return keys.map(({ key, label }) => {
    const line = patologiaLine(src[key])
    return {
      label,
      estado: line?.estado ?? 'Sin dato en papeleta',
      detalle: line?.detalle,
    }
  })
}
