export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { getWorkers } from "@/actions/worker.actions"
import { getCompanies, getBranches } from "@/actions/admin.actions"
import { getMedicalProfileOptions } from "@/actions/medical-profiles"
import WorkerFormModal from "@/components/WorkerFormModal"
import BulkWorkerImportModal from "@/components/BulkWorkerImportModal"
import BulkClinicWalkInImportModal from "@/components/BulkClinicWalkInImportModal"
import WorkersPageClient from "@/components/workers/WorkersPageClient"
import type { SelectableWorker } from "@/components/workers/WorkerSelectableGrid"

/**
 * @id ARCH-20260318-09
 * @see context/handoffs/HANDOFF-ARCH-20260318-08-CORRECTIVO-SOFIA.md
 * @id IMPL-20260519-14: Botón Carga Masiva integrado (ARCH-20260519-11)
 * @id FIX-20260519-08: Fallback defensivo de branches para no romper /workers
 * @backup context/checkpoints/CHK_IMPL-20260519-14-PROJECT-ALTA-MASIVA.md
 * @id ARCH-20260708-01: distinción Alta Masiva Unidad Móvil (verde) vs Clínica Física (azul).
 * @id IMPL-20260730-07 (FIX-20260730-06): Selección masiva + botón eliminar (sólo SUPERADMIN).
 */
export default async function WorkersPage(props: { searchParams: Promise<{ edit?: string }> }) {
    const searchParams = await props.searchParams
    const session = await getServerSession(authOptions)
    const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === 'SUPERADMIN'

    const [workers, companies, medicalProfiles, branchesResult] = await Promise.allSettled([
        getWorkers(),
        getCompanies(),
        getMedicalProfileOptions(),
        getBranches(),
    ])

    if (workers.status !== 'fulfilled' || companies.status !== 'fulfilled' || medicalProfiles.status !== 'fulfilled') {
        throw new Error('No se pudo cargar el padrón de trabajadores')
    }

    const branches = branchesResult.status === 'fulfilled' ? branchesResult.value : []

    const companyOptions = companies.value.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
    const branchOptions = branches.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))

    // Cast al shape que consume WorkerSelectableGrid (subset de lo que devuelve getWorkers).
    const selectableWorkers: SelectableWorker[] = (workers.value as unknown as SelectableWorker[])

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Listado de pacientes</h2>
                    <p className="text-sm text-slate-500 font-medium">Gestión integral de empleados y afiliaciones.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Verde: BulkWorkerImportModal renderiza su propio botón "Carga Masiva" (Unidad Móvil, con proyecto, intakeSource=UNIT_MOBILE_MASS) */}
                    <BulkWorkerImportModal companies={companyOptions} branches={branchOptions} />
                    {/* Azul: Clínica Física (sin proyecto, intakeSource=CLINIC_WALK_IN_MASS) */}
                    <BulkClinicWalkInImportModal branches={branchOptions} />
                    <WorkerFormModal companies={companies.value} medicalProfiles={medicalProfiles.value} />
                </div>
            </div>

            <WorkersPageClient
                workers={selectableWorkers}
                companies={companies.value}
                medicalProfiles={medicalProfiles.value}
                initialEditWorkerId={searchParams.edit}
                isSuperAdmin={isSuperAdmin}
            />
        </div>
    )
}