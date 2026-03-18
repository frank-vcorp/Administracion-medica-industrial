'use client'

// IMPL-20260318-01: WorkersTable — tabla de trabajadores con botón Editar y modal de edición controlado
// ARCH-20260318-09: apertura automática por query param ?edit= para resolver duplicate_found
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import WorkerFormModal, { WorkerForEdit } from './WorkerFormModal'

interface WorkerRow {
    id: string
    universalId: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    dob: Date | null
    companyId: string | null
    jobPositionId: string | null
    company: { name: string; defaultBranchId: string | null } | null
    jobPosition: { id: string; name: string; defaultProfileId: string | null } | null
}

interface CompanyOption { id: string; name: string }
interface JobPositionOption { id: string; name: string; companyId: string }

interface WorkersTableProps {
    workers: WorkerRow[]
    companies: CompanyOption[]
    jobPositions: JobPositionOption[]
    initialEditWorkerId?: string
}

/**
 * @id ARCH-20260318-09
 * @see context/handoffs/HANDOFF-ARCH-20260318-08-CORRECTIVO-SOFIA.md
 */
export default function WorkersTable({ workers, companies, jobPositions, initialEditWorkerId }: WorkersTableProps) {
    const [workerToEdit, setWorkerToEdit] = useState<WorkerForEdit | null>(null)
    const router = useRouter()
    const pathname = usePathname()

    function toEditPayload(w: WorkerRow): WorkerForEdit {
        return {
            id: w.id,
            firstName: w.firstName,
            lastName: w.lastName,
            dob: w.dob,
            email: w.email,
            phone: w.phone,
            companyId: w.companyId,
            jobPositionId: w.jobPositionId,
        }
    }

    useEffect(() => {
        if (!initialEditWorkerId) return

        const matchedWorker = workers.find(worker => worker.id === initialEditWorkerId)
        if (!matchedWorker) return

        setWorkerToEdit(toEditPayload(matchedWorker))
        router.replace(pathname)
    }, [initialEditWorkerId, pathname, router, workers])

    function handleCloseEditModal() {
        setWorkerToEdit(null)
        router.replace(pathname)
    }

    return (
        <>
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">ID Universal</th>
                            <th className="px-6 py-4">Nombre Completo</th>
                            <th className="px-6 py-4">Empresa / Puesto</th>
                            <th className="px-6 py-4">Contacto</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {workers.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400">Sin trabajadores registrados</td>
                            </tr>
                        )}
                        {workers.map(w => (
                            <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs text-slate-500">{w.universalId}</td>
                                <td className="px-6 py-4 font-medium text-slate-900">{w.firstName} {w.lastName}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        {w.company ? (
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100 w-fit">
                                                {w.company.name}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs italic">Sin Empresa</span>
                                        )}
                                        {w.jobPosition && (
                                            <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-100 w-fit">
                                                {w.jobPosition.name}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-500 text-xs">{w.email || w.phone || '-'}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => setWorkerToEdit(toEditPayload(w))}
                                            className="text-amber-600 hover:text-amber-800 text-xs font-semibold hover:underline"
                                        >
                                            Editar
                                        </button>
                                        <Link href={`/history/${w.id}`} className="text-blue-600 hover:underline text-xs">
                                            Historial
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de edición (controlado): se monta solo cuando hay un trabajador seleccionado */}
            {workerToEdit && (
                <WorkerFormModal
                    companies={companies}
                    jobPositions={jobPositions}
                    workerToEdit={workerToEdit}
                    isOpen={true}
                    onClose={handleCloseEditModal}
                />
            )}
        </>
    )
}
