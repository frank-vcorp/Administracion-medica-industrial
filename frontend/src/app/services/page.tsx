import { createService, getServices } from "@/actions/admin.actions"

export default async function ServicesPage() {
    const services = await getServices()

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Catálogo de Servicios</h2>
                    <p className="text-sm text-slate-500">Estudios, Laboratorios y Paquetes (DB Real)</p>
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
                        <h3 className="text-lg font-bold">Nuevo Servicio Médico</h3>
                        <label htmlFor="new-service-modal" className="cursor-pointer text-slate-400 hover:text-red-500 font-bold">✕</label>
                    </div>
                    <form action={createService} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <input name="code" placeholder="Código (ej. AUD-01)" required className="border p-2 rounded" />
                            <select name="category" className="border p-2 rounded">
                                <option value="Medical">Estudio Médico</option>
                                <option value="Lab">Laboratorio</option>
                                <option value="Package">Batería</option>
                            </select>
                        </div>
                        <input name="name" placeholder="Nombre del Servicio" required className="w-full border p-2 rounded" />
                        <input name="price" placeholder="Precio Base" type="number" step="0.01" className="w-full border p-2 rounded" />
                        <textarea name="description" placeholder="Descripción técnica..." className="w-full border p-2 rounded h-20"></textarea>

                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium">
                                Guardar Servicio
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex border-b border-slate-200">
                    <button className="px-6 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600">Catálogo General</button>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">Código</th>
                            <th className="px-6 py-4">Nombre del Servicio</th>
                            <th className="px-6 py-4">Categoría</th>
                            <th className="px-6 py-4">Precio Base</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {services.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Sin servicios registrados</td></tr>
                        )}
                        {services.map(s => (
                            <ServiceRow key={s.id} code={s.code} name={s.name} category={s.category || 'General'} price={`$${s.price || '0'}`} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function ServiceRow({ code, name, category, price }: { code: string, name: string, category: string, price: string }) {
    return (
        <tr className="hover:bg-slate-50 transition-colors group">
            <td className="px-6 py-4 font-mono text-xs text-slate-500">{code}</td>
            <td className="px-6 py-4 font-medium text-slate-900">{name}</td>
            <td className="px-6 py-4">
                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs">{category}</span>
            </td>
            <td className="px-6 py-4 text-slate-700">{price}</td>
            <td className="px-6 py-4 text-right">
                <button className="text-blue-600 hover:underline text-xs mr-3">Editar</button>
            </td>
        </tr>
    )
}
