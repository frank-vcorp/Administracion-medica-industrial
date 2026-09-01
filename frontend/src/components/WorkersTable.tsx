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
    medicalProfileId: string | null
    company: { name: string; defaultBranchId: string | null } | null
    medicalProfile: { id: string; name: string } | null
}

interface CompanyOption { id: string; name: string }
interface MedicalProfileOption { id: string; name: string; companyId: string | null }

interface WorkersTableProps {
    workers: WorkerRow[]
    companies: CompanyOption[]
    medicalProfiles: MedicalProfileOption[]
    initialEditWorkerId?: string
}

/**
 * @id ARCH-20260318-09
 * @see context/handoffs/HANDOFF-ARCH-20260318-08-CORRECTIVO-SOFIA.md
 */
export default function WorkersTable({ workers, companies, medicalProfiles, initialEditWorkerId }: WorkersTableProps) {
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
            medicalProfileId: w.medicalProfileId,
        }
    }

    useEffect(() => {
        if (!initialEditWorkerId) return

        const matchedWorker = workers.find(worker => worker.id === initialEditWorkerId)
        if (!matchedWorker) return

        // eslint-disable-next-line react-hooks/set-state-in-effect -- abre modal automáticamente si initialEditWorkerId viene por query string.
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
                    {/* IMPL-20260624-03: Tabla re-estructurada — Empresa/Puesto y Contacto se separan en columnas independientes (ID, Nombre, Empresa, Puesto, Correo, Teléfono, Acciones) */}
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Nombre Completo</th>
                            <th className="px-6 py-4">Empresa</th>
                            <th className="px-6 py-4">Perfil Médico</th>
                            <th className="px-6 py-4">Correo</th>
                            <th className="px-6 py-4">Teléfono</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {workers.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-400">Sin trabajadores registrados</td>
                            </tr>
                        )}
                        {workers.map(w => (
                            <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs text-slate-500">{w.universalId}</td>
                                <td className="px-6 py-4 font-medium text-slate-900">{w.firstName} {w.lastName}</td>
                                <td className="px-6 py-4">
                                    {w.company ? (
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100 w-fit inline-block">
                                            {w.company.name}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs italic">Sin Empresa</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {w.medicalProfile ? (
                                        <span className="bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs font-bold border border-teal-100 w-fit inline-block">
                                            {w.medicalProfile.name}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs italic">—</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-slate-500 text-xs">{w.email || <span className="text-slate-400">—</span>}</td>
                                <td className="px-6 py-4 text-slate-500 text-xs">{w.phone || <span className="text-slate-400">—</span>}</td>
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
                    medicalProfiles={medicalProfiles}
                    workerToEdit={workerToEdit}
                    isOpen={true}
                    onClose={handleCloseEditModal}
                />
            )}
        </>
    )
}
