import { createWorker, getWorkers } from "@/actions/worker.actions"
import { getCompanies } from "@/actions/admin.actions"

export const dynamic = 'force-dynamic'

export default async function WorkersPage() {
    const workers = await getWorkers()
    const companies = await getCompanies()

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Padron de Trabajadores</h2>
                    <p className="text-sm text-slate-500">Gestión de empleados y afiliación a empresas</p>
                </div>

                <label htmlFor="new-worker-modal" className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2">
                    <span>+</span> Registrar Trabajador
                </label>
            </div>

            {/* Modal Logic */}
            <input type="checkbox" id="new-worker-modal" className="peer hidden" />
            <div className="fixed inset-0 bg-black/50 hidden peer-checked:flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Nuevo Trabajador</h3>
                        <label htmlFor="new-worker-modal" className="cursor-pointer text-slate-400 hover:text-red-500 font-bold">✕</label>
                    </div>
                    <form action={createWorker} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <input name="firstName" placeholder="Nombre(s)" required className="border p-2 rounded" />
                            <input name="lastName" placeholder="Apellidos" required className="border p-2 rounded" />
                        </div>
                        <input name="universalId" placeholder="ID Universal (Empleado #)" required className="w-full border p-2 rounded" />
                        <input name="nationalId" placeholder="CURP / DNI" className="w-full border p-2 rounded" />

                        <div>
                            <label className="text-xs font-bold text-slate-500">Asignar a Empresa</label>
                            <select name="companyId" className="w-full border p-2 rounded mt-1 bg-white">
                                <option value="">-- Sin Asignar --</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <input name="email" placeholder="Email" type="email" className="border p-2 rounded" />
                            <input name="phone" placeholder="Teléfono" className="border p-2 rounded" />
                        </div>

                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 font-medium">
                                Guardar Trabajador
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                                    <button className="text-blue-600 hover:underline text-xs">Historial</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
