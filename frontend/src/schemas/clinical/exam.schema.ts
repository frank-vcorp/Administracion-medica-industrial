import { z } from 'zod';

const cleanString = z.string().trim().max(1000).optional();
const cleanNum = z.coerce.number().nonnegative().optional();

// ----------------------------------------------------------------------
// 6. ANTECEDENTES REPRODUCTIVOS e INMUNIZACIONES (Imágenes 4 y 5)
// ----------------------------------------------------------------------
export const ReproductivosInmunizacionesSchema = z.object({
  ivs: cleanString,
  vsa: cleanString,
  mpf: cleanString,
  doc_prostata: cleanString,
  rubeola: cleanString,
  neumococo: cleanString,
  sarampion: cleanString,
  influenza: cleanString,
  toxoide_tetanico: cleanString,
  hepatitis_b: cleanString,
  otra_inmunizacion: cleanString,
  proxima_dosis: cleanString
});

// ----------------------------------------------------------------------
// 7. SOMATOMETRÍA / SIGNOS VITALES (Imagen 6)
// ----------------------------------------------------------------------
export const SomatometriaVitalesSchema = z.object({
  ta_sistolica: cleanNum,
  ta_diastolica: cleanNum,
  fc_min: cleanNum,
  peso_kg: cleanNum,
  perimetro_cintura: cleanNum,
  talla_m: cleanNum,
  perimetro_cadera: cleanNum,
  fr_min: cleanNum,
  temperatura: z.coerce.number().gt(30).lt(45).optional(),
  imc: cleanNum,               
  complexion: z.enum(['BAJO PESO', 'NORMAL', 'SOBREPESO', 'OBESIDAD', 'OBESIDAD SEVERA']).optional()
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
  test_ishihara: cleanString,
  campimetria: cleanString
});

// ----------------------------------------------------------------------
// 9. EXPLORACIÓN FÍSICA GENERAL (Imagen 8)
// ----------------------------------------------------------------------
export const ExploracionFisicaSchema = z.object({
  neurologico: cleanString,
  cabeza: cleanString,
  piel_y_faneras: cleanString,
  oidos_cad: cleanString,
  oidos_cai: cleanString,
  ojos: cleanString,
  boca_estado: cleanString,
  boca_alineacion: cleanString,
  nariz: cleanString,
  faringe: cleanString,
  cuello: cleanString,
  torax: cleanString,
  corazon: cleanString,
  campos_pulmonares: cleanString,
  abdomen: cleanString,
  genitourinario: cleanString,
  columna_vertebral: cleanString,
  test_adam: cleanString,
  ms_superiores: cleanString,
  fuerza_muscular_daniels_sup: cleanString,
  ms_inferiores: cleanString,
  fuerza_muscular_daniels_inf: cleanString,
  circulacion_venosa: cleanString,
  arco_de_movilidad: cleanString,
  tono_muscular: cleanString,
  coordinacion: cleanString,
  test_romberg: cleanString,
  signo_bragard: cleanString,
  prueba_finkelstein: cleanString,
  signo_tinel: cleanString,
  prueba_phanel: cleanString,
  prueba_lasegue: cleanString,
  presencia_quiste_sinovial: cleanString,
  especificar_quiste: cleanString
});
