/**
 * Nomenclatura AMI (minuta 23-Sep-26):
 * Razón social / Género (Masculino|Femenino) / CTM / Nombre del perfil
 * CTM es segmento fijo literal (centro de trabajo — sin variante por planta).
 */

export const MEDICAL_PROFILE_NAME_CTM = 'CTM'
export const MEDICAL_PROFILE_NAME_SEPARATOR = ' / '

export type MedicalProfileNameGender = 'MALE' | 'FEMALE'

export const MEDICAL_PROFILE_GENDER_LABEL: Record<MedicalProfileNameGender, string> = {
  MALE: 'Masculino',
  FEMALE: 'Femenino',
}

const GENDER_FROM_LABEL: Record<string, MedicalProfileNameGender> = {
  masculino: 'MALE',
  femenino: 'FEMALE',
}

export function buildMedicalProfileDisplayName(parts: {
  companyLegalName: string
  gender: MedicalProfileNameGender
  profileLabel: string
}): string {
  const company = parts.companyLegalName.trim()
  const label = parts.profileLabel.trim()
  if (!company || !label) {
    throw new Error('Razón social y nombre del perfil son obligatorios')
  }
  const genderLabel = MEDICAL_PROFILE_GENDER_LABEL[parts.gender]
  return [company, genderLabel, MEDICAL_PROFILE_NAME_CTM, label].join(
    MEDICAL_PROFILE_NAME_SEPARATOR,
  )
}

export function parseMedicalProfileDisplayName(
  name: string,
): { companyLegalName: string; gender: MedicalProfileNameGender; profileLabel: string } | null {
  const segments = name.split(MEDICAL_PROFILE_NAME_SEPARATOR).map((s) => s.trim())
  if (segments.length !== 4) return null
  if (segments[2].toUpperCase() !== MEDICAL_PROFILE_NAME_CTM) return null
  const gender = GENDER_FROM_LABEL[segments[1].toLowerCase()]
  if (!gender) return null
  if (!segments[0] || !segments[3]) return null
  return {
    companyLegalName: segments[0],
    gender,
    profileLabel: segments[3],
  }
}

export function initialGenderAndLabelFromProfileName(
  fullName: string,
): { gender: MedicalProfileNameGender; profileLabel: string } {
  const parsed = parseMedicalProfileDisplayName(fullName)
  if (parsed) {
    return { gender: parsed.gender, profileLabel: parsed.profileLabel }
  }
  return { gender: 'MALE', profileLabel: fullName.trim() }
}
