import { createBranch, getBranches } from "@/actions/admin.actions"

export default async function BranchesPage() {
    const branches = await getBranches()

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Sucursales AMI</h2>
                    <p className="text-sm text-slate-500">Gestión de sedes y puntos de atención (DB Real)</p>
                </div>

                <label htmlFor="new-branch-modal" className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2">
                    <span>+</span> Nueva Sucursal
                </label>
            </div>

            {/* Modal Logic */}
            <input type="checkbox" id="new-branch-modal" className="peer hidden" />
            <div className="fixed inset-0 bg-black/50 hidden peer-checked:flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Registrar Sucursal</h3>
                        <label htmlFor="new-branch-modal" className="cursor-pointer text-slate-400 hover:text-red-500 font-bold">✕</label>
                    </div>
                    <form action={createBranch} className="space-y-4">
                        <input name="name" placeholder="Nombre Sede" required className="w-full border p-2 rounded" />
                        <input name="address" placeholder="Dirección Completa" required className="w-full border p-2 rounded" />
                        <div className="grid grid-cols-2 gap-4">
                            <input name="phone" placeholder="Teléfono" className="border p-2 rounded" />
                            <input name="managerName" placeholder="Encargado" className="border p-2 rounded" />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="flex flex-col">
                                <label className="text-xs text-slate-500 mb-1">Apertura</label>
                                <input type="time" name="openingTime" defaultValue="07:00" required className="border p-2 rounded" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs text-slate-500 mb-1">Cierre</label>
                                <input type="time" name="closingTime" defaultValue="17:00" required className="border p-2 rounded" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs text-slate-500 mb-1">Capacidad/Hr</label>
                                <input type="number" name="hourlyCapacity" defaultValue="15" min="1" required className="border p-2 rounded" />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 font-medium">
                                Guardar Sede
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {branches.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        No hay sucursales registradas.
                    </div>
                )}
                {branches.map(b => (
                    <BranchCard
                        key={b.id}
                        name={b.name}
                        address={b.address}
                        phone={b.phone || 'N/A'}
                        manager={b.managerName || 'N/A'}
                        openingTime={b.openingTime}
                        closingTime={b.closingTime}
                        hourlyCapacity={b.hourlyCapacity}
                    />
                ))}
            </div>
        </div>
    )
}

function BranchCard({ name, address, phone, manager, openingTime, closingTime, hourlyCapacity }: { name: string, address: string | null, phone: string, manager: string, openingTime: string, closingTime: string, hourlyCapacity: number }) {
    return (
        <div className="bg-white p-0 rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
            <div className="h-24 bg-slate-100 flex items-center justify-center text-4xl border-b border-slate-100">
                🏥
            </div>
            <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800 text-lg">{name}</h3>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Activa</span>
                </div>
                <p className="text-sm text-slate-500 mb-4">{address}</p>

                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                        <span>📞</span> {phone}
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                        <span>👨‍⚕️</span> {manager}
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                        <span>⏱️</span> {openingTime} - {closingTime}
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                        <span>👥</span> {hourlyCapacity} pacientes / hora
                    </div>
                </div>

                <div className="mt-6 flex gap-2">
                    <button className="flex-1 border border-slate-200 text-slate-600 py-1.5 rounded text-xs font-medium hover:bg-slate-50">Configurar</button>
                </div>
            </div>
        </div>
    )
}
