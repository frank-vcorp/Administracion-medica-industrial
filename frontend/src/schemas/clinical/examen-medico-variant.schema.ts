import { z } from 'zod'

const cleanString = z.string().trim().optional().nullable()

export const INTERROGATORIO_SISTEMAS = [
  'cardiovascular',
  'digestivo',
  'respiratorio',
  'musculoesqueletico',
  'genitourinario',
  'linfohematico',
  'endocrino',
  'neurosensorial',
  'piel_faneras',
] as const

/** Regiones del Cuestionario Nórdico Kuorinka (integrado en Flowserve). */
export const NORDICO_REGIONES = [
  'cuello',
  'hombros',
  'codos',
  'munecas_manos',
  'espalda_alta',
  'espalda_baja',
  'caderas_muslos',
  'rodillas',
  'tobillos_pies',
] as const

export const NORDICO_REGION_LABELS: Record<(typeof NORDICO_REGIONES)[number], string> = {
  cuello: 'Cuello',
  hombros: 'Hombros',
  codos: 'Codos',
  munecas_manos: 'Muñecas / manos',
  espalda_alta: 'Espalda alta',
  espalda_baja: 'Espalda baja',
  caderas_muslos: 'Caderas / muslos',
  rodillas: 'Rodillas',
  tobillos_pies: 'Tobillos / pies',
}

const siNoSchema = z.enum(['SI', 'NO']).optional().nullable()

const interrogatorioRowSchema = z.object({
  estado: z.enum(['SIN_SINTOMAS', 'CON_SINTOMAS']).optional().nullable(),
  especifique: cleanString,
})

const nordicoRegionSchema = z.object({
  /** Molestias en los últimos 12 meses */
  sintomas_12m: siNoSchema,
  /** Impidió trabajo habitual en los últimos 12 meses */
  impidio_trabajo_12m: siNoSchema,
  /** Molestias en los últimos 7 días */
  sintomas_7d: siNoSchema,
})

export const FlowserveExtensionSchema = z.object({
  area: cleanString,
  alergias: cleanString,
  religion: cleanString,
  contacto_emergencia: cleanString,
  celular_emergencia: cleanString,
  higiene_bano: cleanString,
  higiene_aseo_bucal: cleanString,
  higiene_cambio_ropa: cleanString,
  alimentacion_nivel: z
    .enum(['OPTIMO', 'BUENO', 'REGULAR', 'MALO', 'MUY_MALO'])
    .optional()
    .nullable(),
  actividad_fisica_frecuencia: cleanString,
  actividad_fisica_tipo: cleanString,
  sat_o2: cleanString,
  ruffier_fc_inicial: cleanString,
  ruffier_fc_flexiones: cleanString,
  ruffier_fc_minuto: cleanString,
  ruffier_resultado: cleanString,
  nivel_salud: cleanString,
  declaracion_protesta: cleanString,
  interrogatorio: z
    .record(z.enum(INTERROGATORIO_SISTEMAS), interrogatorioRowSchema)
    .optional(),
  /** Cuestionario Nórdico Kuorinka — solo Flowserve, no es estudio aparte */
  cuestionario_nordico: z
    .record(z.enum(NORDICO_REGIONES), nordicoRegionSchema)
    .optional(),
})

export const SodexoExtensionSchema = z.object({
  tipo_examen: z
    .enum(['PREINGRESO', 'PERIODICA', 'RETIRO', 'REINGRESO'])
    .optional()
    .nullable(),
  contacto_emergencia: cleanString,
  telefono_emergencia: cleanString,
  actividades_cargo: cleanString,
  fecha_ingreso_actividades: cleanString,
  antiguedad_actividades: cleanString,
  tipo_actividad: cleanString,
  matriz_riesgos_observaciones: cleanString,
  epp_casco: z.boolean().optional().nullable(),
  epp_mascarilla: z.boolean().optional().nullable(),
  epp_lentes: z.boolean().optional().nullable(),
  epp_botas: z.boolean().optional().nullable(),
  epp_guantes: z.boolean().optional().nullable(),
  epp_faja: z.boolean().optional().nullable(),
  declaracion_protesta_nombre: cleanString,
})

export const VariantExtensionsSchema = z
  .object({
    FLOWSERVE: FlowserveExtensionSchema.optional(),
    SODEXO: SodexoExtensionSchema.optional(),
  })
  .optional()

export type FlowserveExtensionData = z.infer<typeof FlowserveExtensionSchema>
export type SodexoExtensionData = z.infer<typeof SodexoExtensionSchema>
export type NordicoRegionData = z.infer<typeof nordicoRegionSchema>

export function emptyNordicoCuestionario(): NonNullable<FlowserveExtensionData['cuestionario_nordico']> {
  return Object.fromEntries(
    NORDICO_REGIONES.map((r) => [
      r,
      { sintomas_12m: null, impidio_trabajo_12m: null, sintomas_7d: null },
    ]),
  ) as NonNullable<FlowserveExtensionData['cuestionario_nordico']>
}

export function emptyFlowserveExtension(): FlowserveExtensionData {
  const interrogatorio = Object.fromEntries(
    INTERROGATORIO_SISTEMAS.map((s) => [s, { estado: 'SIN_SINTOMAS' as const, especifique: '' }]),
  ) as FlowserveExtensionData['interrogatorio']
  return {
    area: '',
    alergias: '',
    religion: '',
    contacto_emergencia: '',
    celular_emergencia: '',
    higiene_bano: '',
    higiene_aseo_bucal: '',
    higiene_cambio_ropa: '',
    alimentacion_nivel: null,
    actividad_fisica_frecuencia: '',
    actividad_fisica_tipo: '',
    sat_o2: '',
    ruffier_fc_inicial: '',
    ruffier_fc_flexiones: '',
    ruffier_fc_minuto: '',
    ruffier_resultado: '',
    nivel_salud: '',
    declaracion_protesta: '',
    interrogatorio,
    cuestionario_nordico: emptyNordicoCuestionario(),
  }
}

export function emptySodexoExtension(): SodexoExtensionData {
  return {
    tipo_examen: null,
    contacto_emergencia: '',
    telefono_emergencia: '',
    actividades_cargo: '',
    fecha_ingreso_actividades: '',
    antiguedad_actividades: '',
    tipo_actividad: '',
    matriz_riesgos_observaciones: '',
    epp_casco: false,
    epp_mascarilla: false,
    epp_lentes: false,
    epp_botas: false,
    epp_guantes: false,
    epp_faja: false,
    declaracion_protesta_nombre: '',
  }
}
