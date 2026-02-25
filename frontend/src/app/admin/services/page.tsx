import { getServices, createService } from "@/actions/admin.actions"

export default async function AdminServicesPage() {
    const services = await getServices()

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Catálogo de Servicios</h2>
                    <p className="text-sm text-slate-500">Estudios clínicos, laboratorio y gabinete disponibles.</p>
                </div>

                <label htmlFor="new-service-modal" className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2">
                    <span>+</span> Nuevo Servicio
                </label>
            </div>

            {/* Modal Logic */}
            <input type="checkbox" id="new-service-modal" className="peer hidden" />
            <div className="fixed inset-0 bg-black/50 hidden peer-checked:flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Registrar Servicio</h3>
                        <label htmlFor="new-service-modal" className="cursor-pointer text-slate-400 hover:text-red-500 font-bold">✕</label>
                    </div>
                    <form action={createService} className="space-y-4">
                        <input name="name" placeholder="Nombre (ej. Audiometría Tonal)" required className="w-full border p-2 rounded" />
                        <div className="grid grid-cols-2 gap-4">
                            <input name="code" placeholder="Código Interno (ej. AUD-01)" required className="w-full border p-2 rounded" />
                            <select name="category" className="w-full border p-2 rounded" required>
                                <option value="">Categoría</option>
                                <option value="Medical">Consulta Médica</option>
                                <option value="Lab">Laboratorio Clínico</option>
                                <option value="XRay">Rayos X / Imagen</option>
                                <option value="Audio">Audiometría</option>
                                <option value="Spiro">Espirometría</option>
                                <option value="Other">Otro</option>
                            </select>
                        </div>
                        <input type="number" step="0.01" name="price" placeholder="Precio Base ($)" className="w-full border p-2 rounded" />
                        <textarea name="description" placeholder="Descripción breve" rows={3} className="w-full border p-2 rounded"></textarea>

                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium">
                                Guardar Servicio
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Código</th>
                            <th className="px-6 py-4">Servicio</th>
                            <th className="px-6 py-4">Categoría</th>
                            <th className="px-6 py-4 text-right">Precio</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {services.map((srv) => (
                            <tr key={srv.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-slate-400 text-xs">{srv.code}</td>
                                <td className="px-6 py-4 font-medium text-slate-900">{srv.name}</td>
                                <td className="px-6 py-4 text-slate-500">{srv.category}</td>
                                <td className="px-6 py-4 text-right font-medium">
                                    ${Number(srv.price || 0).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-400 hover:text-blue-600 font-medium text-xs">
                                        Editar
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {services.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                    Aún no hay servicios registrados en el catálogo.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
