'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Report = Awaited<ReturnType<typeof import('@/actions/satisfaction.actions').getSatisfactionReport>>

type Props = {
  initialReport: Report
  companies: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  initialFilters: {
    from: string
    to: string
    companyId: string
    branchId: string
    channel: string
  }
}

function fmt(n: number, digits = 1) {
  return Number.isFinite(n) ? n.toFixed(digits) : '—'
}

export default function SatisfactionReportClient({
  initialReport,
  companies,
  branches,
  initialFilters,
}: Props) {
  const router = useRouter()
  const { kpis, rows } = initialReport

  const applyFilters = (form: HTMLFormElement) => {
    const data = new FormData(form)
    const params = new URLSearchParams()
    for (const [key, value] of data.entries()) {
      if (typeof value === 'string' && value.trim()) params.set(key, value.trim())
    }
    router.push(`/reports/satisfaction?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <form
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-white rounded-2xl border border-slate-100 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          applyFilters(e.currentTarget)
        }}
      >
        <label className="text-xs font-bold text-slate-500 uppercase">
          Desde
          <input
            type="date"
            name="from"
            defaultValue={initialFilters.from}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-500 uppercase">
          Hasta
          <input
            type="date"
            name="to"
            defaultValue={initialFilters.to}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-500 uppercase">
          Empresa
          <select
            name="companyId"
            defaultValue={initialFilters.companyId}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          >
            <option value="">Todas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-500 uppercase">
          Sucursal
          <select
            name="branchId"
            defaultValue={initialFilters.branchId}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          >
            <option value="">Todas</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-500 uppercase">
          Canal
          <select
            name="channel"
            defaultValue={initialFilters.channel}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="TABLET">Tableta</option>
            <option value="WHATSAPP_LINK">WhatsApp</option>
            <option value="DIRECT">Directo</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
          >
            Filtrar
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Respuestas" value={String(kpis.count)} />
        <KpiCard label="Promedio general" value={fmt(kpis.avgOverall)} />
        <KpiCard label="% recomienda ≥4" value={`${fmt(kpis.recommendRate, 0)}%`} />
        <KpiCard label="Trato (avg)" value={fmt(kpis.avgTrato)} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Turno</th>
              <th className="px-4 py-3">Overall</th>
              <th className="px-4 py-3">Recom.</th>
              <th className="px-4 py-3">Canal</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  Sin encuestas con los filtros actuales
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {new Date(row.submittedAt).toLocaleDateString('es-MX')}
                </td>
                <td className="px-4 py-3 font-medium">{row.patientName}</td>
                <td className="px-4 py-3">{row.companyName}</td>
                <td className="px-4 py-3">{row.turno}</td>
                <td className="px-4 py-3">{row.overall}/5</td>
                <td className="px-4 py-3">{row.recomienda}/5</td>
                <td className="px-4 py-3 text-xs">{row.channel}</td>
                <td className="px-4 py-3">
                  <Link href={`/workers/${row.workerId}`} className="text-violet-600 font-semibold hover:underline">
                    Ficha
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  )
}
