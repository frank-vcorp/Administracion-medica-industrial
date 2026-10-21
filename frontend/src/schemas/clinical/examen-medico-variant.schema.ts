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

const sodexoMatrizNivel = z.enum(['1', '2', '3', '4', '5', 'A'])
const sodexoMatrizColumn = sodexoMatrizNivel
const sodexoMatrizFactorValue = z.union([
  sodexoMatrizNivel,
  z.array(sodexoMatrizColumn),
])

const sodexoFuncionesSchema = z
  .object({
    administrativa: z.boolean().optional(),
    ayudante: z.boolean().optional(),
    mantenimiento: z.boolean().optional(),
    tecnica: z.boolean().optional(),
    telefono: z.boolean().optional(),
    conduccion: z.boolean().optional(),
    otro: z.boolean().optional(),
  })
  .optional()
  .nullable()

const sodexoNiegaSi = z.enum(['NEGADO', 'SI']).optional().nullable()

const sodexoHoFilaSchema = z.object({
  empresa_area: cleanString,
  empresa: cleanString,
  ocupacion: cleanString,
  anios: cleanString,
  meses: cleanString,
  tiempo: cleanString,
  examen_ingreso: z.boolean().optional().nullable(),
  examen_periodico: z.boolean().optional().nullable(),
  examen_retiro: z.boolean().optional().nullable(),
  examen_no: z.boolean().optional().nullable(),
  rt: sodexoNiegaSi,
  secuelas: sodexoNiegaSi,
  indemnizado: sodexoNiegaSi,
  indemnizado_fecha: cleanString,
  es_actual: z.boolean().optional().nullable(),
  /** Legacy — ya no va al PDF; usar matriz de factores. */
  agentes_riesgo: cleanString,
})

const sodexoExamenEncabezadoSchema = z
  .object({
    estado_general_normal: z.boolean().optional(),
    estado_mental_normal: z.boolean().optional(),
    mano_dominante: z.enum(['DIESTRA', 'ZURDA', 'AMBIDIESTRA']).optional().nullable(),
  })
  .optional()
  .nullable()

const sodexoInmunFilaSchema = z.object({
  estado: sodexoNiegaSi,
  fecha: cleanString,
  imss: cleanString,
  ssa: cleanString,
  observaciones: cleanString,
})

const sodexoHeredofamiliarFilaSchema = z.object({
  respuesta: z.enum(['NO', 'SI']).optional().nullable(),
  parentesco: cleanString,
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
  /** Matriz REG-SO-01: factor → columnas 1–5 (empleos) y/o A (actual); varias por factor. */
  matriz_factores: z.record(z.string(), sodexoMatrizFactorValue).optional().nullable(),
  /** Describir accidente, lesiones y/o secuelas (pie §3). */
  historia_ocupacional_accidentes: cleanString,
  /** §4 HEREDOFAMILIAR — rejilla exacta REG-SO-01 (No / Sí + parentesco). */
  heredofamiliar_sodexo: z
    .record(z.string(), sodexoHeredofamiliarFilaSchema)
    .optional()
    .nullable(),
  lugar_nacimiento: cleanString,
  telefono_casa: cleanString,
  telefono_movil: cleanString,
  numero_exterior: cleanString,
  numero_interior: cleanString,
  estado_domicilio: cleanString,
  tiempo_radicar: cleanString,
  profesion: cleanString,
  lee_y_escribe: z.enum(['SI', 'NO']).optional().nullable(),
  funciones_principales: sodexoFuncionesSchema,
  /** Hasta 5 empleos históricos + fila Actual (`es_actual`). */
  historia_ocupacional_filas: z.array(sodexoHoFilaSchema).max(6).optional().nullable(),
  examen_encabezado: sodexoExamenEncabezadoSchema,
  epp_uso: z.enum(['SI', 'NO', 'OCASIONAL']).optional().nullable(),
  epp_casco: z.boolean().optional().nullable(),
  epp_mascarilla: z.boolean().optional().nullable(),
  epp_lentes: z.boolean().optional().nullable(),
  epp_botas: z.boolean().optional().nullable(),
  epp_guantes: z.boolean().optional().nullable(),
  epp_faja: z.boolean().optional().nullable(),
  declaracion_protesta_nombre: cleanString,
  /**
   * Solo impresión REG-SO-01: aclaración §5 si hace falta texto extra en el PDF.
   * No sustituye Antecedentes patológicos de la papeleta (se proyectan al PDF aparte).
   */
  aclaracion_historia_personal: cleanString,
  consentimiento_ho: z
    .object({
      informacion_verdadera: z.boolean().optional(),
      acepta_aviso_privacidad: z.boolean().optional(),
    })
    .optional()
    .nullable(),
  visiometria_casillas: z
    .object({
      lejana_od_sin_correccion: z.boolean().optional(),
      lejana_oi_sin_correccion: z.boolean().optional(),
      lejana_od_con_correccion: z.boolean().optional(),
      lejana_oi_con_correccion: z.boolean().optional(),
      cercana_od_sin_correccion: z.boolean().optional(),
      cercana_oi_sin_correccion: z.boolean().optional(),
    })
    .optional()
    .nullable(),
  inmunizaciones_complementarias: z
    .object({
      niega: z.boolean().optional(),
      covid: sodexoInmunFilaSchema.optional(),
      hepatitis_ab: sodexoInmunFilaSchema.optional(),
      otras: sodexoInmunFilaSchema.optional(),
    })
    .optional()
    .nullable(),
  examen_anormal_cual: z
    .object({
      cual_1: cleanString,
      cual_2: cleanString,
      cual_3: cleanString,
      cual_4: cleanString,
    })
    .optional()
    .nullable(),
  gineco_sodexo: z
    .object({
      dismenorrea: sodexoNiegaSi,
      dismenorrea_incapacitante: z.boolean().optional(),
      toxicos_medicamentos: z.record(z.string(), sodexoNiegaSi).optional().nullable(),
    })
    .optional()
    .nullable(),
  /** §5 PERSONAL PATOLÓGICO — claves de `sodexo-patologicos-catalog`. */
  patologicos_sodexo: z
    .record(
      z.string(),
      z.object({
        estado: sodexoNiegaSi,
        descripcion: cleanString,
      }),
    )
    .optional()
    .nullable(),
  estilos_vida_sodexo: z
    .object({
      tabaco_intensidad: z
        .enum(['EVENTUAL', 'HABITUAL', 'COMPULSIVO', 'EXFUMADOR'])
        .optional()
        .nullable(),
      tabaco_anios: z.enum(['1_5', '6_10', '11_20', 'MAS_20']).optional().nullable(),
      alcohol_modo: z.enum(['OCASIONAL', 'FRECUENTE']).optional().nullable(),
    })
    .optional()
    .nullable(),
  /** Encabezado §10–12 (opcional). */
  titulo_seccion_sodexo: cleanString,
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
    matriz_factores: null,
    lugar_nacimiento: '',
    telefono_casa: '',
    telefono_movil: '',
    numero_exterior: '',
    numero_interior: '',
    estado_domicilio: '',
    tiempo_radicar: '',
    profesion: '',
    lee_y_escribe: null,
    funciones_principales: null,
    historia_ocupacional_filas: null,
    historia_ocupacional_accidentes: '',
    heredofamiliar_sodexo: null,
    examen_encabezado: null,
    epp_uso: null,
    epp_casco: false,
    epp_mascarilla: false,
    epp_lentes: false,
    epp_botas: false,
    epp_guantes: false,
    epp_faja: false,
    declaracion_protesta_nombre: '',
    aclaracion_historia_personal: '',
    consentimiento_ho: null,
    visiometria_casillas: null,
    inmunizaciones_complementarias: null,
    examen_anormal_cual: null,
    gineco_sodexo: null,
    patologicos_sodexo: null,
    estilos_vida_sodexo: null,
    titulo_seccion_sodexo: '',
  }
}
