/**
 * Etiquetas visibles (modo oración) para valores de catálogo persistidos en MAYÚSCULAS.
 * Los valores guardados / enums de API no cambian — solo el copy en UI y PDF legible.
 */
import { applySentenceCase } from '@/lib/text/sentence-case'

const CATALOG_ENUM_LABELS: Record<string, string> = {
  SI: 'Sí',
  NEGADO: 'Negado',
  NEGADOS: 'Negados',
  'NO APLICA': 'No aplica',
  DESCONOCE: 'Desconoce',
  OTROS: 'Otros',

  MATUTINO: 'Matutino',
  VESPERTINO: 'Vespertino',
  NOCTURNO: 'Nocturno',
  MIXTO: 'Mixto',

  SOLTERO: 'Soltero/a',
  CASADO: 'Casado/a',
  UNION_LIBRE: 'Unión libre',
  DIVORCIADO: 'Divorciado/a',
  VIUDO: 'Viudo/a',
  OTRO: 'Otro',

  BUENA: 'Buena',
  REGULAR: 'Regular',
  MALA: 'Mala',

  PADRE: 'Padre',
  MADRE: 'Madre',
  AMBOS: 'Ambos',
  HERMANOS: 'Hermanos',
  'AB PATERNO': 'Ab paterno',
  'AB MATERNO': 'Ab materno',

  NORMAL: 'Normal',
  HIPERTROFIA: 'Hipertrofia',
  HIPOTROFIA: 'Hipotrofia',
  LIMITADOS: 'Limitados',
  AUSENTES: 'Ausentes',
  'PRESENTES Y NORMALES': 'Presentes y normales',
  DISMINUIDOS: 'Disminuidos',
  'PRESENTES Y NORMOREFLECTICOS': 'Presentes y normoreflecticos',
  POSITIVO: 'Positivo',
  NEGATIVO: 'Negativo',
  ALTERADOS: 'Alterados',
  ALTERADO: 'Alterado',
}

export function getCatalogEnumDisplayLabel(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed

  const upper = trimmed.toUpperCase()
  const mapped = CATALOG_ENUM_LABELS[trimmed] ?? CATALOG_ENUM_LABELS[upper]
  if (mapped) return mapped

  if (trimmed.includes('_')) {
    const fromUnderscore = CATALOG_ENUM_LABELS[upper]
    if (fromUnderscore) return fromUnderscore
    const humanized = trimmed
      .split('_')
      .map((part, i) => (i === 0 ? applySentenceCase(part) : part.toLocaleLowerCase('es')))
      .join(' ')
    return humanized
  }

  if (trimmed === upper && /[A-ZÁÉÍÓÚÑ]/.test(trimmed)) {
    return applySentenceCase(trimmed)
  }

  return trimmed
}

const PAPELETA_STUDY_TITLE_OVERRIDES: Record<string, string> = {
  'CERTIFICADO MEDICO': 'Certificado médico',
  'CERTIFICADO MÉDICO': 'Certificado médico',
  'CONSULTA MEDICA': 'Consulta médica',
  'CONSULTA MÉDICA': 'Consulta médica',
  'EXAMEN MEDICO GENERAL': 'Examen médico general',
  'EXAMEN MÉDICO GENERAL': 'Examen médico general',
}

/** Título de estudio en papeleta (snapshot puede venir en MAYÚSCULAS del catálogo). */
export function formatPapeletaStudyTitle(testNameSnapshot: string): string {
  const trimmed = (testNameSnapshot ?? '').trim()
  if (!trimmed) return trimmed
  const override =
    PAPELETA_STUDY_TITLE_OVERRIDES[trimmed] ??
    PAPELETA_STUDY_TITLE_OVERRIDES[trimmed.toUpperCase()]
  if (override) return override
  return getCatalogEnumDisplayLabel(trimmed)
}

/** Varias opciones de catálogo separadas por coma (heredo-familiares multiselect). */
export function formatCatalogEnumListDisplay(value: string): string {
  if (!value.includes(',')) return getCatalogEnumDisplayLabel(value)
  return value
    .split(',')
    .map((part) => getCatalogEnumDisplayLabel(part.trim()))
    .join(', ')
}
