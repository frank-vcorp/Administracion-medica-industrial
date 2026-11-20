/**
 * Bloques del «ESTUDIO DE AUDIOMETRIA» (formato de una hoja).
 *
 * Arma los textos que el PDF de referencia imprime debajo de las gráficas:
 * datos del paciente y del equipo, tabla de 500–3000 Hz, pérdida por oído,
 * hipoacusia bilateral combinada, exploración, descripción, diagnóstico
 * nosológico / etiológico / clasificación y recomendaciones.
 *
 * No inventa umbrales. La pérdida se calcula sólo con las cuatro frecuencias
 * de la tabla. Si el documento ya trae el porcentaje, se conserva.
 * La etiología sólo se imprime cuando viene escrita en la extracción.
 */
import type { PatientIdentificationPdf } from '@/lib/pdf/patient-identification'

export const FRECUENCIAS_TABLA_PERDIDA_HZ = [500, 1000, 2000, 3000] as const

const DIAGNOSTICO_VACIO = 'Aceptado sin diagnóstico adicional explícito.'

const NOSOLOGICO_POR_PATRON: Record<string, string> = {
  NORMAL: 'Audición Normal',
  AUDICION_NORMAL: 'Audición Normal',
  SIN_PATRON_PATOLOGICO_CLARO: 'Audición Normal',
  NEUROSENSORIAL: 'Hipoacusia Neurosensorial',
  NEUROSENSORIAL_MEDIAS_AGUDAS: 'Hipoacusia Neurosensorial',
  HIPOACUSIA_NEUROSENSORIAL: 'Hipoacusia Neurosensorial',
  CONDUCTIVA: 'Hipoacusia Conductiva',
  HIPOACUSIA_CONDUCTIVA: 'Hipoacusia Conductiva',
  MIXTA: 'Hipoacusia Mixta',
  HIPOACUSIA_MIXTA: 'Hipoacusia Mixta',
  GRAVES: 'Hipoacusia de graves',
}

const CLASIFICACION_POR_CODIGO: Record<string, string> = {
  NO_APLICA: 'No Aplica',
  NORMAL: 'No Aplica',
  LEVE: 'Leve',
  MODERADA: 'Moderada',
  MODERADAMENTE_SEVERA: 'Moderadamente severa',
  SEVERA: 'Severa',
  PROFUNDA: 'Profunda',
}

export interface AudiometriaFormatoReferencia {
  identificacion: string | null
  nacimiento: string | null
  sexo: string | null
  notasPaciente: string | null
  fechaEstudio: string | null
  horaEstudio: string | null
  audiometro: string | null
  transductor: string | null
  numeroSerie: string | null
  ultimaCalibracion: string | null
  notasPrueba: string | null
  perdidaPorOidoOd: string | null
  perdidaPorOidoOi: string | null
  hipoacusiaBilateralCombinada: string | null
  faringe: string | null
  cad: string | null
  cai: string | null
  mtd: string | null
  mti: string | null
  descripcionAudiometrica: string
  diagnosticoNosologicoOd: string | null
  diagnosticoNosologicoOi: string | null
  diagnosticoEtiologicoOd: string | null
  diagnosticoEtiologicoOi: string | null
  clasificacionHipoacusiaOd: string | null
  clasificacionHipoacusiaOi: string | null
  recomendacionesTexto: string
}

export interface BuildAudiometriaFormatoInput {
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'
  doctorDiagnosis: string | null
  doctorNotes: string | null
  recomendacionesValidadas: string[]
  patient: PatientIdentificationPdf
  extraction: Record<string, unknown>
  prediagnosis: Record<string, unknown>
  clinicalContext: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const found = text(value)
    if (found) return found
  }
  return null
}

function parsePercent(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parsed = Number(value.replace('%', '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function codeKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '_')
}

function labelFromMap(value: string | null, map: Record<string, string>): string | null {
  if (!value) return null
  const mapped = map[codeKey(value)]
  if (mapped) return mapped
  if (/[a-záéíóúñ]/i.test(value) && value !== value.toUpperCase()) return value.trim()
  return null
}

/** (500 + 1000 + 2000 + 3000) × 0.2. Null si falta alguna de las cuatro. */
export function calcularPerdidaPorOidoPct(
  umbrales: ReadonlyArray<number | null>,
): number | null {
  if (umbrales.length !== 4) return null
  if (umbrales.some((v) => v === null || !Number.isFinite(v))) return null
  const suma = (umbrales as number[]).reduce((acc, v) => acc + v, 0)
  return Math.round(suma * 20) / 100
}

/**
 * ((pérdida del oído menos afectado × 7) + (pérdida del más afectado × 1)) / 8.
 * El resultado se redondea a 2 decimales (7.125 → 7.13).
 */
export function calcularHipoacusiaBilateralCombinadaPct(od: number, oi: number): number {
  const menor = Math.min(od, oi)
  const mayor = Math.max(od, oi)
  return Math.round(((menor * 7 + mayor) / 8) * 100) / 100
}

export function formatoPorcentajePerdida(value: number): string {
  return `${value.toFixed(2)}%`
}

export function formatoPorcentajeBilateral(value: number): string {
  const redondeado = Math.round(value * 100) / 100
  return `${redondeado.toFixed(4)}%`
}

function umbralEn(
  mapa: Record<number, number | null>,
  hz: number,
): number | null {
  const value = mapa[hz]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function exploracionDesdeCuestionario(
  clinicalContext: unknown,
  campo: 'faringe' | 'cad' | 'cai' | 'mtd' | 'mti',
): string | null {
  const exploracion = asRecord(asRecord(clinicalContext)?.exploracionFisica)
  const field = asRecord(exploracion?.[campo])
  if (!field) return null
  const estado = text(field.estado)
  const observacion = text(field.observacion)
  if (estado === 'ALTERADO') return observacion ?? 'Alterado'
  if (estado === 'NO_REALIZADO') return 'No realizado'
  if (estado !== 'NORMAL') return observacion
  if (campo === 'faringe') return 'Sin datos patológicos'
  if (campo === 'cad' || campo === 'cai') return 'permeable'
  return 'íntegra, aspecto normal'
}

function earRecord(
  resumen: Record<string, unknown> | null,
  side: 'od' | 'oi',
): Record<string, unknown> | null {
  if (!resumen) return null
  const keys =
    side === 'od'
      ? ['oido_derecho', 'OD', 'right', 'derecho']
      : ['oido_izquierdo', 'OI', 'left', 'izquierdo']
  for (const key of keys) {
    const found = asRecord(resumen[key])
    if (found) return found
  }
  return null
}

function clasificacionDe(
  clasificacion: Record<string, unknown> | null,
  side: 'od' | 'oi',
): string | null {
  if (!clasificacion) return null
  const keys = side === 'od' ? ['right', 'od', 'oido_derecho', 'OD'] : ['left', 'oi', 'oido_izquierdo', 'OI']
  for (const key of keys) {
    const found = text(clasificacion[key])
    if (found) return labelFromMap(found, CLASIFICACION_POR_CODIGO) ?? found
  }
  return null
}

export function buildAudiometriaFormato(
  input: BuildAudiometriaFormatoInput,
): AudiometriaFormatoReferencia {
  const extracted = input.extraction
  const paciente = asRecord(extracted.paciente_detalle)
  const estudio = asRecord(extracted.estudio)
  const campos = asRecord(extracted.campos_fuente)
  const resumen = asRecord(extracted.resumen_oidos)
  const notasCalidad = asRecord(extracted.notas_calidad)
  const predx = input.prediagnosis
  const resumenPorOido = asRecord(predx.resumen_por_oido)
  const resumenBilateral = asRecord(predx.resumen_bilateral)
  const clasificacion = asRecord(predx.clasificacion_hipoacusia)
  const oidoDerecho = earRecord(resumenPorOido, 'od')
  const oidoIzquierdo = earRecord(resumenPorOido, 'oi')

  const taOd = readUmbrales(extracted, 'oido_derecho')
  const taOi = readUmbrales(extracted, 'oido_izquierdo')
  const calculadaOd = calcularPerdidaPorOidoPct(
    FRECUENCIAS_TABLA_PERDIDA_HZ.map((hz) => umbralEn(taOd, hz)),
  )
  const calculadaOi = calcularPerdidaPorOidoPct(
    FRECUENCIAS_TABLA_PERDIDA_HZ.map((hz) => umbralEn(taOi, hz)),
  )
  const perdidaOd =
    parsePercent(resumen?.perdida_por_oido_od_pct) ??
    parsePercent(extracted.perdida_por_oido_od_pct) ??
    calculadaOd
  const perdidaOi =
    parsePercent(resumen?.perdida_por_oido_oi_pct) ??
    parsePercent(extracted.perdida_por_oido_oi_pct) ??
    calculadaOi
  const bilateralFuente =
    parsePercent(resumen?.hipoacusia_bilateral_combinada_od_pct) ??
    parsePercent(resumen?.hipoacusia_bilateral_combinada_pct) ??
    parsePercent(extracted.hipoacusia_bilateral_combinada_pct)
  const bilateral =
    bilateralFuente ??
    (perdidaOd !== null && perdidaOi !== null
      ? calcularHipoacusiaBilateralCombinadaPct(perdidaOd, perdidaOi)
      : null)

  const doctor = text(input.doctorDiagnosis)
  const doctorUtil = doctor && doctor !== DIAGNOSTICO_VACIO ? doctor : null
  const descripcionFuente = firstText(
    notasCalidad?.descripcion,
    extracted.descripcion_audiometrica,
    resumenBilateral?.note,
  )
  const descripcionAudiometrica =
    input.doctorStatus === 'REVIEWED_EDITED' && doctorUtil
      ? doctorUtil
      : descripcionFuente || doctorUtil || text(predx.summary) || '—'

  const nosologicoOd = firstText(
    extracted.diagnostico_nosologico_od,
    labelFromMap(text(oidoDerecho?.pattern), NOSOLOGICO_POR_PATRON),
  )
  const nosologicoOi = firstText(
    extracted.diagnostico_nosologico_oi,
    labelFromMap(text(oidoIzquierdo?.pattern), NOSOLOGICO_POR_PATRON),
  )
  const etiologicoComun = text(extracted.diagnostico_etiologico)
  const clasificacionOd = firstText(
    labelFromMap(text(extracted.clasificacion_hipoacusia_od), CLASIFICACION_POR_CODIGO),
    text(extracted.clasificacion_hipoacusia_od),
    clasificacionDe(clasificacion, 'od'),
    labelFromMap(text(oidoDerecho?.severity), CLASIFICACION_POR_CODIGO),
  )
  const clasificacionOi = firstText(
    labelFromMap(text(extracted.clasificacion_hipoacusia_oi), CLASIFICACION_POR_CODIGO),
    text(extracted.clasificacion_hipoacusia_oi),
    clasificacionDe(clasificacion, 'oi'),
    labelFromMap(text(oidoIzquierdo?.severity), CLASIFICACION_POR_CODIGO),
  )

  const recomendacionesDeExtraccion =
    input.doctorStatus === 'REVIEWED_ACCEPTED' ? text(extracted.recomendaciones) : null
  const recomendacionesTexto =
    input.recomendacionesValidadas.map((linea) => linea.trim()).filter(Boolean).join(' ') ||
    recomendacionesDeExtraccion ||
    '—'

  const campo = (nombre: 'faringe' | 'cad' | 'cai' | 'mtd' | 'mti') =>
    firstText(campos?.[nombre], extracted[nombre]) ??
    exploracionDesdeCuestionario(input.clinicalContext, nombre)

  const serie = [text(estudio?.equipo_numero_serie), text(estudio?.numero_serie_sistema)]
    .filter((parte): parte is string => Boolean(parte))
    .filter((parte, index, all) => all.indexOf(parte) === index)
    .join(' / ')

  return {
    identificacion:
      text(input.patient.universalId) ?? text(paciente?.identificacion),
    nacimiento: text(paciente?.fecha_nacimiento),
    sexo: text(input.patient.sexLabel) ?? text(paciente?.sexo),
    notasPaciente:
      text(paciente?.notas) ?? text(input.patient.tenureInAreaLabel),
    fechaEstudio:
      text(input.patient.attentionDate) ?? text(estudio?.fecha_estudio),
    horaEstudio: text(estudio?.hora_estudio),
    audiometro: text(estudio?.equipo_modelo),
    transductor: text(estudio?.transductor),
    numeroSerie: serie || null,
    ultimaCalibracion: text(estudio?.ultima_calibracion),
    notasPrueba: text(input.doctorNotes),
    perdidaPorOidoOd: perdidaOd === null ? null : formatoPorcentajePerdida(perdidaOd),
    perdidaPorOidoOi: perdidaOi === null ? null : formatoPorcentajePerdida(perdidaOi),
    hipoacusiaBilateralCombinada:
      bilateral === null ? null : formatoPorcentajeBilateral(bilateral),
    faringe: campo('faringe'),
    cad: campo('cad'),
    cai: campo('cai'),
    mtd: campo('mtd'),
    mti: campo('mti'),
    descripcionAudiometrica,
    diagnosticoNosologicoOd: nosologicoOd,
    diagnosticoNosologicoOi: nosologicoOi,
    diagnosticoEtiologicoOd: firstText(extracted.diagnostico_etiologico_od, etiologicoComun),
    diagnosticoEtiologicoOi: firstText(extracted.diagnostico_etiologico_oi, etiologicoComun),
    clasificacionHipoacusiaOd: clasificacionOd,
    clasificacionHipoacusiaOi: clasificacionOi,
    recomendacionesTexto,
  }
}

function readUmbrales(
  extracted: Record<string, unknown>,
  side: 'oido_derecho' | 'oido_izquierdo',
): Record<number, number | null> {
  const ear = asRecord(extracted[side])
  const va = asRecord(ear?.va) ?? asRecord(ear?.via_aerea) ?? {}
  const out: Record<number, number | null> = {}
  for (const [key, value] of Object.entries(va)) {
    const freq = Number(key)
    if (!Number.isFinite(freq)) continue
    out[freq] =
      typeof value === 'number' && Number.isFinite(value)
        ? value
        : typeof value === 'string' && Number.isFinite(Number(value))
          ? Number(value)
          : null
  }
  return out
}
