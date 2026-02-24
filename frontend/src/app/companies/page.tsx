import { createCompany, getCompanies } from "@/actions/admin.actions"

export default async function CompaniesPage() {
    const companies = await getCompanies()

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Directorio de Empresas</h2>
                    <p className="text-sm text-slate-500">Gestión de clientes corporativos y convenios (DB Real)</p>
                </div>

                {/* Simple Form Trigger */}
                <label htmlFor="new-company-modal" className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2">
                    <span>+</span> Nueva Empresa
                </label>
            </div>

            {/* Modal Logic (CSS only for MVP speed) */}
            <input type="checkbox" id="new-company-modal" className="peer hidden" />
            <div className="fixed inset-0 bg-black/50 hidden peer-checked:flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Registrar Nueva Empresa</h3>
                        <label htmlFor="new-company-modal" className="cursor-pointer text-slate-400 hover:text-red-500 font-bold">✕</label>
                    </div>
                    <form action={createCompany} className="space-y-4">
                        <input name="name" placeholder="Razón Social" required className="w-full border p-2 rounded" />
                        <input name="rfc" placeholder="RFC" required className="w-full border p-2 rounded" />
                        <input name="contactName" placeholder="Nombre de Contacto" className="w-full border p-2 rounded" />
                        <input name="email" placeholder="Email Contacto" type="email" className="w-full border p-2 rounded" />
                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700 font-medium">
                                Guardar Empresa
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {companies.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        No hay empresas registradas aun.
                    </div>
                )}
                {companies.map(c => (
                    <CompanyCard
                        key={c.id}
                        name={c.name}
                        rfc={c.rfc || 'Sin RFC'}
                        contact={c.contactName || '---'}
                        email={c.email}
                        status="active"
                    />
                ))}
            </div>
        </div>
    )
}

function CompanyCard({ name, rfc, contact, email, status }: any) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    🏢
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Activo
                </span>
            </div>

            <h3 className="font-bold text-slate-800 text-lg mb-1">{name}</h3>
            <p className="text-xs font-mono text-slate-400 mb-4">{rfc}</p>

            <div className="space-y-2 border-t border-slate-50 pt-3">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Contacto</span>
                    <span className="font-medium text-slate-700">{contact}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Email</span>
                    <span className="font-medium text-slate-700">{email || '-'}</span>
                </div>
            </div>

            <div className="mt-4 pt-3 flex gap-2">
                <button className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-1.5 rounded text-xs font-medium transition-colors">
                    Editar
                </button>
                <button className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-1.5 rounded text-xs font-medium transition-colors">
                    Convenios
                </button>
            </div>
        </div>
    )
}
