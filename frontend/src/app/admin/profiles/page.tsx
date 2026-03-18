import { getProfiles, createProfile } from "@/actions/admin.actions"

export default async function AdminProfilesPage() {
    const profiles = await getProfiles()

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Perfiles de Servicio (Baterías)</h2>
                    <p className="text-sm text-slate-500">Agrupaciones de estudios para venta corporativa.</p>
                </div>

                <label htmlFor="new-profile-modal" className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2">
                    <span>+</span> Nuevo Perfil
                </label>
            </div>

            {/* Modal Logic */}
            <input type="checkbox" id="new-profile-modal" className="peer hidden" />
            <div className="fixed inset-0 bg-black/50 hidden peer-checked:flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Crear Nueva Batería</h3>
                        <label htmlFor="new-profile-modal" className="cursor-pointer text-slate-400 hover:text-red-500 font-bold">✕</label>
                    </div>
                    <form action={createProfile} className="space-y-4">
                        <input name="name" placeholder="Nombre (ej. Batería Ingreso Operativo)" required className="w-full border p-2 rounded" />
                        <textarea name="description" placeholder="Descripción breve" rows={3} className="w-full border p-2 rounded"></textarea>

                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium">
                                Guardar Perfil
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map((profile) => (
                    <div key={profile.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-slate-800 text-lg">{profile.name}</h3>
                            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full">{profile.ProfileServices.length} Serv.</span>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">{profile.description || 'Sin descripción'}</p>

                        <div className="pt-4 border-t border-slate-100 flex gap-2">
                            <button className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-600 py-1.5 rounded text-xs font-medium transition-colors">
                                Gestionar Servicios
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {profiles.length === 0 && (
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-400">
                    No has creado ningún Perfil o Batería de Servicios.
                </div>
            )}
        </div>
    )
}
