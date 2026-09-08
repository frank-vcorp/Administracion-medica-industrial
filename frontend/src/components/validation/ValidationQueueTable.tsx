'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

export type ValidationQueueRow = {
  eventId: string
  sortDate: string
  patientName: string
  universalId: string
  companyId: string | null
  companyName: string
  studies: string[]
  completeness: 'complete' | 'incomplete'
  completenessLabel: string
  completenessBadgeClass: string
  phone: string | null
}

type CompanyOption = { id: string; name: string }
type CompletenessFilter = 'ALL' | 'complete' | 'incomplete'

function formatListDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Props {
  rows: ValidationQueueRow[]
  companies: CompanyOption[]
}

export default function ValidationQueueTable({ rows, companies }: Props) {
  const [search, setSearch] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>('ALL')

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rows
      .filter((row) => {
        if (companyId && row.companyId !== companyId) return false
        if (completenessFilter !== 'ALL' && row.completeness !== completenessFilter) {
          return false
        }
        if (!q) return true

        const studiesText = row.studies.join(' ').toLowerCase()
        return (
          row.patientName.toLowerCase().includes(q) ||
          row.universalId.toLowerCase().includes(q) ||
          row.companyName.toLowerCase().includes(q) ||
          row.eventId.toLowerCase().includes(q) ||
          studiesText.includes(q)
        )
      })
      .sort(
        (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime(),
      )
  }, [rows, search, companyId, completenessFilter])

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex flex-col lg:flex-row gap-3 lg:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
            Buscar
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, ID, empresa, prueba o folio…"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1 min-w-[180px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
            Empresa
          </label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 min-w-[200px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
            Expediente
          </label>
          <select
            value={completenessFilter}
            onChange={(e) => setCompletenessFilter(e.target.value as CompletenessFilter)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Todos</option>
            <option value="complete">Completo</option>
            <option value="incomplete">Incompleto</option>
          </select>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500 font-medium">
        {filteredRows.length} en cola · orden: más reciente primero
      </div>

      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
          <tr>
            <th className="px-6 py-4">Fecha</th>
            <th className="px-6 py-4">Paciente</th>
            <th className="px-6 py-4">ID</th>
            <th className="px-6 py-4">Empresa</th>
            <th className="px-6 py-4">Pruebas</th>
            <th className="px-6 py-4">Semáforo</th>
            <th className="px-6 py-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredRows.length === 0 && (
            <tr>
              <td colSpan={7} className="p-8 text-center text-slate-400">
                No hay expedientes pendientes de validación con los filtros actuales
              </td>
            </tr>
          )}
          {filteredRows.map((row) => {
            const waLink = row.phone
              ? `https://wa.me/${row.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Hola ${row.patientName}, su dictamen de ${row.companyName} está listo. Descárguelo aquí: https://ami.com/d/${row.eventId}`,
                )}`
              : `https://wa.me/?text=${encodeURIComponent(
                  `Hola ${row.patientName}, su dictamen de ${row.companyName} está listo. Descárguelo aquí: https://ami.com/d/${row.eventId}`,
                )}`

            return (
              <tr key={row.eventId} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                  {formatListDate(row.sortDate)}
                </td>
                <td className="px-6 py-4 font-medium text-slate-900">{row.patientName}</td>
                <td className="px-6 py-4 font-mono text-xs text-slate-500">
                  {row.universalId}
                </td>
                <td className="px-6 py-4">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100">
                    {row.companyName}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {row.studies.map((study) => (
                      <span
                        key={`${row.eventId}-${study}`}
                        className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-100"
                      >
                        {study}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${row.completenessBadgeClass}`}
                  >
                    {row.completenessLabel}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/events/${row.eventId}`}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold hover:underline"
                    >
                      Revisar
                    </Link>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold hover:underline"
                      title="Enviar aviso por WhatsApp"
                    >
                      WhatsApp
                    </a>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
