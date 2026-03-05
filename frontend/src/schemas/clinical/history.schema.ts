import { z } from 'zod';

// ----------------------------------------------------------------------
// 3. ANTECEDENTES HEREDO-FAMILIARES (Imagen 1)
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
  otras: z.string().trim().max(1000).optional()         // Texto libre
});

// ----------------------------------------------------------------------
// 4. ANTECEDENTES PERSONALES NO PATOLÓGICOS Y TOXICOMANÍAS (Imagen 2)
// ----------------------------------------------------------------------
export const NoPatologicosSchema = z.object({
  alcohol: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  alcohol_edad_comienzo: z.coerce.number().int().nonnegative().max(120).optional(),
  alcohol_frecuencia: z.string().trim().max(200).optional(), // ej: "SEMANAL"
  alcohol_suspendido: z.enum(['NEGADO', 'SI']).optional(), // STANDARDIZADO a NEGADO/SI
  alcohol_tiempo_suspendido: z.string().trim().max(200).optional(),

  tabaco: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  tabaco_edad_comienzo: z.coerce.number().int().nonnegative().max(120).optional(),
  tabaco_frecuencia: z.string().trim().max(200).optional(), // ej: "QUINCENAL"
  tabaco_suspendido: z.enum(['NEGADO', 'SI']).optional(), // STANDARDIZADO a NEGADO/SI
  tabaco_tiempo_suspendido: z.string().trim().max(200).optional(),
  tabaco_cigarros_dia: z.coerce.number().int().nonnegative().max(200).optional(),

  drogas_estimulantes: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  drogas_especifique: z.string().trim().max(500).optional(),
  drogas_frecuencia: z.string().trim().max(200).optional(),
  drogas_ultimo_consumo: z.string().trim().max(200).optional(),

  ejercicio: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  ejercicio_especifique: z.string().trim().max(500).optional(),
  ejercicio_frecuencia: z.string().trim().max(200).optional(),

  alimentacion: z.enum(['BUENA', 'REGULAR', 'MALA']).default('BUENA'),
  grupo_y_rh: z.string().default('DESCONOCE'),

  tatuajes: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  tatuajes_especifique: z.string().trim().max(500).optional(),
});

// ----------------------------------------------------------------------
// 5. ANTECEDENTES PERSONALES PATOLÓGICOS (Imagen 3)
// ----------------------------------------------------------------------
// Todo prellenado en NEGADO por la regla: "Prellenado en negado"
export const PatologicosSchema = z.object({
  diabetes: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  hernias: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  epilepsia: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  alergias: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  cardiopatias: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  bronquitis: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  ginecologicos: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  varices: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  tuberculosis: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  endocrinopatias: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  colitis: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  
  tifoidea: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  has: z.enum(['NEGADO', 'SI']).default('NEGADO'), // Hipertensión
  hemorroides: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  vertigo: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  parotiditis: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  dermatitis: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  pat_c_vertebral: z.enum(['NEGADO', 'SI']).default('NEGADO'), // Patología Columna Vertebral
  cirugias: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  hepatitis: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  exantematicas: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  gastritis: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  
  renales: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  asma: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  cancer: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  traumatismos_craneales: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  desmayos: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  fracturas: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  neumonias: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  enf_trans_sexual: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  transfusiones: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  psiquiatricas: z.enum(['NEGADO', 'SI']).default('NEGADO'),
  migrana: z.enum(['NEGADO', 'SI']).default('NEGADO'),

  otras: z.string().optional(),
  especifique: z.string().optional()
});

// ----------------------------------------------------------------------
// ESQUEMA MAESTRO CLINICAL HISTORY (Persistente)
// ----------------------------------------------------------------------
export const ClinicalHistoryDataSchema = z.object({
  heredo_familiares: HeredoFamiliaresSchema.optional(),
  no_patologicos: NoPatologicosSchema.optional(),
  patologicos: PatologicosSchema.optional()
});

export type ClinicalHistoryData = z.infer<typeof ClinicalHistoryDataSchema>;