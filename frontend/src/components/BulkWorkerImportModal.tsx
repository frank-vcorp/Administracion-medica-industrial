'use client'

/**
 * Modal de Importación Masiva de Trabajadores desde plantilla Excel.
 * Flujo multi-paso: Seleccionar Proyecto → Upload → Vista Previa → Resultado.
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-11-ALTA-MASIVA-TRABAJADORES.md
 * @id IMPL-20260527-03
 * @spec context/SPECs/SPEC_ARCH-20260527-03-ALTA-MASIVA-DESDE-PROYECTO.md
 * @backup context/checkpoints/CHK_IMPL-20260527-03-ALTA-MASIVA-DESDE-PROYECTO.md
 */

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  bulkImportWorkers,
  BulkWorkerRow,
  BulkImportResult,
} from '@/actions/worker.actions'
import { getProjectsByCompany } from '@/actions/project.actions'
import ProjectFormModal from '@/components/ProjectFormModal'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CompanyOption { id: string; name: string }
interface BranchOption { id: string; name: string }

interface ProjectOption {
  id: string
  name: string
  company: { id: string; name: string }
  _count: { workers: number }
  startDate: Date
  endDate: Date
}

type RowStatus = 'valid' | 'warning' | 'error'

interface PreviewRow extends BulkWorkerRow {
  _status: RowStatus
  _statusReason?: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_ROWS = 200

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cellVal(row: Record<string, unknown>, key: string): string {
  const val = row[key]
  if (val === undefined || val === null) return ''
  return String(val).trim()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function parseRow(raw: Record<string, unknown>, rowIndex: number): PreviewRow {
  const firstName = cellVal(raw, 'Nombre(s)')
  const lastName = cellVal(raw, 'Apellido(s)')
  const nationalId = cellVal(raw, 'CURP o ID Nacional')
  const dob = cellVal(raw, 'Fecha de Nacimiento')
  const genderRaw = cellVal(raw, 'Género').toUpperCase()
  const gender = genderRaw === 'M' || genderRaw === 'F' ? (genderRaw as 'M' | 'F') : undefined
  const email = cellVal(raw, 'Correo Electrónico')
  const phone = cellVal(raw, 'Teléfono')
  const jobPositionName = cellVal(raw, 'Puesto')

  const errors: string[] = []

  if (!firstName) errors.push('Falta nombre(s)')
  if (!lastName) errors.push('Falta apellido(s)')
  if (firstName.length > 100) errors.push('Nombre muy largo (>100)')
  if (lastName.length > 100) errors.push('Apellidos muy largos (>100)')
  if (nationalId && nationalId.length > 18) errors.push('CURP demasiado larga (>18)')
  if (email && !isValidEmail(email)) errors.push('Formato de correo inválido')
  if (phone && phone.length > 15) errors.push('Teléfono demasiado largo (>15)')

  const status: RowStatus = errors.length > 0 ? 'error' : 'valid'

  return {
    firstName,
    lastName,
    nationalId: nationalId || undefined,
    dob: dob || undefined,
    gender,
    email: email || undefined,
    phone: phone || undefined,
    jobPositionName: jobPositionName || undefined,
    _rowIndex: rowIndex,
    _status: status,
    _statusReason: errors.join(' · '),
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface BulkWorkerImportModalProps {
  companies: CompanyOption[]
  branches: BranchOption[]
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  initialCompanyId?: string
  initialProjectId?: string
  lockProjectContext?: boolean
  hideTrigger?: boolean
}

export default function BulkWorkerImportModal({
  companies,
  branches,
  isOpen: isOpenProp,
  onOpenChange,
  initialCompanyId,
  initialProjectId,
  lockProjectContext = false,
  hideTrigger = false,
}: BulkWorkerImportModalProps) {
  const isControlled = isOpenProp !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? isOpenProp : internalOpen
  const [step, setStep] = useState<'project' | 'upload' | 'preview' | 'result'>('project')

  // Paso 1 — Proyecto
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [projectContextError, setProjectContextError] = useState<string | null>(null)

  // Paso 2 — Upload
  const [parseError, setParseError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Paso 3 — Vista Previa
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])

  // Paso 4 — Resultado
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
  const [isPending, startTransition] = useTransition()

  // ─── Funciones ──────────────────────────────────────────────────────────────

  const initializeModalState = useCallback(async () => {
    setStep('project')
    setSelectedCompanyId('')
    setSelectedProjectId('')
    setProjects([])
    setProjectContextError(null)
    setPreviewRows([])
    setImportResult(null)
    setParseError(null)
    if (initialCompanyId) {
      setSelectedCompanyId(initialCompanyId)
      setLoadingProjects(true)
      const list = await getProjectsByCompany(initialCompanyId)
      const normalized = list as unknown as ProjectOption[]
      setProjects(normalized)
      setLoadingProjects(false)

      if (initialProjectId) {
        const exists = normalized.some((project) => project.id === initialProjectId)
        if (exists) {
          setSelectedProjectId(initialProjectId)
          setStep('upload')
        } else {
          setProjectContextError('No se pudo preseleccionar el proyecto. Selecciona uno manualmente para continuar.')
        }
      }
    }
  }, [initialCompanyId, initialProjectId])

  async function openModal() {
    await initializeModalState()
    if (isControlled) {
      onOpenChange?.(true)
    } else {
      setInternalOpen(true)
    }
  }

  function closeModal() {
    if (isControlled) {
      onOpenChange?.(false)
    } else {
      setInternalOpen(false)
    }
  }

  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      void initializeModalState()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [initializeModalState, open])

  async function handleCompanyChange(companyId: string) {
    setSelectedCompanyId(companyId)
    setSelectedProjectId('')
    if (!companyId) { setProjects([]); return }
    setLoadingProjects(true)
    const list = await getProjectsByCompany(companyId)
    setProjects(list as unknown as ProjectOption[])
    setLoadingProjects(false)
  }

  const handleNewProjectCreated = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_projectId: string, _projectName: string) => {
      setNewProjectOpen(false)
      // Recargar proyectos de la empresa
      if (selectedCompanyId) {
        setLoadingProjects(true)
        const list = await getProjectsByCompany(selectedCompanyId)
        setProjects(list as unknown as ProjectOption[])
        setLoadingProjects(false)
        setSelectedProjectId(_projectId)
      }
    },
    [selectedCompanyId]
  )

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'csv' && ext !== 'xls') {
      setParseError('Formato no válido. Solo se aceptan archivos .xlsx o .csv')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result as ArrayBuffer
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: false,
          raw: false,
        })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

        if (jsonRows.length === 0) {
          setParseError('El archivo está vacío o no tiene datos.')
          return
        }
        if (jsonRows.length > MAX_ROWS) {
          setParseError(`El archivo tiene ${jsonRows.length} filas. El límite es ${MAX_ROWS}.`)
          return
        }

        const parsed = jsonRows.map((row, i) => parseRow(row, i + 2)) // +2 por encabezado
        setPreviewRows(parsed)
        setStep('preview')
      } catch {
        setParseError('No se pudo leer el archivo. Verifica que sea un Excel válido.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleImport() {
    const validRows = previewRows
      .filter((r) => r._status === 'valid')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ _status, _statusReason, ...row }) => row)

    if (validRows.length === 0) return

    startTransition(async () => {
      const result = await bulkImportWorkers(validRows as BulkWorkerRow[], selectedProjectId)
      setImportResult(result)
      setStep('result')
    })
  }

  // ─── Conteos de preview ─────────────────────────────────────────────────────
  const validCount = previewRows.filter((r) => r._status === 'valid').length
  const errorCount = previewRows.filter((r) => r._status === 'error').length

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {!hideTrigger && (
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Carga Masiva
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">Carga Masiva de Trabajadores</h2>
                <p className="text-emerald-100 text-xs">
                  {step === 'project' && 'Paso 1 de 3 — Seleccionar Proyecto'}
                  {step === 'upload' && 'Paso 2 de 3 — Subir Archivo Excel'}
                  {step === 'preview' && 'Paso 3 de 3 — Vista Previa'}
                  {step === 'result' && 'Resultado de la Importación'}
                </p>
              </div>
              <button onClick={closeModal} className="text-white/70 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* ── PASO 1: Seleccionar Proyecto ── */}
              {step === 'project' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Empresa <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                      disabled={lockProjectContext && !!initialCompanyId}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Seleccionar empresa...</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {lockProjectContext && !!initialCompanyId && (
                      <p className="mt-1 text-xs text-slate-500">Empresa bloqueada por flujo contextual desde proyecto.</p>
                    )}
                  </div>

                  {selectedCompanyId && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-600">
                          Proyecto <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setNewProjectOpen(true)}
                          disabled={lockProjectContext}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium hover:underline"
                        >
                          + Nuevo Proyecto
                        </button>
                      </div>

                      {loadingProjects ? (
                        <p className="text-sm text-slate-400">Cargando proyectos...</p>
                      ) : projects.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                          <p className="text-slate-500 text-sm">No hay proyectos para esta empresa todavía.</p>
                          <button
                            type="button"
                            onClick={() => setNewProjectOpen(true)}
                            className="mt-2 text-sm text-emerald-600 hover:underline font-semibold"
                          >
                            + Crear Proyecto
                          </button>
                        </div>
                      ) : (
                        <select
                          value={selectedProjectId}
                          onChange={(e) => setSelectedProjectId(e.target.value)}
                          disabled={lockProjectContext && !!initialProjectId}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Seleccionar proyecto...</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p._count.workers} trabajador(es)
                            </option>
                          ))}
                        </select>
                      )}
                      {lockProjectContext && !!initialProjectId && (
                        <p className="mt-1 text-xs text-slate-500">Proyecto bloqueado por flujo contextual desde proyecto.</p>
                      )}
                    </div>
                  )}

                  {projectContextError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                      {projectContextError}
                    </div>
                  )}
                </div>
              )}

              {/* ── PASO 2: Upload ── */}
              {step === 'upload' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                    Proyecto: <strong>{selectedProject?.name}</strong> — {selectedProject?.company.name}
                  </div>

                  <a
                    href="/templates/plantilla-trabajadores.xlsx"
                    download
                    className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800 font-semibold hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar Plantilla Excel
                  </a>

                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-emerald-400 transition-colors">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="bulk-file-input"
                    />
                    <label htmlFor="bulk-file-input" className="cursor-pointer">
                      <div className="text-4xl mb-2">📊</div>
                      <p className="text-slate-600 font-semibold">Seleccionar archivo .xlsx o .csv</p>
                      <p className="text-slate-400 text-xs mt-1">Máximo {MAX_ROWS} trabajadores por carga</p>
                    </label>
                  </div>

                  {parseError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      {parseError}
                    </div>
                  )}
                </div>
              )}

              {/* ── PASO 3: Vista Previa ── */}
              {step === 'preview' && (
                <div className="space-y-3">
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                      🟢 {validCount} válidos
                    </span>
                    <span className="flex items-center gap-1 bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold">
                      🔴 {errorCount} con error
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-left text-slate-500">#</th>
                          <th className="px-2 py-2 text-left text-slate-500">Nombre</th>
                          <th className="px-2 py-2 text-left text-slate-500">Apellidos</th>
                          <th className="px-2 py-2 text-left text-slate-500">DOB</th>
                          <th className="px-2 py-2 text-left text-slate-500">Email</th>
                          <th className="px-2 py-2 text-left text-slate-500">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRows.map((row) => (
                          <tr
                            key={row._rowIndex}
                            className={
                              row._status === 'valid' ? 'bg-green-50' :
                              row._status === 'warning' ? 'bg-amber-50' :
                              'bg-red-50'
                            }
                          >
                            <td className="px-2 py-1 text-slate-400">{row._rowIndex}</td>
                            <td className="px-2 py-1">{row.firstName || <span className="text-red-400 italic">vacío</span>}</td>
                            <td className="px-2 py-1">{row.lastName || <span className="text-red-400 italic">vacío</span>}</td>
                            <td className="px-2 py-1 text-slate-500">{row.dob ?? '—'}</td>
                            <td className="px-2 py-1 text-slate-500 truncate max-w-[100px]">{row.email ?? '—'}</td>
                            <td className="px-2 py-1">
                              {row._status === 'valid' ? (
                                <span className="text-green-700 font-semibold">✓ Válida</span>
                              ) : (
                                <span className="text-red-600" title={row._statusReason}>
                                  ✗ {row._statusReason}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── PASO 4: Resultado ── */}
              {step === 'result' && importResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                      <p className="text-3xl font-black text-green-700">{importResult.created}</p>
                      <p className="text-xs text-green-600 font-semibold mt-1">✅ Creados</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
                      <p className="text-3xl font-black text-amber-700">{importResult.duplicates.length}</p>
                      <p className="text-xs text-amber-600 font-semibold mt-1">⚠️ Duplicados omitidos</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
                      <p className="text-3xl font-black text-blue-700">{importResult.warnings.length}</p>
                      <p className="text-xs text-blue-600 font-semibold mt-1">🔍 Requieren revisión</p>
                    </div>
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
                      <p className="text-3xl font-black text-red-700">{importResult.errors.length}</p>
                      <p className="text-xs text-red-600 font-semibold mt-1">❌ Errores</p>
                    </div>
                  </div>

                  {importResult.error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      {importResult.error}
                    </div>
                  )}

                  {importResult.warnings.length > 0 && (
                    <details className="rounded-lg border border-blue-200 bg-blue-50">
                      <summary className="px-3 py-2 text-xs font-semibold text-blue-700 cursor-pointer">
                        Ver {importResult.warnings.length} posibles duplicados para revisión manual
                      </summary>
                      <ul className="px-4 pb-3 space-y-1">
                        {importResult.warnings.map((w) => (
                          <li key={w.rowIndex} className="text-xs text-blue-800">
                            Fila {w.rowIndex}: {w.firstName} {w.lastName} — {w.reason}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {importResult.errors.length > 0 && (
                    <details className="rounded-lg border border-red-200 bg-red-50">
                      <summary className="px-3 py-2 text-xs font-semibold text-red-700 cursor-pointer">
                        Ver {importResult.errors.length} errores de formato
                      </summary>
                      <ul className="px-4 pb-3 space-y-1">
                        {importResult.errors.map((err) => (
                          <li key={err.rowIndex} className="text-xs text-red-800">
                            Fila {err.rowIndex}: {err.reason}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>

            {/* Footer con botones de navegación */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  if (step === 'upload') setStep('project')
                  else if (step === 'preview') { setStep('upload'); setPreviewRows([]) }
                  else closeModal()
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {step === 'result' ? 'Cerrar' : step === 'project' ? 'Cancelar' : '← Atrás'}
              </button>

              <div className="flex gap-2">
                {step === 'project' && (
                  <button
                    type="button"
                    disabled={!selectedProjectId}
                    onClick={() => setStep('upload')}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Siguiente →
                  </button>
                )}

                {step === 'preview' && (
                  <button
                    type="button"
                    disabled={validCount === 0 || isPending}
                    onClick={handleImport}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {isPending ? 'Importando...' : `Importar ${validCount} trabajador(es)`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de nuevo proyecto inline */}
      <ProjectFormModal
        companies={companies}
        branches={branches}
        isOpen={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onSuccess={handleNewProjectCreated}
        triggerLabel="Nuevo Proyecto"
      />
    </>
  )
}
