'use client'

import { useMemo, useState } from 'react'
import {
  buildPbProfileNameFromTests,
  PB_PROFILE_PREFIX,
} from '@/lib/public-general-profile-name'

export type AvailableTestOption = {
  id: string
  name: string
  code: string
  category: { name: string }
}

export type MedicalProfileOption = {
  id: string
  name: string
  companyId: string | null
}

type ProfileMode = 'existing' | 'quick'

interface Props {
  companyId: string
  medicalProfiles: MedicalProfileOption[]
  availableTests: AvailableTestOption[]
  selectedProfileId: string
  onProfileIdChange: (id: string) => void
  selectedTestIds: string[]
  onTestIdsChange: (ids: string[]) => void
  customProfileName: string
  onCustomProfileNameChange: (name: string) => void
  mode: ProfileMode
  onModeChange: (mode: ProfileMode) => void
}

function profilesForPublicGeneral(
  profiles: MedicalProfileOption[],
  companyId: string
): MedicalProfileOption[] {
  const companyProfiles = profiles.filter(
    (p) => p.companyId === companyId || p.companyId === null
  )
  const pbFirst = [...companyProfiles].sort((a, b) => {
    const aPb = a.name.startsWith(`${PB_PROFILE_PREFIX} `) ? 0 : 1
    const bPb = b.name.startsWith(`${PB_PROFILE_PREFIX} `) ? 0 : 1
    if (aPb !== bPb) return aPb - bPb
    return a.name.localeCompare(b.name)
  })
  return pbFirst
}

export default function PublicGeneralProfilePicker({
  companyId,
  medicalProfiles,
  availableTests,
  selectedProfileId,
  onProfileIdChange,
  selectedTestIds,
  onTestIdsChange,
  customProfileName,
  onCustomProfileNameChange,
  mode,
  onModeChange,
}: Props) {
  const [testSearch, setTestSearch] = useState('')

  const filteredProfiles = useMemo(
    () => profilesForPublicGeneral(medicalProfiles, companyId),
    [medicalProfiles, companyId]
  )

  const selectedTestsForPreview = useMemo(
    () => availableTests.filter((t) => selectedTestIds.includes(t.id)),
    [availableTests, selectedTestIds]
  )

  const autoNamePreview = useMemo(
    () => buildPbProfileNameFromTests(selectedTestsForPreview),
    [selectedTestsForPreview]
  )

  const byCategory = useMemo(() => {
    const q = testSearch.trim().toLowerCase()
    const filtered = q
      ? availableTests.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.code.toLowerCase().includes(q) ||
            t.category.name.toLowerCase().includes(q)
        )
      : availableTests

    return filtered.reduce<Record<string, AvailableTestOption[]>>((acc, test) => {
      const cat = test.category.name
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(test)
      return acc
    }, {})
  }, [availableTests, testSearch])

  function toggleTest(id: string) {
    if (selectedTestIds.includes(id)) {
      onTestIdsChange(selectedTestIds.filter((x) => x !== id))
    } else {
      onTestIdsChange([...selectedTestIds, id])
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
        <button
          type="button"
          onClick={() => onModeChange('existing')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            mode === 'existing'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Perfil existente
        </button>
        <button
          type="button"
          onClick={() => onModeChange('quick')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            mode === 'quick'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          + Perfil rápido
        </button>
      </div>

      {mode === 'existing' ? (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
            Perfil médico
          </label>
          <select
            value={selectedProfileId}
            onChange={(e) => onProfileIdChange(e.target.value)}
            required
            className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500 p-3 rounded-xl text-sm outline-none appearance-none"
          >
            <option value="">-- Seleccionar perfil --</option>
            {filteredProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
              Nombre del perfil (opcional)
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs font-black text-teal-700 bg-teal-50 px-2 py-3 rounded-l-xl ring-1 ring-teal-100">
                {PB_PROFILE_PREFIX}
              </span>
              <input
                type="text"
                value={customProfileName}
                onChange={(e) => onCustomProfileNameChange(e.target.value)}
                placeholder="Auto si se deja vacío"
                className="flex-1 bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500 p-3 rounded-r-xl text-sm outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-500 ml-1">
              Vista previa:{' '}
              <strong className="text-teal-800">
                {customProfileName.trim()
                  ? `${PB_PROFILE_PREFIX} ${customProfileName.trim()}`
                  : autoNamePreview}
              </strong>
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
              Pruebas a incluir
            </label>
            <input
              type="search"
              value={testSearch}
              onChange={(e) => setTestSearch(e.target.value)}
              placeholder="Buscar prueba..."
              className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500 p-2.5 rounded-xl text-xs outline-none mb-2"
            />
            <div className="max-h-40 overflow-y-auto rounded-xl ring-1 ring-slate-200 bg-slate-50 p-2 space-y-2">
              {Object.entries(byCategory).map(([category, tests]) => (
                <div key={category}>
                  <p className="text-[9px] font-black text-slate-400 uppercase px-1 mb-1">
                    {category}
                  </p>
                  <div className="space-y-1">
                    {tests.map((test) => (
                      <label
                        key={test.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTestIds.includes(test.id)}
                          onChange={() => toggleTest(test.id)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="font-medium text-slate-700">{test.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 ml-auto">
                          {test.code}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(byCategory).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">Sin pruebas</p>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              {selectedTestIds.length === 0
                ? 'Marca al menos una prueba'
                : `${selectedTestIds.length} prueba(s) seleccionada(s)`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export type { ProfileMode }
