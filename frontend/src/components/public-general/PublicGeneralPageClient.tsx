'use client'

import { useMemo, useState } from 'react'
import WorkerFormModal from '@/components/WorkerFormModal'
import WorkersPageClient from '@/components/workers/WorkersPageClient'
import type { SelectableWorker } from '@/components/workers/WorkerSelectableGrid'

interface Props {
  workers: SelectableWorker[]
  publicGeneralCompany: {
    id: string
    name: string
    email: string | null
    phone: string | null
    rfc: string | null
    defaultBranchId: string | null
  }
  medicalProfiles: Array<{ id: string; name: string; companyId: string | null }>
  isSuperAdmin: boolean
}

export default function PublicGeneralPageClient({
  workers,
  publicGeneralCompany,
  medicalProfiles,
  isSuperAdmin,
}: Props) {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return workers
    return workers.filter((w) => {
      const full = `${w.firstName} ${w.lastName} ${w.universalId}`.toLowerCase()
      return full.includes(q)
    })
  }, [workers, search])

  const companyOptions = useMemo(
    () => [
      {
        id: publicGeneralCompany.id,
        name: publicGeneralCompany.name,
        email: publicGeneralCompany.email,
        phone: publicGeneralCompany.phone,
        rfc: publicGeneralCompany.rfc,
      },
    ],
    [publicGeneralCompany]
  )

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Público general</h2>
          <p className="text-sm text-slate-500 font-medium">
            Pacientes particulares · empresa fija{' '}
            <span className="text-teal-700 font-bold">{publicGeneralCompany.name}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-teal-200 flex items-center gap-2"
        >
          <span className="text-lg">+</span> Alta público general
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-end gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
            Buscar paciente
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, apellido o ID universal..."
            className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500 p-3 rounded-xl text-sm outline-none"
          />
        </div>
        <p className="text-xs text-slate-500 md:pb-3">
          Mostrando <strong className="text-slate-800">{filteredWorkers.length}</strong> de{' '}
          <strong className="text-slate-800">{workers.length}</strong> particulares
        </p>
      </div>

      <WorkersPageClient
        workers={filteredWorkers}
        companies={[{ id: publicGeneralCompany.id, name: publicGeneralCompany.name, defaultBranchId: publicGeneralCompany.defaultBranchId }]}
        medicalProfiles={medicalProfiles}
        isSuperAdmin={isSuperAdmin}
        hideCompanyColumn
      />

      <WorkerFormModal
        companies={companyOptions}
        medicalProfiles={medicalProfiles}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        publicGeneralMode
        defaultCompanyId={publicGeneralCompany.id}
        hideDefaultTrigger
      />
    </div>
  )
}
