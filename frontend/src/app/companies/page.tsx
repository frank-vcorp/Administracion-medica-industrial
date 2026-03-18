export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getCompanies } from "@/actions/admin.actions"
import CompanyFormModal from "@/components/CompanyFormModal"

export default async function CompaniesPage() {
    const companies = await getCompanies()

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Directorio de Empresas</h2>
                    <p className="text-sm text-slate-500 font-medium">Gestión de clientes corporativos y convenios activos.</p>
                </div>

                <CompanyFormModal />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {companies.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        No hay empresas registradas aun.
                    </div>
                )}
                {companies.map(c => (
                    <CompanyCard
                        key={c.id}
                        id={c.id}
                        name={c.name}
                        rfc={c.rfc || 'Sin RFC'}
                        contact={c.contactName || '---'}
                        email={c.email}
                        defaultBranch={c.defaultBranch?.name}
                    />
                ))}
            </div>
        </div>
    )
}

function CompanyCard({ id, name, rfc, contact, email, defaultBranch }: { id: string, name: string, rfc: string, contact: string, email: string | null, defaultBranch?: string }) {
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
                {defaultBranch && (
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Sucursal</span>
                        <span className="font-medium text-slate-700">{defaultBranch}</span>
                    </div>
                )}
            </div>

            <div className="mt-4 pt-3 flex gap-2">
                <button className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-1.5 rounded text-xs font-medium transition-colors">
                    Editar
                </button>
                <Link
                    href={`/companies/${id}`}
                    className="flex-1 text-center bg-slate-900 hover:bg-slate-800 text-white py-1.5 rounded text-xs font-medium transition-colors"
                >
                    Puestos de Trabajo
                </Link>
            </div>
        </div>
    )
}
