export const CONSULTA_MEDICA_SCHEMA_VERSION = 'consulta-medica-v1' as const

export const TIPO_CONSULTA_VALUES = [
  'ENFERMEDAD_GENERAL',
  'ENFERMEDAD_PROFESIONAL',
  'ACCIDENTE_TRABAJO',
  'ACCIDENTE_TRAYECTO',
  'PRIMER_AUXILIO',
  'INCIDENTE',
] as const

export type TipoConsultaValue = (typeof TIPO_CONSULTA_VALUES)[number]

export const TIPO_CONSULTA_LABELS: Record<TipoConsultaValue, string> = {
  ENFERMEDAD_GENERAL: 'Enfermedad general',
  ENFERMEDAD_PROFESIONAL: 'Enfermedad profesional',
  ACCIDENTE_TRABAJO: 'Accidente de trabajo',
  ACCIDENTE_TRAYECTO: 'Accidente de trayecto',
  PRIMER_AUXILIO: 'Primer auxilio',
  INCIDENTE: 'Incidente',
}

export type SignosVitalesConsulta = {
  ta_sistolica?: string
  ta_diastolica?: string
  fc_min?: string
  fr_min?: string
  temperatura?: string
  peso_kg?: string
  talla_m?: string
  imc?: string
  complexion?: string
}

export type RecetaLinea = {
  medicamento: string
  presentacion?: string
  dosis: string
  frecuencia: string
  duracion: string
}

/** Seis rubros de texto — antecedentes patológicos / no patológicos en consulta (Dra. Jacky). */
export type AntecedentesConsultaResumen = {
  cronico_degenerativos: string
  traumaticos: string
  quirurgicos: string
  transfusionales: string
  alergicos: string
  toxicomanias: string
}

/** Procedimientos / cargos en consulta sin EventTest (férula, medicamento tópico/local, otros). */
export type ConsultaAdicionalItem = {
  detalle?: string
  /** Monto MXN para cobro sugerido; omitir o 0 si no aplica cargo. */
  precio?: number
}

export type ConsultaAdicionalesConsulta = {
  ferula?: ConsultaAdicionalItem
  medicamento_aplicacion?: ConsultaAdicionalItem
  otros?: ConsultaAdicionalItem
}

export type ConsultaMedicaPayload = {
  schemaVersion: typeof CONSULTA_MEDICA_SCHEMA_VERSION
  tipo_consulta: TipoConsultaValue
  motivo_consulta: string
  signos_vitales: SignosVitalesConsulta
  exploracion_fisica: string
  diagnostico_unificado: string
  diagnostico_especifico: string
  incapacidad_aplica: boolean
  otorga_incapacidad: 'SI' | 'NO'
  dias_incapacidad?: number
  pase_salida?: 'SI' | 'NO'
  material_medico?: string
  indicaciones_generales?: string
  receta_lineas: RecetaLinea[]
  medico_nombre: string
  medico_cedula: string
  antecedentes?: Record<string, unknown>
  /** Resumen narrativo para nota de consulta (6 rubros). */
  antecedentes_consulta?: AntecedentesConsultaResumen
  /** Cargos adicionales registrados en consulta (incluidos en tarifa sugerida de pago). */
  adicionales_consulta?: ConsultaAdicionalesConsulta
  modulo1?: Record<string, string>
  cerrada_at?: string
}

export function emptySignosVitalesConsulta(): SignosVitalesConsulta {
  return {
    ta_sistolica: '',
    ta_diastolica: '',
    fc_min: '',
    fr_min: '',
    temperatura: '',
    peso_kg: '',
    talla_m: '',
    imc: '',
    complexion: '',
  }
}

export function buildDefaultExploracionPlantilla(): string {
  return [
    'PACIENTE CONSCIENTE, ORIENTADO EN TIEMPO, LUGAR Y PERSONA, ALERTA, COOPERADOR, ADECUADA COLORACIÓN MUCOTEGUMENTARIA.',
    'CAMPOS PULMONARES CON ADECUADA ENTRADA Y SALIDA DE AIRE; RUIDOS CARDÍACOS RÍTMICOS, SIN SOPLOS; ABDOMEN BLANDO, DEPRESIBLE.',
  ].join(' ')
}
