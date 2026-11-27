'use client'

/**
 * Modal de creación y edición de proyectos de visita médica.
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md
 * @id IMPL-20260527-03
 * @spec context/SPECs/SPEC_ARCH-20260527-03-ALTA-MASIVA-DESDE-PROYECTO.md
 * @backup context/checkpoints/CHK_IMPL-20260527-03-ALTA-MASIVA-DESDE-PROYECTO.md
 */

import { useState, useTransition, useEffect, useRef, useMemo } from 'react'
import { FolderKanban, Plus, Truck, X } from 'lucide-react'
import { createProject, updateProject, validateUnitAvailability } from '@/actions/project.actions'
import type { AvailabilityConflict } from '@/actions/project.actions'

export interface CompanyOption {
  id: string
  name: string
}

export interface BranchOption {
  id: string
  name: string
}

export interface MobileUnitOption {
  id: string
  name: string
  plate: string | null
  status: string
}

export interface ProjectForEdit {
  id: string
  name: string
  companyId: string | null // ARCH-20260730-01: nullable tras eliminación de empresa
  startDate: Date | string
  endDate: Date | string
  branchId?: string | null
  mobileUnitId?: string | null
  unitRef?: string | null
  notes?: string | null
}

interface ProjectFormModalProps {
  companies: CompanyOption[]
  branches: BranchOption[]
  mobileUnits?: MobileUnitOption[]
  /** Si se provee, opera en modo edición controlado por el padre */
  projectToEdit?: ProjectForEdit | null
  /** Estado de visibilidad (modo controlado) */
  isOpen?: boolean
  /** Callback de cierre (modo controlado) */
  onClose?: () => void
  /** Callback tras crear/actualizar exitosamente */
  onSuccess?: (projectId: string, projectName: string, companyId?: string, startDateISO?: string) => void
  /** Texto del botón trigger (solo en modo no controlado) */
  triggerLabel?: string
}

function toISOLocal(val: Date | string | undefined | null): string {
  if (!val) return ''
  const d = val instanceof Date ? val : new Date(val)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 16)
}

export default function ProjectFormModal({
  companies,
  branches,
  mobileUnits = [],
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
  const [mobileUnitId, setMobileUnitId] = useState('')
  const [unitRef, setUnitRef] = useState('')
  const [notes, setNotes] = useState('')

  // Verificación de disponibilidad en tiempo real
  const [availabilityState, setAvailabilityState] = useState<{
    key: string
    conflictMessage: string | null
    suggestions: Array<{ iso: string; label: string }>
  } | null>(null)

  const isEditMode = !!projectToEdit
  const prevIdRef = useRef<string | undefined>(undefined)

  // Unidades seleccionables: activas + la actualmente asignada si se está editando
  const selectableUnits = useMemo(() => {
    const active = mobileUnits.filter((u) => u.status === 'ACTIVA')
    const existingId = projectToEdit?.mobileUnitId
    if (existingId && !active.some((u) => u.id === existingId)) {
      const fromCatalog = mobileUnits.find((u) => u.id === existingId)
      if (fromCatalog) return [fromCatalog, ...active]
      return [
        {
          id: existingId,
          name: projectToEdit?.unitRef || 'Unidad Móvil asignada',
          plate: null,
          status: 'ACTIVA',
        },
        ...active,
      ]
    }
    return active
  }, [mobileUnits, projectToEdit?.mobileUnitId, projectToEdit?.unitRef])

  // Sincronizar campos cuando cambia el proyecto a editar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const currentId = projectToEdit?.id
    if (currentId === prevIdRef.current) return
    prevIdRef.current = currentId
    if (projectToEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación al cambiar proyecto en edición (controlled form pattern).
      setName(projectToEdit.name)
      setCompanyId(projectToEdit.companyId ?? '')
      setStartDate(toISOLocal(projectToEdit.startDate))
      setEndDate(toISOLocal(projectToEdit.endDate))
      setBranchId(projectToEdit.branchId ?? '')
      setMobileUnitId(projectToEdit.mobileUnitId ?? '')
      setUnitRef(projectToEdit.unitRef ?? '')
      setNotes(projectToEdit.notes ?? '')
    } else {
      setName('')
      setCompanyId('')
      setStartDate('')
      setEndDate('')
      setBranchId('')
      setMobileUnitId('')
      setUnitRef('')
      setNotes('')
    }
    setError(null)
    setAvailabilityState(null)
  })

  const availabilityKey = useMemo(() => {
    if (!modalOpen || !mobileUnitId || !startDate || !endDate) return ''
    const startObj = new Date(startDate)
    const endObj = new Date(endDate)
    if (Number.isNaN(startObj.getTime()) || Number.isNaN(endObj.getTime()) || startObj > endObj) {
      return ''
    }
    return `${mobileUnitId}|${startObj.toISOString()}|${endObj.toISOString()}|${projectToEdit?.id ?? ''}`
  }, [modalOpen, mobileUnitId, startDate, endDate, projectToEdit?.id])

  useEffect(() => {
    if (!availabilityKey) return
    let cancelled = false
    const startObj = new Date(startDate)
    const endObj = new Date(endDate)

    void validateUnitAvailability(
      mobileUnitId,
      startObj.toISOString(),
      endObj.toISOString(),
      projectToEdit?.id
    ).then((res) => {
      if (cancelled) return
      if (!res.available) {
        setAvailabilityState({
          key: availabilityKey,
          conflictMessage: `Conflicto detectado: ${res.conflicts.length} asignación(es) o mantenimiento(s) en ese rango.`,
          suggestions: res.suggestions,
        })
      } else {
        setAvailabilityState({
          key: availabilityKey,
          conflictMessage: null,
          suggestions: [],
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [availabilityKey, mobileUnitId, startDate, endDate, projectToEdit?.id])

  const activeAvailability =
    availabilityKey && availabilityState?.key === availabilityKey ? availabilityState : null

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

  function handleMobileUnitChange(nextId: string) {
    setMobileUnitId(nextId)
    const selected = selectableUnits.find((u) => u.id === nextId)
    const knownUnitLabel = mobileUnits.some(
      (u) =>
        u.name === unitRef.trim() ||
        `${u.name}${u.plate ? ` · ${u.plate}` : ''}` === unitRef.trim()
    )
    if (selected) {
      if (!unitRef.trim() || knownUnitLabel) {
        setUnitRef(selected.name)
      }
    } else if (knownUnitLabel) {
      setUnitRef('')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const toISO = (val: string) => {
      if (!val) return ''
      const d = new Date(val)
      return isNaN(d.getTime()) ? '' : d.toISOString()
    }

    const canManageMobileUnit =
      mobileUnits.length > 0 || (isEditMode && projectToEdit?.mobileUnitId !== undefined)

    const payload = {
      name: name.trim(),
      companyId,
      startDate: toISO(startDate),
      endDate: toISO(endDate),
      branchId: branchId || undefined,
      unitRef: unitRef.trim() || undefined,
      mobileUnitId: canManageMobileUnit
        ? (isEditMode ? (mobileUnitId || null) : (mobileUnitId || undefined))
        : (mobileUnitId || undefined),
      notes: notes.trim() || undefined,
    }

    startTransition(async () => {
      let result: {
        success: boolean
        error?: string
        project?: { id: string; name: string }
        errorCode?: string
        conflicts?: AvailabilityConflict[]
      }

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
        onSuccess?.(result.project.id, result.project.name, payload.companyId, payload.startDate)
      } else if (isEditMode && projectToEdit) {
        onSuccess?.(projectToEdit.id, projectToEdit.name, projectToEdit.companyId ?? undefined, payload.startDate)
      }
    })
  }

  return (
    <>
      {!isControlled && (
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#592c82] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#49226b]"
        >
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </button>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#592c82] to-[#743fa6] flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white">
                  <FolderKanban className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-bold text-white">
                  {isEditMode ? 'Editar Proyecto' : 'Nuevo Proyecto de Visita Médica'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-white/75 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-4">
              {error && (
                <div
                  data-testid="project-blocked-banner"
                  className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700"
                  role="alert"
                >
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
                  placeholder="Ej: Campaña UMM — Systron Industrial"
                  required
                  maxLength={200}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#592c82]/30 focus:border-[#592c82]"
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
                  disabled={isEditMode}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#592c82]/30 focus:border-[#592c82] disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Seleccionar empresa...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {isEditMode && (
                  <p className="text-xs text-slate-400 mt-1">
                    La empresa no puede cambiarse una vez creado el proyecto.
                  </p>
                )}
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Fecha Inicio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#592c82]/30 focus:border-[#592c82]"
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
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#592c82]/30 focus:border-[#592c82]"
                  />
                </div>
              </div>

              {/* Unidad Móvil real (UMM) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                <label
                  htmlFor="project-mobile-unit"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                >
                  <Truck className="h-3.5 w-3.5 text-[#592c82]" />
                  Unidad Móvil Asignada (UMM)
                </label>
                <select
                  id="project-mobile-unit"
                  value={mobileUnitId}
                  onChange={(e) => handleMobileUnitChange(e.target.value)}
                  data-testid="mobile-unit-selector"
                  className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#592c82]/30 focus:border-[#592c82]"
                >
                  <option value="">Sin unidad móvil (Sucursal fija / Planta)</option>
                  {selectableUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.plate ? ` · ${u.plate}` : ''}
                    </option>
                  ))}
                </select>
                {activeAvailability?.conflictMessage && (
                  <p
                    className="text-xs font-medium text-red-700"
                    role="alert"
                    data-testid="unit-conflict"
                  >
                    {activeAvailability.conflictMessage}
                  </p>
                )}
                {activeAvailability && activeAvailability.suggestions.length > 0 && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold">Fechas libres sugeridas:</span>{' '}
                    {activeAvailability.suggestions.map((s) => s.label).join(' · ')}
                  </div>
                )}
              </div>

              {/* Sucursal y Referencia libre */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Sucursal base SME
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#592c82]/30 focus:border-[#592c82]"
                  >
                    <option value="">Sin sucursal (planta cliente)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Referencia / Ubicación
                  </label>
                  <input
                    type="text"
                    value={unitRef}
                    onChange={(e) => setUnitRef(e.target.value)}
                    placeholder="Ej: Planta Norte · Nave 2"
                    maxLength={100}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#592c82]/30 focus:border-[#592c82]"
                  />
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
                  placeholder="Notas del vendedor, número de contrato, alcance..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#592c82]/30 focus:border-[#592c82] resize-none"
                />
              </div>

              {/* Acciones */}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-[#592c82] hover:bg-[#49226b] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {isPending
                    ? isEditMode
                      ? 'Guardando...'
                      : 'Creando...'
                    : isEditMode
                      ? 'Guardar Cambios'
                      : 'Crear Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
