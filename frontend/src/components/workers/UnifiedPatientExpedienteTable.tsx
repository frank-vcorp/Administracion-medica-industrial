'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { EventStatus } from '@prisma/client'
import type { PatientExpedienteListRow } from '@/actions/patient-expediente.actions'
import WorkerFormModal, { type WorkerForEdit } from '@/components/WorkerFormModal'
import {
  getEventStatusBadgeClass,
  getEventStatusLabel,
} from '@/lib/clinical/event-status-display'

type CompanyOption = { id: string; name: string }
type MedicalProfileOption = { id: string; name: string; companyId: string | null }

type StatusFilter = EventStatus | 'ALL' | 'NO_EVENT'

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Todos los estatus' },
  { value: 'SCHEDULED', label: 'Agendado' },
  { value: 'CHECKED_IN', label: 'En sala' },
  { value: 'IN_PROGRESS', label: 'En curso' },
  { value: 'VALIDATING', label: 'Validando' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'CANCELED', label: 'Cancelado' },
  { value: 'NO_EVENT', label: 'Sin expediente (padrón)' },
]

function formatListDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toEditPayload(row: PatientExpedienteListRow): WorkerForEdit {
  const w = row.worker
  return {
    id: w.id,
    firstName: w.firstName,
    lastName: w.lastName,
    dob: w.dob,
    email: w.email,
    phone: w.phone,
    companyId: w.companyId,
    medicalProfileId: w.medicalProfileId,
  }
}

interface Props {
  rows: PatientExpedienteListRow[]
  companies: CompanyOption[]
  medicalProfiles: MedicalProfileOption[]
}

export default function UnifiedPatientExpedienteTable({
  rows,
  companies,
  medicalProfiles,
}: Props) {
  const [search, setSearch] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [workerToEdit, setWorkerToEdit] = useState<WorkerForEdit | null>(null)

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rows
      .filter((row) => {
        if (statusFilter === 'NO_EVENT') {
          return row.eventId === null
        }
        if (row.eventId === null) {
          return false
        }
        if (statusFilter !== 'ALL' && row.eventStatus !== statusFilter) {
          return false
        }
        if (companyId && row.worker.companyId !== companyId) {
          return false
        }
        if (!q) return true

        const fullName = `${row.worker.firstName} ${row.worker.lastName}`.toLowerCase()
        const companyName = row.worker.company?.name?.toLowerCase() ?? ''
        return (
          fullName.includes(q) ||
          row.worker.universalId.toLowerCase().includes(q) ||
          companyName.includes(q) ||
          (row.eventId?.toLowerCase().includes(q) ?? false)
        )
      })
      .sort(
        (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime(),
      )
  }, [rows, search, companyId, statusFilter])

  return (
    <>
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
              placeholder="Nombre, ID, empresa o folio…"
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
              Estatus
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500 font-medium">
          {filteredRows.length} registro{filteredRows.length === 1 ? '' : 's'} · orden: más reciente primero
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Paciente</th>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">Estatus</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  Sin registros con los filtros actuales
                </td>
              </tr>
            )}
            {filteredRows.map((row) => {
              const w = row.worker
              const rowKey = row.eventId ?? `worker-${w.id}`

              return (
                <tr key={rowKey} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                    {formatListDate(row.sortDate)}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <Link
                      href={`/workers/${w.id}`}
                      className="hover:text-indigo-600 hover:underline"
                    >
                      {w.firstName} {w.lastName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {w.universalId}
                  </td>
                  <td className="px-6 py-4">
                    {w.company ? (
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100">
                        {w.company.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Sin empresa</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {row.eventStatus ? (
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${getEventStatusBadgeClass(row.eventStatus)}`}
                      >
                        {getEventStatusLabel(row.eventStatus)}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-500">
                        Sin expediente
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 flex-wrap">
                      {row.eventId && (
                        <Link
                          href={`/events/${row.eventId}`}
                          className="text-teal-600 hover:text-teal-800 text-xs font-semibold hover:underline"
                        >
                          Abrir expediente
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => setWorkerToEdit(toEditPayload(row))}
                        className="text-amber-600 hover:text-amber-800 text-xs font-semibold hover:underline"
                      >
                        Editar
                      </button>
                      <Link
                        href={`/appointments?action=new-appointment&workerId=${w.id}${w.companyId ? `&companyId=${w.companyId}` : ''}`}
                        className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold hover:underline"
                      >
                        + Cita
                      </Link>
                      <Link
                        href={`/history/${w.id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Historial
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {workerToEdit && (
        <WorkerFormModal
          companies={companies}
          medicalProfiles={medicalProfiles}
          workerToEdit={workerToEdit}
          isOpen
          onClose={() => setWorkerToEdit(null)}
        />
      )}
    </>
  )
}
