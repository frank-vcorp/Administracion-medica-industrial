export const dynamic = 'force-dynamic'

import { getWorkers } from "@/actions/worker.actions"
import { getCompanies } from "@/actions/admin.actions"
import WorkerFormModal from "@/components/WorkerFormModal"
import Link from "next/link"

export default async function WorkersPage() {
    const workers = await getWorkers()
    const companies = await getCompanies()

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Padrón de Trabajadores</h2>
                    <p className="text-sm text-slate-500 font-medium">Gestión integral de empleados y afiliaciones.</p>
                </div>

                <WorkerFormModal companies={companies} />
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">ID Universal</th>
                            <th className="px-6 py-4">Nombre Completo</th>
                            <th className="px-6 py-4">Empresa Asignada</th>
                            <th className="px-6 py-4">Contacto</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {workers.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Sin trabajadores registrados</td></tr>
                        )}
                        {workers.map(w => (
                            <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs text-slate-500">{w.universalId}</td>
                                <td className="px-6 py-4 font-medium text-slate-900">{w.firstName} {w.lastName}</td>
                                <td className="px-6 py-4">
                                    {w.company ? (
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100">
                                            {w.company.name}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs italic">Sin Asignar</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-slate-500 text-xs">{w.email || w.phone || '-'}</td>
                                <td className="px-6 py-4 text-right">
                                    <Link href={`/history/${w.id}`} className="text-blue-600 hover:underline text-xs">Historial</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
