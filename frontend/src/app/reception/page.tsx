import { createEvent, getEventsKanban } from "@/actions/event.actions"
import { getWorkers } from "@/actions/worker.actions"

export default async function ReceptionPage() {
    const { scheduled, inProgress, completed } = await getEventsKanban()
    const allWorkers = await getWorkers() // For the dropdown in modal

    return (
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Recepción / Triage</h2>
                    <p className="text-sm text-slate-500">Gestión de flujo de pacientes</p>
                </div>

                <label htmlFor="new-appt-modal" className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2">
                    <span>➕</span> Nueva Cita / Ingreso
                </label>
            </div>

            {/* --- MODAL NUEVA CITA --- */}
            <input type="checkbox" id="new-appt-modal" className="peer hidden" />
            <div className="fixed inset-0 bg-black/50 hidden peer-checked:flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Ingreso de Paciente</h3>
                        <label htmlFor="new-appt-modal" className="cursor-pointer text-slate-400 hover:text-red-500 font-bold">✕</label>
                    </div>
                    <form action={createEvent} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">Seleccionar Trabajador</label>
                            <select name="workerId" required className="w-full border p-2 rounded bg-white">
                                <option value="">Buscar por nombre...</option>
                                {allWorkers.map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.firstName} {w.lastName} ({w.company?.name || 'Sin Empresa'})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">* Si no aparece, regístralo primero en módulo de Trabajadores.</p>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <h4 className="text-sm font-bold text-blue-800 mb-1">Detalles de Visita</h4>
                            <p className="text-xs text-blue-600">Se registrará el Check-In en la sucursal actual automáticamente.</p>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded shadow hover:bg-slate-800 font-medium w-full">
                                Confirmar Check-In 🏥
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
                <Lane title="En Sala de Espera" count={scheduled.length} color="bg-slate-100" borderColor="border-slate-300">
                    {scheduled.map(e => <PatientCard key={e.id} event={e} status="waiting" />)}
                </Lane>
                <Lane title="En Consultorio / Estudios" count={inProgress.length} color="bg-blue-50" borderColor="border-blue-200">
                    {inProgress.map(e => <PatientCard key={e.id} event={e} status="progress" />)}
                </Lane>
                <Lane title="Finalizados" count={completed.length} color="bg-emerald-50" borderColor="border-emerald-200">
                    {completed.map(e => <PatientCard key={e.id} event={e} status="done" />)}
                </Lane>
            </div>
        </div>
    )
}

function Lane({ title, count, children, color, borderColor }: any) {
    return (
        <div className={`flex flex-col h-full rounded-xl ${color} border-t-4 ${borderColor} p-4`}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700">{title}</h3>
                <span className="bg-white/50 text-slate-600 px-2 py-0.5 rounded text-xs font-bold shadow-sm">{count}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                {children}
            </div>
        </div>
    )
}

function PatientCard({ event, status }: any) {
    const workerName = event.worker ? `${event.worker.firstName} ${event.worker.lastName}` : "Desconocido"
    // Mock company name visual as it's not eager loaded deep in this quick implementation, or we can assume worker has it.
    // For MVP we just show the name.

    const statusMeta = {
        waiting: { time: '10:30 AM', badge: 'bg-amber-100 text-amber-700' },
        progress: { time: '10:45 AM', badge: 'bg-blue-100 text-blue-700' },
        done: { time: '11:15 AM', badge: 'bg-emerald-100 text-emerald-700' },
    } as any

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-grab hover:shadow-md transition-all active:cursor-grabbing">
            <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-slate-800 text-sm">{workerName}</span>
                <span className="text-xs font-mono text-slate-400">#{event.id.slice(0, 4)}</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">Empresa Vinculada</p> {/* Future: Load real company name */}

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400" title="Pendiente"></span>
                    <span className="w-2 h-2 rounded-full bg-slate-200" title="Pendiente"></span>
                    <span className="w-2 h-2 rounded-full bg-slate-200" title="Pendiente"></span>
                </div>
                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-medium">
                    Ingreso
                </span>
            </div>
        </div>
    )
}
