import { z } from 'zod';
import { tolerantZinEnum } from './zin.helper';

const SiNegado = z.enum(['NEGADO', 'SI', 'NO APLICA']).default('NEGADO');
const cleanStr  = z.string().trim().max(500).optional();

// ----------------------------------------------------------------------
// IMPL-20260817-04 (junta AMI 10/ago, línea 285 — Erika): acordeón Sí/Negado/
// No Aplica + 3 campos condicionales (desde_cuando / tratamiento /
// observaciones) para cada enfermedad del PatologicosSchema.
// DA-1 (tolerancia legacy): registros persistidos como `{ diabetes: 'SI' }`
// siguen parseando OK gracias al union+transform que normaliza el string
// a la nueva forma `{ estado, detalle }`.
// ----------------------------------------------------------------------
export const DetalleTripleSchema = z.object({
  desde_cuando:  z.string().trim().max(200).optional().default(''),
  tratamiento:   z.string().trim().max(500).optional().default(''),
  observaciones: z.string().trim().max(1500).optional().default(''),
})
export type DetalleTriple = z.infer<typeof DetalleTripleSchema>

/**
 * Una enfermedad patológica con estado Sí/Negado/No Aplica + detalle
 * condicional. Acepta el formato legacy (string suelto) Y el nuevo
 * (objeto {estado, detalle}); el union+transform normaliza ambos al
 * shape canónico.
 *
 * Default = `{ estado: 'NEGADO', detalle: undefined }` (regla de negocio
 * "Prellenado en negado" del PatologicosSchema — IMPL-20260817-04).
 * Los campos sin enviar (al persistir parcialmente o rehidratar legacy)
 * caen al default en lugar de fallar la validación.
 */
export const PatologiaConDetalleSchema = z
  .union([
    z.string(),
    z.object({
      estado:  SiNegado,
      detalle: DetalleTripleSchema.optional(),
    }),
  ])
  .transform((v) =>
    typeof v === 'string'
      ? { estado: v as 'NEGADO' | 'SI' | 'NO APLICA', detalle: undefined }
      : v
  )
  .default({ estado: 'NEGADO', detalle: undefined })
export type PatologiaConDetalle = z.infer<typeof PatologiaConDetalleSchema>

// ----------------------------------------------------------------------
// IMPL-20260817-03 (ARCH-20260817-01 extensión puntual): catálogo ZIN para
// `grupo_y_rh` (Antecedentes Personales No Patológicos — Imagen 2).
// Migración input libre → <select> con 9 opciones canónicas. DA-1
// (tolerancia legacy): el schema sigue aceptando cualquier string no-vacío
// heredado de BD sin error.
// ----------------------------------------------------------------------
export const GRUPO_RH_VALUES = [
  'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'DESCONOCE',
] as const

export type GrupoYRhValue = (typeof GRUPO_RH_VALUES)[number]

// ─────────────────────────────────────────────────────────────────────────────
// 1. DATOS PERSONALES DECLARATIVOS (Módulo 1 / Portal / Historial)
// Movido desde prefilled.schema.ts — ARCH-20260326-06
// ─────────────────────────────────────────────────────────────────────────────
export const DatosPersonalesModulo1Schema = z.object({
  puesto_actual:      cleanStr,
  area_departamento:  cleanStr,
  turno:              z.enum(['MATUTINO', 'VESPERTINO', 'NOCTURNO', 'MIXTO']).optional(),
  antiguedad_anios:   z.coerce.number().nonnegative().max(60).optional(),
  antiguedad_meses:   z.coerce.number().nonnegative().max(11).optional(),
  estado_civil:       z.enum(['SOLTERO', 'CASADO', 'UNION_LIBRE', 'DIVORCIADO', 'VIUDO', 'OTRO']).optional(),
  escolaridad:        cleanStr,
  numero_hijos:       z.coerce.number().nonnegative().max(30).optional(),
});

export type DatosPersonalesModulo1 = z.infer<typeof DatosPersonalesModulo1Schema>;

// ─────────────────────────────────────────────────────────────────────────────
// 2. HISTORIA LABORAL (Módulo 1 / Portal / Historial)
// Movido desde prefilled.schema.ts — ARCH-20260326-06
// ─────────────────────────────────────────────────────────────────────────────
export const HistoriaLaboralSchema = z.object({
  empresa_anterior_1:                cleanStr,
  puesto_anterior_1:                 cleanStr,
  tiempo_anterior_1:                 cleanStr,
  empresa_anterior_2:                cleanStr,
  puesto_anterior_2:                 cleanStr,
  tiempo_anterior_2:                 cleanStr,
  exposicion_quimica:                z.boolean().optional(),
  exposicion_quimica_especifique:    cleanStr,
  exposicion_fisica:                 z.boolean().optional(),
  exposicion_fisica_especifique:     cleanStr,
  exposicion_biologica:              z.boolean().optional(),
  exposicion_biologica_especifique:  cleanStr,
  exposicion_ergonomica:             z.boolean().optional(),
  exposicion_ergonomica_especifique: cleanStr,
  accidentes_trabajo:                z.boolean().optional(),
  accidentes_descripcion:            cleanStr,
  enfermedades_trabajo:              z.boolean().optional(),
  enfermedades_descripcion:          cleanStr,
});

export type HistoriaLaboral = z.infer<typeof HistoriaLaboralSchema>;

// ----------------------------------------------------------------------
// 3. ANTECEDENTES HEREDO-FAMILIARES (Imagen 1)
// @id IMPL-20260817-02
// FIX L2 (QA-20260817-01-C2): cada campo catálogo ZIN usa `{field}_especifique`
// independiente cuando el select = OTROS (antes sólo `otras` lo tenía).
// ----------------------------------------------------------------------
const heredoEspecifiqueOptional = z.string().trim().max(250).optional()

export const HeredoFamiliaresSchema = z.object({
  diabetes: z.string().trim().max(500).optional(),     // ej: "AB MA", "PADRE", etc.
  diabetes_especifique: heredoEspecifiqueOptional,
  has: z.string().trim().max(500).optional(),          // Hipertensión
  has_especifique: heredoEspecifiqueOptional,
  epilepsia: z.string().trim().max(500).optional(),
  epilepsia_especifique: heredoEspecifiqueOptional,
  cardiopatia: z.string().trim().max(500).optional(),
  cardiopatia_especifique: heredoEspecifiqueOptional,
  renales: z.string().trim().max(500).optional(),
  renales_especifique: heredoEspecifiqueOptional,
  asma: z.string().trim().max(500).optional(),
  asma_especifique: heredoEspecifiqueOptional,
  cancer: z.string().trim().max(500).optional(),
  cancer_especifique: heredoEspecifiqueOptional,
  mentales: z.string().trim().max(500).optional(),
  otras: z.string().trim().max(1000).optional(),       // Catálogo ZIN (HEREDOFAMILIARES_VALUES)
  otras_especifique: z.string().trim().max(250).default(''),  // Texto libre condicional (FIX L2)
});

// ----------------------------------------------------------------------
// 4. ANTECEDENTES PERSONALES NO PATOLÓGICOS Y TOXICOMANÍAS (Imagen 2)
// ----------------------------------------------------------------------
export const NoPatologicosSchema = z.object({
  alcohol: SiNegado,
  alcohol_edad_comienzo: z.coerce.number().int().nonnegative().max(120).optional(),
  alcohol_frecuencia: z.string().trim().max(200).optional(), // ej: "SEMANAL"
  alcohol_suspendido: z.enum(['NEGADO', 'SI']).optional(), // STANDARDIZADO a NEGADO/SI
  alcohol_tiempo_suspendido: z.string().trim().max(200).optional(),

  tabaco: SiNegado,
  tabaco_edad_comienzo: z.coerce.number().int().nonnegative().max(120).optional(),
  tabaco_frecuencia: z.string().trim().max(200).optional(), // ej: "QUINCENAL"
  tabaco_suspendido: z.enum(['NEGADO', 'SI']).optional(), // STANDARDIZADO a NEGADO/SI
  tabaco_tiempo_suspendido: z.string().trim().max(200).optional(),
  tabaco_cigarros_dia: z.coerce.number().int().nonnegative().max(200).optional(),

  drogas_estimulantes: SiNegado,
  drogas_especifique: z.string().trim().max(500).optional(),
  drogas_frecuencia: z.string().trim().max(200).optional(),
  drogas_ultimo_consumo: z.string().trim().max(200).optional(),

  ejercicio: SiNegado,
  ejercicio_especifique: z.string().trim().max(500).optional(),
  ejercicio_frecuencia: z.string().trim().max(200).optional(),

  alimentacion: z.enum(['BUENA', 'REGULAR', 'MALA']).default('BUENA'),

  tratamiento_medico_actual: SiNegado,
  tratamiento_medico_actual_especifique: z.string().trim().max(500).optional(),

  // IMPL-20260817-03: ZIN combo con 9 valores canónicos (select en UI).
  // DA-1: `tolerantZinEnum` sigue aceptando strings legacy no-vacíos.
  grupo_y_rh: tolerantZinEnum(GRUPO_RH_VALUES).default('DESCONOCE'),

  tatuajes: SiNegado,
  tatuajes_especifique: z.string().trim().max(500).optional(),
});

// ----------------------------------------------------------------------
// 5. ANTECEDENTES PERSONALES PATOLÓGICOS (Imagen 3)
// IMPL-20260817-04: acordeón Sí/Negado/No Aplica + 3 campos condicionales
// (desde_cuando / tratamiento / observaciones). DA-1: el union+transform
// de `PatologiaConDetalleSchema` acepta el formato legacy `{ diabetes: 'SI' }`
// que actualmente está persistido en `physicalExamData`.
// El campo legacy top-level `especifique` se elimina: su contenido se captura
// ahora en `otras.detalle.observaciones`.
// ----------------------------------------------------------------------
// Todo prellenado en NEGADO por la regla: "Prellenado en negado"
export const PatologicosSchema = z.object({
  diabetes:              PatologiaConDetalleSchema,
  hernias:               PatologiaConDetalleSchema,
  epilepsia:             PatologiaConDetalleSchema,
  alergias:              PatologiaConDetalleSchema,
  cardiopatias:          PatologiaConDetalleSchema,
  bronquitis:            PatologiaConDetalleSchema,
  ginecologicos:         PatologiaConDetalleSchema,
  varices:               PatologiaConDetalleSchema,
  tuberculosis:          PatologiaConDetalleSchema,
  endocrinopatias:       PatologiaConDetalleSchema,
  colitis:               PatologiaConDetalleSchema,

  tifoidea:              PatologiaConDetalleSchema,
  has:                   PatologiaConDetalleSchema, // Hipertensión
  hemorroides:           PatologiaConDetalleSchema,
  vertigo:               PatologiaConDetalleSchema,
  parotiditis:           PatologiaConDetalleSchema,
  dermatitis:            PatologiaConDetalleSchema,
  pat_c_vertebral:       PatologiaConDetalleSchema, // Patología Columna Vertebral
  cirugias:              PatologiaConDetalleSchema,
  hepatitis:             PatologiaConDetalleSchema,
  exantematicas:         PatologiaConDetalleSchema,
  gastritis:             PatologiaConDetalleSchema,

  renales:               PatologiaConDetalleSchema,
  asma:                  PatologiaConDetalleSchema,
  cancer:                PatologiaConDetalleSchema,
  traumatismos_craneales:PatologiaConDetalleSchema,
  desmayos:              PatologiaConDetalleSchema,
  fracturas:             PatologiaConDetalleSchema,
  neumonias:             PatologiaConDetalleSchema,
  enf_trans_sexual:      PatologiaConDetalleSchema,
  transfusiones:         PatologiaConDetalleSchema,
  psiquiatricas:         PatologiaConDetalleSchema,
  migrana:               PatologiaConDetalleSchema,

  otras:                 PatologiaConDetalleSchema,
});

// ----------------------------------------------------------------------
// ESQUEMA MAESTRO CLINICAL HISTORY (Persistente) — ARCH-20260326-06
// Campos longitudinales maestros en raíz: datos_personales, historia_laboral,
// heredo_familiares, no_patologicos, patologicos.
// ----------------------------------------------------------------------
export const ClinicalHistoryDataSchema = z.object({
  datos_personales:  DatosPersonalesModulo1Schema.optional(),
  historia_laboral:  HistoriaLaboralSchema.optional(),
  heredo_familiares: HeredoFamiliaresSchema.optional(),
  no_patologicos:    NoPatologicosSchema.optional(),
  patologicos:       PatologicosSchema.optional(),
});

export type ClinicalHistoryData = z.infer<typeof ClinicalHistoryDataSchema>;