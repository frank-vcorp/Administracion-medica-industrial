export const dynamic = 'force-dynamic'

import { getWorkers } from "@/actions/worker.actions"
import { getCompanies, getJobPositions } from "@/actions/admin.actions"
import WorkerFormModal from "@/components/WorkerFormModal"
import WorkersTable from "@/components/WorkersTable"

/**
 * @id ARCH-20260318-09
 * @see context/handoffs/HANDOFF-ARCH-20260318-08-CORRECTIVO-SOFIA.md
 */
export default async function WorkersPage(props: { searchParams: Promise<{ edit?: string }> }) {
    const searchParams = await props.searchParams
    const [workers, companies, jobPositions] = await Promise.all([
        getWorkers(),
        getCompanies(),
        getJobPositions(),
    ])

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Padrón de Trabajadores</h2>
                    <p className="text-sm text-slate-500 font-medium">Gestión integral de empleados y afiliaciones.</p>
                </div>

                <WorkerFormModal companies={companies} jobPositions={jobPositions} />
            </div>

            <WorkersTable
                workers={workers}
                companies={companies}
                jobPositions={jobPositions}
                initialEditWorkerId={searchParams.edit}
            />
        </div>
    )
}
