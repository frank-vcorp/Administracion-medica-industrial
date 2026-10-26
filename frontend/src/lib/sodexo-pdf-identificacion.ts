import { isSodexoFemalePatient, isSodexoMalePatient } from '@/lib/sodexo-ami-mirror'

export function normalizeSodexoPdfToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function mapSexCheckboxesForPdf(sexo: string | null | undefined): {
  femenino: boolean
  masculino: boolean
} {
  if (isSodexoFemalePatient(sexo)) return { femenino: true, masculino: false }
  if (isSodexoMalePatient(sexo)) return { femenino: false, masculino: true }
  return { femenino: false, masculino: false }
}

export function mapEstadoCivilCheckboxesForPdf(estado: string | null | undefined): {
  soltero: boolean
  casado: boolean
  union: boolean
  viudo: boolean
} {
  const u = normalizeSodexoPdfToken(estado ?? '')
  return {
    soltero: u.includes('SOLTER') || u === 'S',
    casado: u.includes('CASAD') || u === 'C',
    union: u.includes('UNION') || u.includes('LIBRE') || u === 'UL',
    viudo: u.includes('VIUD') || u === 'V',
  }
}

export function mapEscolaridadChecksForPdf(escolaridad: string | null | undefined) {
  const u = normalizeSodexoPdfToken(escolaridad ?? '')
  return {
    basica: u.includes('BASIC') || u.includes('PRIMAR'),
    media: u.includes('MEDIA') || u.includes('SECUND') || u.includes('PREPARATOR'),
    tecnica: u.includes('TECNIC'),
    universidad: u.includes('UNIVERS') || u.includes('LICEN'),
    postgrado: u.includes('POST') || u.includes('MAESTR') || u.includes('DOCTOR'),
  }
}
