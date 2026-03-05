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
// ----------------------------------------------------------------------
export const SomatometriaVitalesSchema = z.object({
  ta_sistolica: z.number().optional(),      // Extraída de TA ej: 189
  ta_diastolica: z.number().optional(),     // Extraída de TA ej: 89
  ta_texto: z.string().optional(),          // ej "189/89" (Opcional, mejor campos sep)
  
  fc_min: z.number().optional(),            // Frecuencia Cardiaca
  peso_kg: z.number().optional(),
  perimetro_cintura: z.number().optional(),
  
  talla_m: z.number().optional(),
  perimetro_cadera: z.number().optional(),
  
  fr_min: z.number().optional(),            // Frecuencia Respiratoria
  imc: z.number().optional(),               // Autocalculable (Peso / Talla^2)
  indice_cadera: z.number().optional(),
  
  temperatura: z.number().optional(),
  complexion: z.string().optional()         // ej: "OBESIDAD"
});

// ----------------------------------------------------------------------
// 8. AGUDEZA VISUAL (Imagen 7)
// ----------------------------------------------------------------------
export const AgudezaVisualSchema = z.object({
  vision_lejana_od: z.string().default('NO APLICA'),
  vision_lejana_oi: z.string().default('NO APLICA'),
  vision_cercana_od: z.string().default('NO APLICA'),
  vision_cercana_oi: z.string().default('NO APLICA'),
  lejana_corregida_od: z.string().default('NO APLICA'),
  lejana_corregida_oi: z.string().default('NO APLICA'),
  cercana_corregida_od: z.string().default('NO APLICA'),
  cercana_corregida_oi: z.string().default('NO APLICA'),
  
  reflejos: z.string().default('PRESENTES Y NORMOREFLECTICOS'),
  test_ishihara: z.string().optional(),
  campimetria: z.string().optional()
});

// ----------------------------------------------------------------------
// 9. EXPLORACIÓN FÍSICA GENERAL (Imagen 8)
// ----------------------------------------------------------------------
export const ExploracionFisicaSchema = z.object({
  neurologico: z.string().optional(),
  cabeza: z.string().optional(),
  piel_y_faneras: z.string().optional(),
  
  oidos_cad: z.string().optional(),
  oidos_cai: z.string().optional(),
  ojos: z.string().optional(),
  boca_estado: z.string().optional(), // SIN DATOS DE CARIES...
  boca_alineacion: z.string().optional(), // CENTRADA...
  nariz: z.string().optional(),
  faringe: z.string().optional(),
  cuello: z.string().optional(),
  torax: z.string().optional(),
  corazon: z.string().optional(),
  campos_pulmonares: z.string().optional(),
  abdomen: z.string().optional(),
  genitourinario: z.string().optional(),
  
  columna_vertebral: z.string().optional(),
  test_adam: z.string().optional(),
  ms_superiores: z.string().optional(),
  fuerza_muscular_daniels_sup: z.string().optional(),
  ms_inferiores: z.string().optional(),
  fuerza_muscular_daniels_inf: z.string().optional(),
  circulacion_venosa: z.string().optional(),
  
  arco_de_movilidad: z.string().optional(),
  tono_muscular: z.string().optional(),
  coordinacion: z.string().optional(),
  test_romberg: z.string().optional(),
  signo_bragard: z.string().optional(),
  
  prueba_finkelstein: z.string().optional(),
  signo_tinel: z.string().optional(),
  prueba_phanel: z.string().optional(),
  prueba_lasegue: z.string().optional(),
  
  presencia_quiste_sinovial: z.string().optional(),
  especificar_quiste: z.string().optional()
});

// ----------------------------------------------------------------------
// 10. IMPRESIÓN DIAGNÓSTICA (Imagen 9) - Autocalculado por Backend/Frontend
// ----------------------------------------------------------------------
export const ImpresionDiagnosticaSchema = z.object({
  estado_nutricional: z.string().optional(),  // Calculado del IMC
  salud_bucal: z.string().optional(),         // Heredado de exploración
  agudeza_visual: z.string().optional(),      // Normal / Anormal
  presion_arterial: z.string().optional(),    // Calculado de TA
  conclusiones: z.string().optional()         // Ej: "SIN OTROS DATOS PATOLOGICOS..."
});