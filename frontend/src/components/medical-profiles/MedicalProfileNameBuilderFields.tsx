'use client'

import { useMemo, useState } from 'react'
import {
  MEDICAL_PROFILE_NAME_CTM,
  MEDICAL_PROFILE_GENDER_LABEL,
  type MedicalProfileNameGender,
  buildMedicalProfileDisplayName,
  initialGenderAndLabelFromProfileName,
} from '@/lib/medical-profile-display-name'

type Props = {
  companyLegalName: string
  initialFullName: string
  /** Si se omite, se infiere de `initialFullName` (o parseo nomenclatura AMI). */
  initialProfileLabel?: string
}

export function MedicalProfileNameBuilderFields({
  companyLegalName,
  initialFullName,
  initialProfileLabel,
}: Props) {
  const initial = initialGenderAndLabelFromProfileName(initialFullName)
  const [gender, setGender] = useState<MedicalProfileNameGender>(initial.gender)
  const [profileLabel, setProfileLabel] = useState(
    initialProfileLabel ?? initial.profileLabel,
  )

  const preview = useMemo(() => {
    const label = profileLabel.trim()
    if (!companyLegalName.trim() || !label) return ''
    try {
      return buildMedicalProfileDisplayName({
        companyLegalName,
        gender,
        profileLabel: label,
      })
    } catch {
      return ''
    }
  }, [companyLegalName, gender, profileLabel])

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <input type="hidden" name="useStructuredProfileName" value="1" />
      <input type="hidden" name="profileGender" value={gender} />

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Razón social</span>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
          {companyLegalName}
        </p>
      </div>

      <div>
        <label htmlFor="profile-gender" className="mb-1 block text-sm font-medium text-slate-700">
          Género <span className="text-red-500">*</span>
        </label>
        <select
          id="profile-gender"
          value={gender}
          onChange={(e) => setGender(e.target.value as MedicalProfileNameGender)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          {(Object.entries(MEDICAL_PROFILE_GENDER_LABEL) as [MedicalProfileNameGender, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Centro de trabajo</span>
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-semibold tracking-wide text-slate-600">
          {MEDICAL_PROFILE_NAME_CTM}
        </p>
      </div>

      <div>
        <label htmlFor="profile-label" className="mb-1 block text-sm font-medium text-slate-700">
          Nombre del perfil <span className="text-red-500">*</span>
        </label>
        <input
          id="profile-label"
          name="profileLabel"
          value={profileLabel}
          onChange={(e) => setProfileLabel(e.target.value)}
          required
          maxLength={120}
          placeholder="Ej. Ingreso operativo"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      {preview && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Vista previa</p>
          <p className="mt-1 text-sm font-medium text-blue-900 break-words">{preview}</p>
        </div>
      )}
    </div>
  )
}
