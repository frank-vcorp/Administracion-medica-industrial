import Link from 'next/link'
import prisma from "@/lib/prisma"

export const dynamic = 'force-dynamic'

async function getEvents() {
    return await prisma.medicalEvent.findMany({
        include: {
            worker: {
                include: { company: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })
}

export default async function EventsIndexPage() {
    const events = await getEvents()

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Expedientes Activos</h2>
                <div className="flex gap-2">
                    <input type="text" placeholder="Buscar trabajador..." className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-64 focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">Folio</th>
                            <th className="px-6 py-4">Trabajador</th>
                            <th className="px-6 py-4">Empresa</th>
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {events.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">Sin expedientes en curso</td></tr>
                        )}
                        {events.map(event => (
                            <EventRow
                                key={event.id}
                                id={event.id}
                                name={`${event.worker.firstName} ${event.worker.lastName}`}
                                company={event.worker.company?.name || '---'}
                                date={event.createdAt.toLocaleDateString() + ' ' + event.createdAt.toLocaleTimeString()}
                                status={event.status.toLowerCase()}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function EventRow({ id, name, company, date, status }: { id: string, name: string, company: string, date: string, status: string }) {
    const statusMap: Record<string, { label: string, class: string }> = {
        'scheduled': { label: 'Agendado', class: 'bg-slate-100 text-slate-600' },
        'checked_in': { label: 'En Sala', class: 'bg-amber-100 text-amber-700' },
        'in_progress': { label: 'En Curso', class: 'bg-blue-100 text-blue-700' },
        'validating': { label: 'Validando', class: 'bg-purple-100 text-purple-700' },
        'completed': { label: 'Completado', class: 'bg-emerald-100 text-emerald-700' }
    }

    const badge = statusMap[status] || { label: status, class: 'bg-gray-100' }

    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="px-6 py-4 font-mono text-xs text-slate-500">#{id.slice(0, 8)}</td>
            <td className="px-6 py-4 font-medium text-slate-900">{name}</td>
            <td className="px-6 py-4 text-slate-500">{company}</td>
            <td className="px-6 py-4 text-slate-500">{date}</td>
            <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded text-xs font-bold ${badge.class}`}>
                    {badge.label}
                </span>
            </td>
            <td className="px-6 py-4 text-right">
                <Link href={`/events/${id}`} className="text-teal-600 hover:text-teal-700 font-medium hover:underline">
                    Abrir Expediente &rarr;
                </Link>
            </td>
        </tr>
    )
}
