'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import WorkerFormModal from '@/components/WorkerFormModal'
import BulkWorkerImportModal from '@/components/BulkWorkerImportModal'
import BulkClinicWalkInImportModal from '@/components/BulkClinicWalkInImportModal'

interface CompanyOption {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  rfc?: string | null
  defaultBranchId?: string | null
}

interface Props {
  companies: CompanyOption[]
  branches: Array<{ id: string; name: string }>
  medicalProfiles: Array<{ id: string; name: string; companyId: string | null }>
}

export default function WorkersPageToolbar({ companies, branches, medicalProfiles }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [preselectedCompanyId, setPreselectedCompanyId] = useState<string | undefined>()
  const [lockCompany, setLockCompany] = useState(false)

  useEffect(() => {
    const action = searchParams.get('action')
    const companyId = searchParams.get('companyId')
    if (action !== 'new-worker' || !companyId) return

    setPreselectedCompanyId(companyId)
    setLockCompany(true)
    setCreateModalOpen(true)

    const next = new URLSearchParams(searchParams.toString())
    next.delete('action')
    next.delete('companyId')
    const qs = next.toString()
    router.replace(qs ? `/workers?${qs}` : '/workers')
  }, [searchParams, router])

  function closeCreateModal() {
    setCreateModalOpen(false)
    setPreselectedCompanyId(undefined)
    setLockCompany(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <BulkWorkerImportModal companies={companies} branches={branches} />
      <BulkClinicWalkInImportModal branches={branches} />
      <WorkerFormModal
        companies={companies}
        medicalProfiles={medicalProfiles}
        defaultCompanyId={preselectedCompanyId}
        lockCompany={lockCompany}
        isOpen={createModalOpen}
        onClose={closeCreateModal}
        hideDefaultTrigger
      />
      <button
        type="button"
        onClick={() => {
          setPreselectedCompanyId(undefined)
          setLockCompany(false)
          setCreateModalOpen(true)
        }}
        className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
      >
        <span className="text-lg">+</span> Registrar Trabajador
      </button>
    </div>
  )
}
