'use client'

/**
 * Modal de creación y edición de proyectos de visita médica.
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md
 */

import { useState, useTransition, useEffect, useRef } from 'react'
import { createProject, updateProject } from '@/actions/project.actions'

interface CompanyOption {
  id: string
  name: string
}

interface BranchOption {
  id: string
  name: string
}

export interface ProjectForEdit {
  id: string
  name: string
  companyId: string
  startDate: Date | string
  endDate: Date | string
  branchId?: string | null
  unitRef?: string | null
  notes?: string | null
}

interface ProjectFormModalProps {
  companies: CompanyOption[]
  branches: BranchOption[]
  /** Si se provee, opera en modo edición controlado por el padre */
  projectToEdit?: ProjectForEdit | null
  /** Estado de visibilidad (modo controlado) */
  isOpen?: boolean
  /** Callback de cierre (modo controlado) */
  onClose?: () => void
  /** Callback tras crear/actualizar exitosamente */
  onSuccess?: (projectId: string, projectName: string) => void
  /** Texto del botón trigger (solo en modo no controlado) */
  triggerLabel?: string
}

function toISOLocal(val: Date | string | undefined | null): string {
  if (!val) return ''
  const d = val instanceof Date ? val : new Date(val)
  if (isNaN(d.getTime())) return ''
  // Formato YYYY-MM-DDTHH:mm para inputs de tipo datetime-local
  return d.toISOString().slice(0, 16)
}

export default function ProjectFormModal({
  companies,
  branches,
  projectToEdit,
  isOpen: isOpenProp,
  onClose,
  onSuccess,
  triggerLabel = 'Nuevo Proyecto',
}: ProjectFormModalProps) {
  const isControlled = isOpenProp !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const modalOpen = isControlled ? isOpenProp! : internalOpen

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Campos del formulario
  const [name, setName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [branchId, setBranchId] = useState('')
  const [unitRef, setUnitRef] = useState('')
  const [notes, setNotes] = useState('')

  const isEditMode = !!projectToEdit

  const prevIdRef = useRef<string | undefined>(undefined)

  // Sincronizar campos cuando cambia el proyecto a editar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const currentId = projectToEdit?.id
    if (currentId === prevIdRef.current) return
    prevIdRef.current = currentId
    if (projectToEdit) {
      setName(projectToEdit.name)
      setCompanyId(projectToEdit.companyId)
      setStartDate(toISOLocal(projectToEdit.startDate))
      setEndDate(toISOLocal(projectToEdit.endDate))
      setBranchId(projectToEdit.branchId ?? '')
      setUnitRef(projectToEdit.unitRef ?? '')
      setNotes(projectToEdit.notes ?? '')
    } else {
      setName('')
      setCompanyId('')
      setStartDate('')
      setEndDate('')
      setBranchId('')
      setUnitRef('')
      setNotes('')
    }
    setError(null)
  })

  function openModal() {
    setError(null)
    setInternalOpen(true)
  }

  function closeModal() {
    if (isControlled) {
      onClose?.()
    } else {
      setInternalOpen(false)
    }
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Convertir datetime-local a ISO con segundos
    const toISO = (val: string) => {
      if (!val) return ''
      const d = new Date(val)
      return isNaN(d.getTime()) ? '' : d.toISOString()
    }

    const payload = {
      name: name.trim(),
      companyId,
      startDate: toISO(startDate),
      endDate: toISO(endDate),
      branchId: branchId || undefined,
      unitRef: unitRef.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    startTransition(async () => {
      let result: { success: boolean; error?: string; project?: { id: string; name: string } }

      if (isEditMode && projectToEdit) {
        result = await updateProject(projectToEdit.id, payload)
      } else {
        result = await createProject(payload)
      }

      if (!result.success) {
        setError(result.error ?? 'Error inesperado')
        return
      }

      closeModal()
      if (!isEditMode && result.project) {
        onSuccess?.(result.project.id, result.project.name)
      } else if (isEditMode && projectToEdit) {
        onSuccess?.(projectToEdit.id, projectToEdit.name)
      }
    })
  }

  return (
    <>
      {/* Botón trigger (solo en modo no controlado) */}
      {!isControlled && (
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {triggerLabel}
        </button>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h2 className="text-lg font-bold text-white">
                {isEditMode ? 'Editar Proyecto' : 'Nuevo Proyecto de Visita Médica'}
              </h2>
              <button
                onClick={closeModal}
                className="text-white/70 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nombre del Proyecto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: AIRBUS Mayo 2026"
                  required
                  maxLength={200}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Empresa */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Empresa <span className="text-red-500">*</span>
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  required
                  disabled={isEditMode} // No se permite cambiar empresa en edición
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Seleccionar empresa...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {isEditMode && (
                  <p className="text-xs text-slate-400 mt-1">La empresa no puede cambiarse una vez creado el proyecto.</p>
                )}
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Fecha Inicio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Fecha Fin <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Unidad y Sucursal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Unidad Asignada
                  </label>
                  <input
                    type="text"
                    value={unitRef}
                    onChange={(e) => setUnitRef(e.target.value)}
                    placeholder="Ej: Unidad Móvil 3"
                    maxLength={100}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Sucursal AMI
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin sucursal (planta cliente)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="Notas del vendedor, número de contrato..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Acciones */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {isPending
                    ? (isEditMode ? 'Guardando...' : 'Creando...')
                    : (isEditMode ? 'Guardar Cambios' : 'Crear Proyecto')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
