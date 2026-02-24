export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Bienvenido, Dr. Usuario</h2>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard title="Pacientes Hoy" value="24" icon="👥" color="blue" />
                <StatCard title="Evaluaciones Completas" value="18" icon="✅" color="green" />
                <StatCard title="Pendientes de Lab" value="6" icon="🧪" color="yellow" />
                <StatCard title="Dictámenes Emitidos" value="12" icon="📝" color="purple" />
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4">Actividad Reciente</h3>
                <div className="space-y-3">
                    <ActivityRow user="Juan Pérez" action="Check-in completado" time="10:00 AM" />
                    <ActivityRow user="Maria López" action="Resultados de Lab cargados" time="09:45 AM" />
                    <ActivityRow user="Carlos Ruiz" action="Evaluación Médica iniciada" time="09:30 AM" />
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, icon, color }: any) {
    const colors = {
        blue: "bg-blue-50 text-blue-600",
        green: "bg-emerald-50 text-emerald-600",
        yellow: "bg-amber-50 text-amber-600",
        purple: "bg-purple-50 text-purple-600"
    } as any

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-500 font-medium">{title}</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${colors[color]}`}>
                    {icon}
                </div>
            </div>
        </div>
    )
}

function ActivityRow({ user, action, time }: any) {
    return (
        <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                    {user.charAt(0)}
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-800">{user}</p>
                    <p className="text-xs text-slate-500">{action}</p>
                </div>
            </div>
            <span className="text-xs text-slate-400">{time}</span>
        </div>
    )
}
