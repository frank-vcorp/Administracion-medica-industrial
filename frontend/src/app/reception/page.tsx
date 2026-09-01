/**
 * @intervention IMPL-20260527-01
 * @see context/interconsultas/HANDOFF_ARCH-20260527-11_SOFIA_SLICE-A-TRAZABILIDAD-EVENT.md
 */
import { getEventsKanban } from "@/actions/event.actions"
import { getWorkers } from "@/actions/worker.actions"
import CheckInModal from "@/components/CheckInModal"
import QRScannerModal from "@/components/QRScannerModal"
import StatusUpdateButton from "@/components/StatusUpdateButton"
import ReceptionDayFilter from "@/components/reception/ReceptionDayFilter"
import prisma from "@/lib/prisma"
import Link from "next/link"

export const dynamic = 'force-dynamic'

type IntakeSourceBadge = {
    label: string
    tone: string
}

function todayLocalDateString(): string {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function formatDayLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    })
}

function getIntakeSourceBadge(event: { intakeSource?: string | null, appointmentId?: string | null }): IntakeSourceBadge {
    const source = event.intakeSource ?? (event.appointmentId ? 'APPOINTMENT' : null)

    switch (source) {
        case 'APPOINTMENT':
            return { label: 'Programado', tone: 'bg-sky-50 text-sky-700 border-sky-200' }
        case 'PROJECT_PRE_REGISTERED':
            return { label: 'Proyecto', tone: 'bg-violet-50 text-violet-700 border-violet-200' }
        case 'PROJECT_SAME_DAY':
            return { label: 'Proyecto hoy', tone: 'bg-amber-50 text-amber-700 border-amber-200' }
        case 'EXTERNAL_WALK_IN':
            return { label: 'Externo', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
        case 'DIRECT_RECEPTION':
            return { label: 'Recepción', tone: 'bg-slate-100 text-slate-700 border-slate-200' }
        default:
            return { label: 'Legado', tone: 'bg-white text-slate-500 border-slate-200' }
    }
}

export default async function ReceptionPage(props: { searchParams: Promise<{ date?: string }> }) {
    const searchParams = await props.searchParams
    const selectedDate =
        searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
            ? searchParams.date
            : todayLocalDateString()

    const { scheduled, inProgress, completed } = await getEventsKanban(selectedDate)
    const totalCount = scheduled.length + inProgress.length + completed.length

    const [allWorkers, branches] = await Promise.all([
        getWorkers(),
        prisma.branch.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
    ])

    return (
        <div className="space-y-8 h-[calc(100vh-100px)] flex flex-col pb-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Flujo de pacientes en tiempo real</h2>
                    <p className="text-sm text-slate-500 font-medium">
                        Recepción, triaje y flujo clínico ·{' '}
                        <span className="capitalize text-slate-700">{formatDayLabel(selectedDate)}</span>
                        {' · '}
                        <span className="font-bold text-slate-600">{totalCount} paciente{totalCount !== 1 ? 's' : ''}</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <ReceptionDayFilter selectedDate={selectedDate} />
                    <QRScannerModal />
                    <CheckInModal workers={allWorkers} branches={branches} />
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-8 overflow-hidden min-h-0">
                <Lane title="Registro de pruebas" count={scheduled.length} color="bg-slate-50/50" borderColor="border-slate-200" icon="👥">
                    {scheduled.length === 0 ? (
                        <EmptyLane message="Sin pacientes en registro para este día" />
                    ) : (
                        scheduled.map(e => <PatientCard key={e.id} event={e} status="waiting" nextStatus="IN_PROGRESS" />)
                    )}
                </Lane>
                <Lane title="en proceso de prueba" count={inProgress.length} color="bg-indigo-50/30" borderColor="border-indigo-100" icon="🩺">
                    {inProgress.length === 0 ? (
                        <EmptyLane message="Nadie en proceso para este día" />
                    ) : (
                        inProgress.map(e => <PatientCard key={e.id} event={e} status="progress" />)
                    )}
                </Lane>
                <Lane title="Por dictaminar" count={completed.length} color="bg-emerald-50/30" borderColor="border-emerald-100" icon="🛡️">
                    {completed.length === 0 ? (
                        <EmptyLane message="Sin expedientes por dictaminar hoy" />
                    ) : (
                        completed.map(e => <PatientCard key={e.id} event={e} status="done" />)
                    )}
                </Lane>
            </div>
        </div>
    )
}

function EmptyLane({ message }: { message: string }) {
    return (
        <p className="text-center text-slate-400 text-xs font-medium italic py-8 px-2">
            {message}
        </p>
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
        intakeSource?: string | null,
        appointmentId?: string | null,
        checkInDate?: Date | null,
        worker: { firstName: string, lastName: string, company: { name: string } | null }
    },
    status: 'waiting' | 'progress' | 'done',
    nextStatus?: 'IN_PROGRESS' | 'VALIDATING'
}) {
    const workerName = event.worker ? `${event.worker.firstName} ${event.worker.lastName}` : "Desconocido"
    const companyName = event.worker?.company?.name || 'Empresa Vinculada'
    const intakeBadge = getIntakeSourceBadge(event)
    const checkInTime = event.checkInDate
        ? new Date(event.checkInDate).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        : null

    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 hover:border-indigo-200 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-bl-full"></div>

            <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{workerName}</span>
                <span className="text-[10px] font-black text-slate-300 font-mono">#{event.id.slice(0, 4)}</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 mb-1">{companyName}</p>
            {checkInTime && (
                <p className="text-[10px] text-slate-400 mb-3">Ingreso {checkInTime}</p>
            )}
            <div className="mb-4">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${intakeBadge.tone}`}>
                    {intakeBadge.label}
                </span>
            </div>

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
