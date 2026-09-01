export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { ensurePublicGeneralCompany, getBranches } from '@/actions/admin.actions'
import { getWorkers } from '@/actions/worker.actions'
import { getMedicalProfileOptions, getMedicalTests } from '@/actions/medical-profiles'
import PublicGeneralPageClient from '@/components/public-general/PublicGeneralPageClient'
import type { SelectableWorker } from '@/components/workers/WorkerSelectableGrid'

export default async function PublicGeneralPage() {
  const session = await getServerSession(authOptions)
  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === 'SUPERADMIN'

  const publicGeneralCompany = await ensurePublicGeneralCompany()
  const [workers, medicalProfiles, availableTests, branchesResult] = await Promise.all([
    getWorkers({ companyId: publicGeneralCompany.id }),
    getMedicalProfileOptions(),
    getMedicalTests(),
    getBranches(),
  ])
  const branches = branchesResult.map((b: { id: string; name: string }) => ({
    id: b.id,
    name: b.name,
  }))

  return (
    <PublicGeneralPageClient
      workers={workers as unknown as SelectableWorker[]}
      publicGeneralCompany={publicGeneralCompany}
      medicalProfiles={medicalProfiles}
      availableTests={availableTests}
      branches={branches}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
