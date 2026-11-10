import { inheritVitalsFromSomatometry } from '@/lib/espirometria-inherited-vitals'
import type { CertificadoMedicoPayload } from '@/schemas/clinical/certificado-medico.schema'
import { emptySignosVitalesCertificado } from '@/schemas/clinical/certificado-medico.schema'

type Signos = CertificadoMedicoPayload['signos_vitales']

function str(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  const t = String(v).trim()
  return t || undefined
}

function mergeField(current: string | undefined, incoming: string | undefined): string {
  if (current?.trim()) return current
  return incoming ?? ''
}

/** Mapea agudeza del estudio independiente a campos del certificado (VL/VLC/VC/VCC). */
export function inheritAgudezaForCertificado(
  eyeAcuity: Record<string, unknown> | null | undefined,
): Pick<Signos, 'agudeza_vl' | 'agudeza_vlc' | 'agudeza_vc' | 'agudeza_vcc'> {
  const e = eyeAcuity ?? {}
  const pair = (a: string, b: string) => {
    const x = str(e[a])
    const y = str(e[b])
    if (x && y) return `${x} OD / ${y} OI`
    return x ?? y ?? ''
  }
  return {
    agudeza_vl: pair('vision_lejana_od', 'vision_lejana_oi'),
    agudeza_vlc: pair('lejana_corregida_od', 'lejana_corregida_oi'),
    agudeza_vc: pair('vision_cercana_od', 'vision_cercana_oi'),
    agudeza_vcc: pair('cercana_corregida_od', 'cercana_corregida_oi'),
  }
}

export function mergeCertificadoSignosPrefill(
  existing: Signos | null | undefined,
  somatometry: Record<string, unknown> | null | undefined,
  eyeAcuity: Record<string, unknown> | null | undefined,
): Signos {
  const base = { ...emptySignosVitalesCertificado(), ...(existing ?? {}) }
  const soma = inheritVitalsFromSomatometry(somatometry)
  const agu = inheritAgudezaForCertificado(eyeAcuity)

  const merged: Signos = {
    ...base,
    peso_kg: mergeField(base.peso_kg, soma.peso_kg),
    talla_m: mergeField(base.talla_m, soma.talla_m),
    ta_sistolica: mergeField(base.ta_sistolica, soma.ta_sistolica),
    ta_diastolica: mergeField(base.ta_diastolica, soma.ta_diastolica),
    fc_min: mergeField(base.fc_min, str(somatometry?.fc_min)),
    fr_min: mergeField(base.fr_min, str(somatometry?.fr_min)),
    temperatura: mergeField(base.temperatura, str(somatometry?.temperatura)),
    spo2_pct: mergeField(base.spo2_pct, str(somatometry?.spo2_pct)),
    agudeza_vl: mergeField(base.agudeza_vl, agu.agudeza_vl),
    agudeza_vlc: mergeField(base.agudeza_vlc, agu.agudeza_vlc),
    agudeza_vc: mergeField(base.agudeza_vc, agu.agudeza_vc),
    agudeza_vcc: mergeField(base.agudeza_vcc, agu.agudeza_vcc),
  }
  return merged
}

export function defaultHoraAtencionMexico(date = new Date()): string {
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })
}

export function prefillCertificadoPatientFields(input: {
  parsedFolio?: string
  workerNationalId?: string | null
  parsedSexo?: string
  parsedDomicilio?: string
  longitudinalData?: Record<string, unknown> | null
}): { identificacion_folio: string; sexo_atencion: string; domicilio_atencion: string } {
  const hist = input.longitudinalData
  const dp =
    hist?.datos_personales && typeof hist.datos_personales === 'object'
      ? (hist.datos_personales as Record<string, unknown>)
      : null

  const sexoHist = str(dp?.sexo) ?? str(dp?.genero)
  const domHist = str(dp?.direccion) ?? str(dp?.domicilio)

  return {
    identificacion_folio:
      input.parsedFolio?.trim() ||
      str(input.workerNationalId) ||
      '',
    sexo_atencion: input.parsedSexo?.trim() || sexoHist || '',
    domicilio_atencion: input.parsedDomicilio?.trim() || domHist || '',
  }
}
