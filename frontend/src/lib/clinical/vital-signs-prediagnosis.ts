/**
 * Prediagnóstico orientativo de signos vitales al momento de la toma.
 * Referencias adulto en reposo (screening ocupacional). NO sustituye criterio médico.
 */

export type VitalSignSeverity = 'normal' | 'warning' | 'alert'

export interface VitalSignFinding {
  id: string
  label: string
  severity: VitalSignSeverity
  detail: string
}

export interface VitalSignsPrediagnosisInput {
  ta_sistolica?: string | number | null
  ta_diastolica?: string | number | null
  fc_min?: string | number | null
  temperatura?: string | number | null
  fr_min?: string | number | null
  perimetro_cintura?: string | number | null
  perimetro_cadera?: string | number | null
  /** 'Femenino' | 'Masculino' — opcional, mejora umbrales de cintura/ICC */
  sexo?: string | null
}

export interface VitalSignsPrediagnosisResult {
  overall: VitalSignSeverity
  findings: VitalSignFinding[]
  /** true si hay al menos un valor numérico capturado */
  hasData: boolean
}

function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function isFemale(sexo: string | null | undefined): boolean {
  if (!sexo) return false
  const s = sexo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return s.startsWith('f')
}

function assessBloodPressure(
  sys: number | null,
  dia: number | null,
): VitalSignFinding[] {
  const out: VitalSignFinding[] = []
  if (sys === null && dia === null) return out

  if (sys !== null && sys < 90) {
    out.push({
      id: 'ta_hypo_sys',
      label: 'Tensión arterial',
      severity: 'alert',
      detail: `Sistólica ${sys} mmHg — por debajo de 90 (hipotensión).`,
    })
  } else if (dia !== null && dia < 60) {
    out.push({
      id: 'ta_hypo_dia',
      label: 'Tensión arterial',
      severity: 'alert',
      detail: `Diastólica ${dia} mmHg — por debajo de 60 (hipotensión).`,
    })
  } else if (
    (sys !== null && sys >= 140) ||
    (dia !== null && dia >= 90)
  ) {
    out.push({
      id: 'ta_high',
      label: 'Tensión arterial',
      severity: 'alert',
      detail: `TA ${sys ?? '—'}/${dia ?? '—'} mmHg — elevada (≥140/90).`,
    })
  } else if (
    (sys !== null && sys >= 120) ||
    (dia !== null && dia >= 85)
  ) {
    out.push({
      id: 'ta_elevated',
      label: 'Tensión arterial',
      severity: 'warning',
      detail: `TA ${sys ?? '—'}/${dia ?? '—'} mmHg — límite alto (120–139 / 85–89).`,
    })
  } else if (sys !== null || dia !== null) {
    out.push({
      id: 'ta_normal',
      label: 'Tensión arterial',
      severity: 'normal',
      detail: `TA ${sys ?? '—'}/${dia ?? '—'} mmHg — dentro de rango usual en reposo.`,
    })
  }

  return out
}

function assessHeartRate(fc: number | null): VitalSignFinding | null {
  if (fc === null) return null
  if (fc < 60) {
    return {
      id: 'fc_brady',
      label: 'Frecuencia cardiaca',
      severity: 'warning',
      detail: `${fc} lpm — bradicardia (<60).`,
    }
  }
  if (fc > 100) {
    return {
      id: 'fc_tachy',
      label: 'Frecuencia cardiaca',
      severity: fc > 120 ? 'alert' : 'warning',
      detail: `${fc} lpm — taquicardia (>100).`,
    }
  }
  return {
    id: 'fc_normal',
    label: 'Frecuencia cardiaca',
    severity: 'normal',
    detail: `${fc} lpm — dentro de rango usual (60–100).`,
  }
}

function assessTemperature(temp: number | null): VitalSignFinding | null {
  if (temp === null) return null
  if (temp < 36) {
    return {
      id: 'temp_low',
      label: 'Temperatura',
      severity: 'warning',
      detail: `${temp} °C — por debajo de 36 °C.`,
    }
  }
  if (temp >= 38) {
    return {
      id: 'temp_fever',
      label: 'Temperatura',
      severity: 'alert',
      detail: `${temp} °C — fiebre (≥38 °C).`,
    }
  }
  if (temp >= 37.5) {
    return {
      id: 'temp_subfebrile',
      label: 'Temperatura',
      severity: 'warning',
      detail: `${temp} °C — febrícula (37.5–37.9 °C).`,
    }
  }
  return {
    id: 'temp_normal',
    label: 'Temperatura',
    severity: 'normal',
    detail: `${temp} °C — dentro de rango usual.`,
  }
}

function assessRespiratoryRate(fr: number | null): VitalSignFinding | null {
  if (fr === null) return null
  if (fr < 12) {
    return {
      id: 'fr_brady',
      label: 'Frecuencia respiratoria',
      severity: 'warning',
      detail: `${fr} rpm — bradipnea (<12).`,
    }
  }
  if (fr > 20) {
    return {
      id: 'fr_tachy',
      label: 'Frecuencia respiratoria',
      severity: fr >= 24 ? 'alert' : 'warning',
      detail: `${fr} rpm — taquipnea (>20).`,
    }
  }
  return {
    id: 'fr_normal',
    label: 'Frecuencia respiratoria',
    severity: 'normal',
    detail: `${fr} rpm — dentro de rango usual (12–20).`,
  }
}

function assessWaist(
  cintura: number | null,
  sexo: string | null | undefined,
): VitalSignFinding | null {
  if (cintura === null) return null
  const female = isFemale(sexo)
  const alertCm = female ? 88 : 102
  const warnCm = female ? 80 : 94
  if (cintura > alertCm) {
    return {
      id: 'waist_high',
      label: 'Perímetro de cintura',
      severity: 'warning',
      detail: `${cintura} cm — por encima de ${alertCm} cm (referencia ${female ? 'mujer' : 'hombre'}).`,
    }
  }
  if (cintura >= warnCm) {
    return {
      id: 'waist_border',
      label: 'Perímetro de cintura',
      severity: 'warning',
      detail: `${cintura} cm — límite alto (${warnCm}–${alertCm} cm).`,
    }
  }
  return {
    id: 'waist_normal',
    label: 'Perímetro de cintura',
    severity: 'normal',
    detail: `${cintura} cm — dentro de referencia usual.`,
  }
}

function assessWaistHipRatio(
  cintura: number | null,
  cadera: number | null,
  sexo: string | null | undefined,
): VitalSignFinding | null {
  if (cintura === null || cadera === null || cadera <= 0) return null
  const ratio = cintura / cadera
  const r = Math.round(ratio * 100) / 100
  const female = isFemale(sexo)
  const limit = female ? 0.85 : 0.9
  if (ratio > limit) {
    return {
      id: 'icc_high',
      label: 'Índice cintura/cadera',
      severity: 'warning',
      detail: `ICC ${r} — por encima de ${limit} (referencia ${female ? 'mujer' : 'hombre'}).`,
    }
  }
  return {
    id: 'icc_normal',
    label: 'Índice cintura/cadera',
    severity: 'normal',
    detail: `ICC ${r} — dentro de referencia usual (≤${limit}).`,
  }
}

function overallSeverity(findings: VitalSignFinding[]): VitalSignSeverity {
  if (findings.some(f => f.severity === 'alert')) return 'alert'
  if (findings.some(f => f.severity === 'warning')) return 'warning'
  if (findings.length === 0) return 'normal'
  return 'normal'
}

/** Evalúa signos vitales capturados y devuelve hallazgos orientativos. */
export function evaluateVitalSignsPrediagnosis(
  input: VitalSignsPrediagnosisInput,
): VitalSignsPrediagnosisResult {
  const sys = parseNum(input.ta_sistolica)
  const dia = parseNum(input.ta_diastolica)
  const fc = parseNum(input.fc_min)
  const temp = parseNum(input.temperatura)
  const fr = parseNum(input.fr_min)
  const cintura = parseNum(input.perimetro_cintura)
  const cadera = parseNum(input.perimetro_cadera)

  const hasData =
    sys !== null ||
    dia !== null ||
    fc !== null ||
    temp !== null ||
    fr !== null ||
    cintura !== null ||
    cadera !== null

  const fcFinding = assessHeartRate(fc)
  const tempFinding = assessTemperature(temp)
  const frFinding = assessRespiratoryRate(fr)
  const waistFinding = assessWaist(cintura, input.sexo)
  const iccFinding = assessWaistHipRatio(cintura, cadera, input.sexo)

  const findings: VitalSignFinding[] = [
    ...assessBloodPressure(sys, dia),
    ...(fcFinding ? [fcFinding] : []),
    ...(tempFinding ? [tempFinding] : []),
    ...(frFinding ? [frFinding] : []),
    ...(waistFinding ? [waistFinding] : []),
    ...(iccFinding ? [iccFinding] : []),
  ]

  return {
    overall: overallSeverity(findings),
    findings,
    hasData,
  }
}
