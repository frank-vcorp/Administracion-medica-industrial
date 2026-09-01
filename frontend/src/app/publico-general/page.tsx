export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { ensurePublicGeneralCompany } from '@/actions/admin.actions'
import { getWorkers } from '@/actions/worker.actions'
import { getMedicalProfileOptions } from '@/actions/medical-profiles'
import PublicGeneralPageClient from '@/components/public-general/PublicGeneralPageClient'
import type { SelectableWorker } from '@/components/workers/WorkerSelectableGrid'

export default async function PublicGeneralPage() {
  const session = await getServerSession(authOptions)
  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === 'SUPERADMIN'

  const publicGeneralCompany = await ensurePublicGeneralCompany()
  const [workers, medicalProfiles] = await Promise.all([
    getWorkers({ companyId: publicGeneralCompany.id }),
    getMedicalProfileOptions(),
  ])

  return (
    <PublicGeneralPageClient
      workers={workers as unknown as SelectableWorker[]}
      publicGeneralCompany={publicGeneralCompany}
      medicalProfiles={medicalProfiles}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
