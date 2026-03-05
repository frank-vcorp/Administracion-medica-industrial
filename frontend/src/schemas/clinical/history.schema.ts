import { z } from 'zod';

const SiNegado = z.enum(['NEGADO', 'SI']).default('NEGADO');


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
// ESQUEMA MAESTRO CLINICAL HISTORY (Persistente)
// ----------------------------------------------------------------------
export const ClinicalHistoryDataSchema = z.object({
  heredo_familiares: HeredoFamiliaresSchema.optional(),
  no_patologicos: NoPatologicosSchema.optional(),
  patologicos: PatologicosSchema.optional()
});

export type ClinicalHistoryData = z.infer<typeof ClinicalHistoryDataSchema>;