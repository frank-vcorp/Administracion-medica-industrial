export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Reportes y Analítica</h2>
                    <p className="text-sm text-slate-500">Generación de informes para empresas y control interno</p>
                </div>
                <div className="flex gap-2">
                    <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option>Últimos 30 días</option>
                        <option>Este Mes</option>
                        <option>Año Actual</option>
                    </select>
                    <button className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow">
                        Descargar PDF
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatBox label="Total Atenciones" value="1,240" trend="+12%" />
                <StatBox label="Aptos" value="980" trend="+5%" />
                <StatBox label="No Aptos / Condicionados" value="260" trend="-2%" color="red" />
                <StatBox label="Ingresos" value="$450k" trend="+8%" color="green" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Report Types */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4">Reportes Operativos</h3>
                    <div className="space-y-3">
                        <ReportItem title="Resumen Diario de Servicios" desc="Detalle por sucursal y médico" icon="📊" />
                        <ReportItem title="Tiempos de Espera" desc="Análisis de cuellos de botella" icon="⏱️" />
                        <ReportItem title="Productividad Médica" desc="Servicios por personal de salud" icon="👨‍⚕️" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4">Reportes de Salud Ocupacional (Empresas)</h3>
                    <div className="space-y-3">
                        <ReportItem title="Diagnóstico de Salud Poblacional" desc="Morbilidad por empresa" icon="🏥" />
                        <ReportItem title="Auditoría de Expedientes" desc="Cumplimiento normativo" icon="✅" />
                        <ReportItem title="Matriz de Riesgos Detectados" desc="Hipoacusia, Ergonómicos, etc." icon="⚠️" />
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatBox({ label, value, trend, color }: { label: string, value: string, trend: string, color?: 'red' | 'green' }) {
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 uppercase font-semibold">{label}</p>
            <div className="flex items-end justify-between mt-2">
                <span className="text-2xl font-bold text-slate-800">{value}</span>
                <span className={`text-xs font-bold ${color === 'red' ? 'text-red-500' : 'text-emerald-500'}`}>{trend}</span>
            </div>
        </div>
    )
}

function ReportItem({ title, desc, icon }: { title: string, desc: string, icon: string }) {
    return (
        <div className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100 group">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xl group-hover:bg-blue-100 transition-colors">
                {icon}
            </div>
            <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-700">{title}</h4>
                <p className="text-xs text-slate-500">{desc}</p>
            </div>
            <button className="text-slate-300 hover:text-blue-600">⬇️</button>
        </div>
    )
}
