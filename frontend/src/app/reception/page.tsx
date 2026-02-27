import { getEventsKanban } from "@/actions/event.actions"
import { getWorkers } from "@/actions/worker.actions"
import CheckInModal from "@/components/CheckInModal"
import QRScannerModal from "@/components/QRScannerModal"
import StatusUpdateButton from "@/components/StatusUpdateButton"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function ReceptionPage() {
    const { scheduled, inProgress, completed } = await getEventsKanban()
    const allWorkers = await getWorkers() // For the dropdown in modal

    return (
        <div className="space-y-8 h-[calc(100vh-100px)] flex flex-col pb-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Centro de Control</h2>
                    <p className="text-sm text-slate-500 font-medium">Recepción, Triage y Flujo de Pacientes en Tiempo Real.</p>
                </div>

                <div className="flex gap-3">
                    <QRScannerModal />
                    <CheckInModal workers={allWorkers} />
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-8 overflow-hidden">
                <Lane title="SALA DE ESPERA" count={scheduled.length} color="bg-slate-50/50" borderColor="border-slate-200" icon="👥">
                    {scheduled.map(e => <PatientCard key={e.id} event={e} status="waiting" nextStatus="IN_PROGRESS" />)}
                </Lane>
                <Lane title="EN CONSULTORIO" count={inProgress.length} color="bg-indigo-50/30" borderColor="border-indigo-100" icon="🩺">
                    {inProgress.map(e => <PatientCard key={e.id} event={e} status="progress" />)}
                </Lane>
                <Lane title="POR VALIDAR" count={completed.length} color="bg-emerald-50/30" borderColor="border-emerald-100" icon="🛡️">
                    {completed.map(e => <PatientCard key={e.id} event={e} status="done" />)}
                </Lane>
            </div>
        </div>
    )
}

function Lane({ title, count, children, color, borderColor, icon }: { title: string, count: number, children: React.ReactNode, color: string, borderColor: string, icon: string }) {
    return (
        <div className={`flex flex-col h-full rounded-3xl ${color} border ${borderColor} p-6 shadow-sm overflow-hidden relative`}>
            <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <h3 className="font-black text-slate-400 text-[10px] tracking-[0.2em] uppercase">{title}</h3>
                </div>
                <span className="bg-white text-slate-800 px-3 py-1 rounded-full text-xs font-black shadow-sm border border-slate-50">{count}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin relative z-10">
                {children}
            </div>
        </div>
    )
}

function PatientCard({ event, status, nextStatus }: {
    event: {
        id: string,
        worker: { firstName: string, lastName: string, company: { name: string } | null }
    },
    status: 'waiting' | 'progress' | 'done',
    nextStatus?: 'IN_PROGRESS' | 'VALIDATING'
}) {
    const workerName = event.worker ? `${event.worker.firstName} ${event.worker.lastName}` : "Desconocido"
    const companyName = event.worker?.company?.name || 'Empresa Vinculada'
    // Mock company name visual as it's not eager loaded deep in this quick implementation, or we can assume worker has it.
    // For MVP we just show the name.

    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 hover:border-indigo-200 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-bl-full"></div>

            <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{workerName}</span>
                <span className="text-[10px] font-black text-slate-300 font-mono">#{event.id.slice(0, 4)}</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 mb-4">{companyName}</p>

            <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-50">
                <div className="flex gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${status === 'waiting' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></span>
                    <div className="flex -space-x-1">
                        <div className="w-4 h-4 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[7px]">📄</div>
                        <div className="w-4 h-4 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[7px]">🧪</div>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    {nextStatus && (
                        <StatusUpdateButton eventId={event.id} nextStatus={nextStatus} />
                    )}
                    <Link href={`/events/${event.id}`} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                        Abrir <span className="text-xs">→</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
