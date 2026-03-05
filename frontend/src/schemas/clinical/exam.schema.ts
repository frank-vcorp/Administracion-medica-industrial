import { z } from 'zod';

// ----------------------------------------------------------------------
// 6. ANTECEDENTES REPRODUCTIVOS e INMUNIZACIONES (Imágenes 4 y 5)
// ----------------------------------------------------------------------
export const ReproductivosInmunizacionesSchema = z.object({
  ivs: z.string().optional(),
  vsa: z.string().optional(),
  mpf: z.string().optional(),
  doc_prostata: z.string().optional(),
  
  // Inmunizaciones
  rubeola: z.string().optional(),
  neumococo: z.string().optional(),
  sarampion: z.string().optional(),
  influenza: z.string().optional(),
  toxoide_tetanico: z.string().optional(),
  hepatitis_b: z.string().optional(),
  otra_inmunizacion: z.string().optional(),
  proxima_dosis: z.string().optional()
});

// ----------------------------------------------------------------------
// 7. SOMATOMETRÍA / SIGNOS VITALES (Imagen 6) - ¡Autocalculable!
// IMPL-20260305-01: Refactorización Defensiva - validación clínica
// ----------------------------------------------------------------------
export const SomatometriaVitalesSchema = z.object({
  ta_sistolica: z.coerce.number().nonnegative().max(300).optional(),      // Rango clínico: 0-300 mmHg
  ta_diastolica: z.coerce.number().nonnegative().max(200).optional(),     // Rango clínico: 0-200 mmHg
  // ta_texto: ELIMINADO para evitar inconsistencias (derivar si es necesario)
  
  fc_min: z.coerce.number().int().nonnegative().max(300).optional(),      // Frecuencia Cardiaca: 0-300 bpm
  peso_kg: z.coerce.number().positive().max(300).optional(),              // Peso > 0, máx 300 kg
  perimetro_cintura: z.coerce.number().positive().max(500).optional(),    // > 0 cm
  
  talla_m: z.coerce.number().positive().max(3).optional(),                // Talla > 0 y máx 3m
  perimetro_cadera: z.coerce.number().positive().max(500).optional(),     // > 0 cm
  
  fr_min: z.coerce.number().int().nonnegative().max(100).optional(),      // FR: 0-100 resp/min
  // imc: MARCADO como derivado (no editable por usuario)
  imc: z.number().nonnegative().max(100).optional(),                      // Solo lectura: derivado de peso/talla
  indice_cadera: z.number().nonnegative().max(2).optional(),              // Índice cintura/cadera: 0-2
  
  temperatura: z.coerce.number().gt(30).lt(45).optional(),                // Temperatura: 30-45°C
  complexion: z.enum(['BAJO PESO', 'NORMAL', 'SOBREPESO', 'OBESIDAD', 'OBESIDAD SEVERA']).optional()\n});

// ----------------------------------------------------------------------
// 8. AGUDEZA VISUAL (Imagen 7)
// IMPL-20260305-01: Refactorización Defensiva - enum explícito
// ----------------------------------------------------------------------
export const AgudezaVisualSchema = z.object({
  vision_lejana_od: z.enum(['NO APLICA', 'NORMAL', 'ANORMAL', 'CORREGIDA']).default('NO APLICA'),
  vision_lejana_oi: z.enum(['NO APLICA', 'NORMAL', 'ANORMAL', 'CORREGIDA']).default('NO APLICA'),
  vision_cercana_od: z.enum(['NO APLICA', 'NORMAL', 'ANORMAL', 'CORREGIDA']).default('NO APLICA'),
  vision_cercana_oi: z.enum(['NO APLICA', 'NORMAL', 'ANORMAL', 'CORREGIDA']).default('NO APLICA'),
  lejana_corregida_od: z.enum(['NO APLICA', 'NORMAL', 'ANORMAL']).default('NO APLICA'),
  lejana_corregida_oi: z.enum(['NO APLICA', 'NORMAL', 'ANORMAL']).default('NO APLICA'),
  cercana_corregida_od: z.enum(['NO APLICA', 'NORMAL', 'ANORMAL']).default('NO APLICA'),
  cercana_corregida_oi: z.enum(['NO APLICA', 'NORMAL', 'ANORMAL']).default('NO APLICA'),
  
  reflejos: z.string().trim().max(500).default('PRESENTES Y NORMOREFLECTICOS'),
  test_ishihara: z.string().trim().max(500).optional(),
  campimetria: z.string().trim().max(500).optional()
});

// ----------------------------------------------------------------------
// 9. EXPLORACIÓN FÍSICA GENERAL (Imagen 8)
// IMPL-20260305-01: Refactorización Defensiva - validación de longitud
// ----------------------------------------------------------------------
export const ExploracionFisicaSchema = z.object({
  neurologico: z.string().trim().max(1000).optional(),
  cabeza: z.string().trim().max(1000).optional(),
  piel_y_faneras: z.string().trim().max(1000).optional(),
  
  oidos_cad: z.string().trim().max(500).optional(),
  oidos_cai: z.string().trim().max(500).optional(),
  ojos: z.string().trim().max(500).optional(),
  boca_estado: z.string().trim().max(500).optional(), // SIN DATOS DE CARIES...
  boca_alineacion: z.string().trim().max(500).optional(), // CENTRADA...
  nariz: z.string().trim().max(500).optional(),
  faringe: z.string().trim().max(500).optional(),
  cuello: z.string().trim().max(500).optional(),
  torax: z.string().trim().max(500).optional(),
  corazon: z.string().trim().max(500).optional(),
  campos_pulmonares: z.string().trim().max(500).optional(),
  abdomen: z.string().trim().max(500).optional(),
  genitourinario: z.string().trim().max(500).optional(),
  
  columna_vertebral: z.string().trim().max(500).optional(),
  test_adam: z.string().trim().max(500).optional(),
  ms_superiores: z.string().trim().max(500).optional(),
  fuerza_muscular_daniels_sup: z.string().trim().max(500).optional(),
  ms_inferiores: z.string().trim().max(500).optional(),
  fuerza_muscular_daniels_inf: z.string().trim().max(500).optional(),
  circulacion_venosa: z.string().trim().max(500).optional(),
  
  arco_de_movilidad: z.string().trim().max(500).optional(),
  tono_muscular: z.string().trim().max(500).optional(),
  coordinacion: z.string().trim().max(500).optional(),
  test_romberg: z.string().trim().max(500).optional(),
  signo_bragard: z.string().trim().max(500).optional(),
  
  prueba_finkelstein: z.string().trim().max(500).optional(),
  signo_tinel: z.string().trim().max(500).optional(),
  prueba_phanel: z.string().trim().max(500).optional(),
  prueba_lasegue: z.string().trim().max(500).optional(),
  
  presencia_quiste_sinovial: z.string().trim().max(200).optional(),
  especificar_quiste: z.string().trim().max(500).optional()
});

// ----------------------------------------------------------------------
// 10. IMPRESIÓN DIAGNÓSTICA (Imagen 9) - Autocalculado por Backend/Frontend
// IMPL-20260305-01: Refactorización Defensiva
// ----------------------------------------------------------------------
export const ImpresionDiagnosticaSchema = z.object({
  estado_nutricional: z.string().trim().max(200).optional(),  // Calculado del IMC
  salud_bucal: z.string().trim().max(200).optional(),         // Heredado de exploración
  agudeza_visual: z.string().trim().max(200).optional(),      // Normal / Anormal
  presion_arterial: z.string().trim().max(200).optional(),    // Calculado de TA
  conclusiones: z.string().trim().max(2000).optional()        // Ej: "SIN OTROS DATOS PATOLOGICOS..."
});

// ============================================================================
// ESQUEMA MAESTRO PARA EXAMEN MÉDICO (MedicalExamDataSchema)
// ============================================================================
export const MedicalExamDataSchema = z.object({
  reproductivos_inmunizaciones: ReproductivosInmunizacionesSchema.optional(),
  somatometria_vitales: SomatometriaVitalesSchema.optional(),
  agudeza_visual: AgudezaVisualSchema.optional(),
  exploracion_fisica: ExploracionFisicaSchema.optional(),
  impresion_diagnostica: ImpresionDiagnosticaSchema.optional()
});

export type MedicalExamData = z.infer<typeof MedicalExamDataSchema>;..."
});