/**
 * Matriz de riesgos — factor → casillas nivel 1…5 y A.
 * Mapa calibrado: `scripts/generate-sodexo-matriz-map.ts`.
 */
import { SODEXO_MATRIZ_FACTOR_LEVELS_GENERATED } from '@/lib/sodexo-pdf-matriz-map.generated'

export const SODEXO_MATRIZ_FACTOR_LEVELS: Record<string, readonly string[]> =
  SODEXO_MATRIZ_FACTOR_LEVELS_GENERATED

export const SODEXO_MATRIZ_KEYWORD_ALIASES: Record<string, string> = {
  calor: 'calor',
  frio: 'frio',
  frío: 'frio',
  ruido: 'ruido',
  vibracion: 'vibracion',
  vibración: 'vibracion',
  iluminacion: 'alta_iluminacion',
  iluminación: 'alta_iluminacion',
  'alta iluminacion': 'alta_iluminacion',
  'baja iluminacion': 'baja_iluminacion',
  polvo: 'polvos',
  polvos: 'polvos',
  humo: 'humos',
  humos: 'humos',
  neblina: 'neblinas',
  neblinas: 'neblinas',
  quimico: 'quimico',
  químico: 'quimico',
  ergonom: 'ergonomico_fq',
  psicosocial: 'psicosocial_laboral',
  electrico: 'cont_electrico_directo',
  eléctrico: 'cont_electrico_directo',
  gas: 'gases',
  gases: 'gases',
  vapor: 'vapores',
  vapores: 'vapores',
  liquido: 'liquidos',
  líquido: 'liquidos',
  incendio: 'incendio',
  explosion: 'explosion',
  explosión: 'explosion',
  turno: 'turnos',
  turnos: 'turnos',
  monotonia: 'monotonia',
  monotonía: 'monotonia',
  presion: 'presion',
  presión: 'presion',
  radiacion: 'rad_no_ionizante',
  radiación: 'rad_no_ionizante',
  contacto: 'contacto',
  levantamiento: 'levantamiento_cargas',
  cargas: 'levantamiento_cargas',
  sentado: 'sentado_prolongado',
  'de pie': 'de_pie_prolongado',
  sobrecarga: 'sobrecarga',
  conflicto: 'conflicto_interpersonal',
  producto: 'producto_quimico',
}
