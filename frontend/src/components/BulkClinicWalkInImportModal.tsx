'use client'

/**
 * BulkClinicWalkInImportModal — Alta masiva para clínica física.
 * @id ARCH-20260708-01
 * @see context/SPECs/SPEC_ARCH-20260708-01-PERFILES-PACIENTE-CORREOS-CLONACION.md
 *
 * Diferencia BulkWorkerImportModal (que requiere Project + Unidad Móvil):
 *  - Selector de sucursal (no de proyecto).
 *  - Sin subida de Excel (solo captura rápida tipo quickRegisterWorkersSameDay).
 *  - Hasta 20 filas (no 200).
 *  - Marca intakeSource = 'CLINIC_WALK_IN_MASS' en cada worker creado.
 *  - NO crea Project ni ProjectWorker.
 */

import { useEffect, useState, useTransition, useCallback } from 'react'
import {
  bulkRegisterClinicWalkIn,
  ClinicWalkInRow,
  BulkImportResult,
} from '@/actions/worker.actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BranchOption { id: string; name: string }

interface RowState extends ClinicWalkInRow {
  _status: 'valid' | 'error'
  _statusReason?: string
}

const MAX_ROWS = 20

function createEmptyRow(index: number): RowState {
  return {
    firstName: '',
    lastName: '',
    _rowIndex: index,
    _status: 'valid',
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface BulkClinicWalkInImportModalProps {
  branches: BranchOption[]
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export default function BulkClinicWalkInImportModal({
  branches,
  isOpen: isOpenProp,
  onOpenChange,
  hideTrigger = false,
}: BulkClinicWalkInImportModalProps) {
  const isControlled = isOpenProp !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? isOpenProp : internalOpen

  const [rows, setRows] = useState<RowState[]>([
    createEmptyRow(1),
    createEmptyRow(2),
    createEmptyRow(3),
  ])
  const [branchId, setBranchId] = useState<string>('')
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const resetState = useCallback(() => {
    setRows([createEmptyRow(1), createEmptyRow(2), createEmptyRow(3)])
    setBranchId('')
    setResult(null)
    setErrorMessage(null)
  }, [])

  const closeModal = () => {
    if (isControlled) {
      onOpenChange?.(false)
    } else {
      setInternalOpen(false)
    }
    resetState()
  }

  const openModal = () => {
    resetState()
    if (isControlled) {
      onOpenChange?.(true)
    } else {
      setInternalOpen(true)
    }
  }

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => resetState(), 0)
    return () => window.clearTimeout(timer)
  }, [open, resetState])

  function updateRow(
    index: number,
    field: 'firstName' | 'lastName' | 'dob' | 'nationalId' | 'phone' | 'email' | 'jobPositionName',
    value: string
  ) {
    setRows((current) =>
      current.map((row) => {
        if (row._rowIndex !== index) return row
        return {
          ...row,
          [field]: value || undefined,
          _status: 'valid',
          _statusReason: undefined,
        }
      })
    )
  }

  function addRow() {
    setRows((current) => {
      if (current.length >= MAX_ROWS) return current
      const nextIndex =
        current.length === 0 ? 1 : Math.max(...current.map((r) => r._rowIndex)) + 1
      return [...current, createEmptyRow(nextIndex)]
    })
  }

  function removeRow(index: number) {
    setRows((current) => {
      if (current.length <= 1) return current
      return current.filter((row) => row._rowIndex !== index)
    })
  }

  function validateRows(current: RowState[]): RowState[] {
    return current.map((row) => {
      const errors: string[] = []
      const firstName = (row.firstName || '').trim()
      const lastName = (row.lastName || '').trim()
      if (!firstName) errors.push('Falta nombre')
      if (!lastName) errors.push('Falta apellido')
      if ((row.nationalId ?? '').length > 18) errors.push('CURP demasiado larga (>18)')
      if ((row.phone ?? '').length > 15) errors.push('Teléfono demasiado largo (>15)')
      if (row.email && !isValidEmail(row.email)) errors.push('Correo inválido')
      return {
        ...row,
        firstName,
        lastName,
        _status: errors.length > 0 ? 'error' : 'valid',
        _statusReason: errors.join(' · '),
      }
    })
  }

  function handleSubmit() {
    setErrorMessage(null)
    const validated = validateRows(rows)
    setRows(validated)

    const valid = validated.filter((r) => r._status === 'valid' && r.firstName && r.lastName)
    if (valid.length === 0) {
      setErrorMessage('Corrige los errores antes de registrar llegadas.')
      return
    }

    const payload: ClinicWalkInRow[] = valid.map((r) => ({
      firstName: r.firstName,
      lastName: r.lastName,
      nationalId: r.nationalId,
      dob: r.dob,
      phone: r.phone,
      email: r.email,
      jobPositionName: r.jobPositionName,
      _rowIndex: r._rowIndex,
    }))

    startTransition(async () => {
      const res = await bulkRegisterClinicWalkIn(payload, branchId || null)
      setResult(res)
    })
  }

  const validCount = rows.filter((r) => r._status !== 'error' && r.firstName.trim() && r.lastName.trim()).length
  const errorCount = rows.filter((r) => r._status === 'error').length
  const selectedBranch = branches.find((b) => b.id === branchId)

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
          </svg>
          Carga Masiva — Clínica Física
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">Alta Masiva — Clínica Física (mostrador)</h2>
                <p className="text-blue-100 text-xs">
                  Pacientes que llegan al mostrador sin proyecto previo. Hasta {MAX_ROWS} llegadas por operación.
                </p>
              </div>
              <button onClick={closeModal} className="text-white/70 hover:text-white" type="button">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {!result && (
                <>
                  {/* Selector de sucursal */}
                  <div>
                    <label htmlFor="clinic-branch" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Sucursal (opcional)
                    </label>
                    <select
                      id="clinic-branch"
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Sin sucursal específica —</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    {selectedBranch && (
                      <p className="mt-1 text-xs text-blue-700">
                        Se asignará <strong>{selectedBranch.name}</strong> a cada paciente.
                      </p>
                    )}
                  </div>

                  {/* Tabla de captura rápida */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Pacientes (máximo {MAX_ROWS})
                      </p>
                      <button
                        type="button"
                        onClick={addRow}
                        disabled={rows.length >= MAX_ROWS}
                        className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                      >
                        + Agregar fila
                      </button>
                    </div>

                    <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr className="text-left text-slate-500">
                            <th className="px-2 py-2">#</th>
                            <th className="px-2 py-2">Nombre(s)*</th>
                            <th className="px-2 py-2">Apellido(s)*</th>
                            <th className="px-2 py-2">DOB</th>
                            <th className="px-2 py-2">CURP/ID</th>
                            <th className="px-2 py-2">Teléfono</th>
                            <th className="px-2 py-2">Correo</th>
                            <th className="px-2 py-2">Puesto</th>
                            <th className="px-2 py-2">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rows.map((row) => (
                            <tr key={row._rowIndex} className={row._status === 'error' ? 'bg-red-50' : ''}>
                              <td className="px-2 py-2 text-slate-400">{row._rowIndex}</td>
                              <td className="px-2 py-2"><input value={row.firstName} onChange={(e) => updateRow(row._rowIndex, 'firstName', e.target.value)} className="w-28 rounded border border-slate-200 px-2 py-1" /></td>
                              <td className="px-2 py-2"><input value={row.lastName} onChange={(e) => updateRow(row._rowIndex, 'lastName', e.target.value)} className="w-28 rounded border border-slate-200 px-2 py-1" /></td>
                              <td className="px-2 py-2"><input type="date" value={row.dob ?? ''} onChange={(e) => updateRow(row._rowIndex, 'dob', e.target.value)} className="w-32 rounded border border-slate-200 px-2 py-1" /></td>
                              <td className="px-2 py-2"><input value={row.nationalId ?? ''} onChange={(e) => updateRow(row._rowIndex, 'nationalId', e.target.value)} className="w-28 rounded border border-slate-200 px-2 py-1" /></td>
                              <td className="px-2 py-2"><input value={row.phone ?? ''} onChange={(e) => updateRow(row._rowIndex, 'phone', e.target.value)} className="w-24 rounded border border-slate-200 px-2 py-1" /></td>
                              <td className="px-2 py-2"><input value={row.email ?? ''} onChange={(e) => updateRow(row._rowIndex, 'email', e.target.value)} className="w-32 rounded border border-slate-200 px-2 py-1" /></td>
                              <td className="px-2 py-2"><input value={row.jobPositionName ?? ''} onChange={(e) => updateRow(row._rowIndex, 'jobPositionName', e.target.value)} className="w-24 rounded border border-slate-200 px-2 py-1" /></td>
                              <td className="px-2 py-2">
                                <button type="button" onClick={() => removeRow(row._rowIndex)} className="text-red-600 hover:text-red-700">Quitar</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {errorCount > 0 && (
                      <p className="mt-2 text-xs text-red-600">
                        Hay {errorCount} fila(s) con errores. Corrige antes de continuar.
                      </p>
                    )}
                  </div>

                  {errorMessage && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      {errorMessage}
                    </div>
                  )}
                </>
              )}

              {result && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                    Los pacientes se registraron con <strong>intakeSource = CLINIC_WALK_IN_MASS</strong> y no se asociaron a ningún proyecto.
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                      <p className="text-3xl font-black text-green-700">{result.created}</p>
                      <p className="text-xs text-green-600 font-semibold mt-1">✅ Registrados</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
                      <p className="text-3xl font-black text-amber-700">{result.duplicates.length}</p>
                      <p className="text-xs text-amber-600 font-semibold mt-1">⚠️ Duplicados omitidos</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
                      <p className="text-3xl font-black text-blue-700">{result.warnings.length}</p>
                      <p className="text-xs text-blue-600 font-semibold mt-1">🔍 Revisión manual</p>
                    </div>
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
                      <p className="text-3xl font-black text-red-700">{result.errors.length}</p>
                      <p className="text-xs text-red-600 font-semibold mt-1">❌ Errores</p>
                    </div>
                  </div>

                  {result.error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      {result.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {result ? 'Cerrar' : 'Cancelar'}
              </button>

              {!result && (
                <button
                  type="button"
                  disabled={isPending || validCount === 0}
                  onClick={handleSubmit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {isPending ? 'Registrando...' : `Registrar ${validCount} llegada(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
