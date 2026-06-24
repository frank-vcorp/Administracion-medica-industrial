export const dynamic = 'force-dynamic'

import { getWorkers } from "@/actions/worker.actions"
import { getCompanies, getJobPositions, getBranches } from "@/actions/admin.actions"
import WorkerFormModal from "@/components/WorkerFormModal"
import WorkersTable from "@/components/WorkersTable"
import BulkWorkerImportModal from "@/components/BulkWorkerImportModal"

/**
 * @id ARCH-20260318-09
 * @see context/handoffs/HANDOFF-ARCH-20260318-08-CORRECTIVO-SOFIA.md
 * @id IMPL-20260519-14: Botón Carga Masiva integrado (ARCH-20260519-11)
 * @id FIX-20260519-08: Fallback defensivo de branches para no romper /workers
 * @backup context/checkpoints/CHK_IMPL-20260519-14-PROJECT-ALTA-MASIVA.md
 */
export default async function WorkersPage(props: { searchParams: Promise<{ edit?: string }> }) {
    const searchParams = await props.searchParams
    const [workers, companies, jobPositions, branchesResult] = await Promise.allSettled([
        getWorkers(),
        getCompanies(),
        getJobPositions(),
        getBranches(),
    ])

    if (workers.status !== 'fulfilled' || companies.status !== 'fulfilled' || jobPositions.status !== 'fulfilled') {
        throw new Error('No se pudo cargar el padrón de trabajadores')
    }

    const branches = branchesResult.status === 'fulfilled' ? branchesResult.value : []

    const companyOptions = companies.value.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
    const branchOptions = branches.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Listado de pacientes</h2>
                    <p className="text-sm text-slate-500 font-medium">Gestión integral de empleados y afiliaciones.</p>
                </div>

                <div className="flex items-center gap-3">
                    <BulkWorkerImportModal companies={companyOptions} branches={branchOptions} />
                    <WorkerFormModal companies={companies.value} jobPositions={jobPositions.value} />
                </div>
            </div>

            <WorkersTable
                workers={workers.value}
                companies={companies.value}
                jobPositions={jobPositions.value}
                initialEditWorkerId={searchParams.edit}
            />
        </div>
    )
}
