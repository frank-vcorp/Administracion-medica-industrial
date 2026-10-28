'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Report = Awaited<
  ReturnType<typeof import('@/actions/satisfaction.actions').getSatisfactionReport>
>

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

export default function SatisfactionChartsClient({
  initialReport,
  companies,
  branches,
  initialFilters,
}: Props) {
  const router = useRouter()
  const { rows, kpis } = initialReport

  const distribution = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: rows.filter((r) => r.overall === score).length,
  }))
  const maxDist = Math.max(1, ...distribution.map((d) => d.count))

  const byMonth = new Map<string, { sum: number; n: number }>()
  for (const row of rows) {
    const d = new Date(row.submittedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const prev = byMonth.get(key) ?? { sum: 0, n: 0 }
    byMonth.set(key, { sum: prev.sum + row.overall, n: prev.n + 1 })
  }
  const monthSeries = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { sum, n }]) => ({
      key,
      label: (() => {
        const [y, m] = key.split('-').map(Number)
        return new Date(y, m - 1, 1).toLocaleDateString('es-MX', {
          month: 'short',
          year: '2-digit',
        })
      })(),
      avg: n ? sum / n : 0,
      n,
    }))
  const maxAvg = Math.max(1, ...monthSeries.map((m) => m.avg))

  const applyFilters = (form: HTMLFormElement) => {
    const data = new FormData(form)
    const params = new URLSearchParams()
    for (const [key, value] of data.entries()) {
      if (typeof value === 'string' && value.trim()) params.set(key, value.trim())
    }
    router.push(`/reports/satisfaction/charts?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/reports/satisfaction"
          className="text-sm font-semibold text-violet-700 hover:underline"
        >
          ← Tabla y KPIs
        </Link>
      </div>

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
        <label className="text-xs font-bold text-slate-500 uppercase md:col-span-2">
          Canal
          <select
            name="channel"
            defaultValue={initialFilters.channel}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="TABLET">Tablet</option>
            <option value="WHATSAPP_LINK">WhatsApp</option>
            <option value="DIRECT">Directo</option>
          </select>
        </label>
        <div className="md:col-span-6">
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
          >
            Filtrar gráficas
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Respuestas" value={String(kpis.count)} />
        <KpiCard label="Promedio general" value={fmt(kpis.avgOverall)} />
        <KpiCard label="% recomienda ≥4" value={`${fmt(kpis.recommendRate, 0)}%`} />
        <KpiCard label="Trato (avg)" value={fmt(kpis.avgTrato)} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-4">
            Distribución calificación general (1–5)
          </h3>
          <div className="space-y-2">
            {distribution.map(({ score, count }) => (
              <div key={score} className="flex items-center gap-2">
                <span className="w-6 text-xs font-bold text-slate-600">{score}</span>
                <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${(count / maxDist) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-slate-500 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-4">
            Promedio mensual (overall)
          </h3>
          {monthSeries.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos en el periodo.</p>
          ) : (
            <div className="space-y-2">
              {monthSeries.map((m) => (
                <div key={m.key} className="flex items-center gap-2">
                  <span className="w-16 text-xs font-semibold text-slate-600 capitalize">
                    {m.label}
                  </span>
                  <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(m.avg / maxAvg) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-xs font-bold text-slate-700 text-right">
                    {fmt(m.avg)} <span className="font-normal text-slate-400">({m.n})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
