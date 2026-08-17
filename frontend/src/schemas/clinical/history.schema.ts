import { z } from 'zod';

const SiNegado = z.enum(['NEGADO', 'SI']).default('NEGADO');
const cleanStr  = z.string().trim().max(500).optional();

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
// FIX L2 (QA-20260817-01-C2 observación): campo `otras` se separa en dos
// state keys independientes — `otras` (catálogo ZIN: NEGADOS/PADRE/.../OTROS)
// y `otras_especifique` (texto libre condicional cuando `otras === 'OTROS'`).
// Antes el input "Especifique" compartía state con el select, causando que al
// primer carácter tipeado el input se auto-destruyera (`otras` cambiaba de
// 'OTROS' al texto tipeado, perdiendo la condición que lo mostraba).
// DA-1 (tolerancia legacy): campo nuevo con default '', registros legacy sin
// este campo parsean sin error.
// ----------------------------------------------------------------------
export const HeredoFamiliaresSchema = z.object({
  diabetes: z.string().trim().max(500).optional(),     // ej: "AB MA", "PADRE", etc.
  has: z.string().trim().max(500).optional(),          // Hipertensión
  epilepsia: z.string().trim().max(500).optional(),
  cardiopatia: z.string().trim().max(500).optional(),
  renales: z.string().trim().max(500).optional(),
  asma: z.string().trim().max(500).optional(),
  cancer: z.string().trim().max(500).optional(),
  mentales: z.string().trim().max(500).optional(),
  otras: z.string().trim().max(1000).optional(),       // Catálogo ZIN (HEREDOFAMILIARES_VALUES)
  otras_especifique: z.string().trim().max(250).default('')  // Texto libre condicional (FIX L2)
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
  grupo_y_rh: z.string().default('DESCONOCE'),

  tatuajes: SiNegado,
  tatuajes_especifique: z.string().trim().max(500).optional(),
});

// ----------------------------------------------------------------------
// 5. ANTECEDENTES PERSONALES PATOLÓGICOS (Imagen 3)
// ----------------------------------------------------------------------
// Todo prellenado en NEGADO por la regla: "Prellenado en negado"
export const PatologicosSchema = z.object({
  diabetes: SiNegado,
  hernias: SiNegado,
  epilepsia: SiNegado,
  alergias: SiNegado,
  cardiopatias: SiNegado,
  bronquitis: SiNegado,
  ginecologicos: SiNegado,
  varices: SiNegado,
  tuberculosis: SiNegado,
  endocrinopatias: SiNegado,
  colitis: SiNegado,
  
  tifoidea: SiNegado,
  has: SiNegado, // Hipertensión
  hemorroides: SiNegado,
  vertigo: SiNegado,
  parotiditis: SiNegado,
  dermatitis: SiNegado,
  pat_c_vertebral: SiNegado, // Patología Columna Vertebral
  cirugias: SiNegado,
  hepatitis: SiNegado,
  exantematicas: SiNegado,
  gastritis: SiNegado,
  
  renales: SiNegado,
  asma: SiNegado,
  cancer: SiNegado,
  traumatismos_craneales: SiNegado,
  desmayos: SiNegado,
  fracturas: SiNegado,
  neumonias: SiNegado,
  enf_trans_sexual: SiNegado,
  transfusiones: SiNegado,
  psiquiatricas: SiNegado,
  migrana: SiNegado,

  otras: z.string().trim().max(1000).optional(),
  especifique: z.string().trim().max(1000).optional()
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