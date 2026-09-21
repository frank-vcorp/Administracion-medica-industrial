'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  previewOperationalCleanupAction,
  runOperationalCleanupAction,
} from '@/actions/operational-cleanup.actions'
import type { OperationalCleanupPreview } from '@/services/operational-cleanup.service'

const CONFIRM_PHRASE = 'LIMPIAR DATOS OPERATIVOS'

export default function OperationalCleanupPanel() {
  const [preview, setPreview] = useState<OperationalCleanupPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await previewOperationalCleanupAction()
    if (res.ok) {
      setPreview(res.preview)
    } else {
      setError(res.error)
      setPreview(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  function handleExecute() {
    if (confirmText !== CONFIRM_PHRASE) {
      setError(`Escribe exactamente: ${CONFIRM_PHRASE}`)
      return
    }
    if (
      !window.confirm(
        '¿Eliminar TODOS los pacientes, expedientes y empresas cliente (excepto Público General)? Esta acción no se puede deshacer.',
      )
    ) {
      return
    }

    startTransition(async () => {
      setError(null)
      setMessage(null)
      const res = await runOperationalCleanupAction({ confirmation: confirmText })
      if (res.ok) {
        setMessage(
          `Listo: ${res.deletedWorkers} paciente(s) y ${res.deletedCompanies} empresa(s) eliminados. Catálogo de pruebas: ${res.after.medicalTestCount} (sin cambios).`,
        )
        setPreview(res.after)
        setConfirmText('')
      } else {
        setError(res.error)
      }
    })
  }

  if (loading && !preview) {
    return (
      <p className="text-sm text-slate-500" data-testid="operational-cleanup-loading">
        Cargando vista previa de limpieza…
      </p>
    )
  }

  return (
    <div
      className="bg-white border border-red-200 rounded-2xl p-6 space-y-5 shadow-sm"
      data-testid="operational-cleanup-panel"
    >
      <div>
        <h2 className="text-lg font-bold text-red-900">Limpieza de datos operativos</h2>
        <p className="text-sm text-slate-600 mt-1">
          Borra <strong>todos los pacientes</strong> (y sus expedientes, citas, estudios e
          IA por estudio) y <strong>todas las empresas cliente</strong>, excepto{' '}
          <strong>Público General</strong>. No modifica el catálogo de pruebas ni las
          calibraciones del catálogo.
        </p>
        <p className="text-xs text-red-700 mt-2 font-medium">
          Solo SUPERADMIN. Uso recomendado antes de E2E o demos en staging/producción.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      {preview && (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 rounded-lg p-3">
            <dt className="text-slate-500">Pacientes a eliminar</dt>
            <dd className="text-xl font-bold text-slate-900">{preview.workerCount}</dd>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <dt className="text-slate-500">Expedientes (cascade)</dt>
            <dd className="text-xl font-bold text-slate-900">{preview.medicalEventCount}</dd>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <dt className="text-slate-500">Empresas a eliminar</dt>
            <dd className="text-xl font-bold text-slate-900">
              {preview.companyDeleteCount} / {preview.companyTotal}
            </dd>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <dt className="text-slate-500">Pruebas en catálogo (se conservan)</dt>
            <dd className="text-xl font-bold text-teal-800">{preview.medicalTestCount}</dd>
          </div>
        </dl>
      )}

      {preview && preview.preservedCompanyNames.length > 0 && (
        <p className="text-xs text-slate-500">
          Empresas preservadas: {preview.preservedCompanyNames.join(', ')}
        </p>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor="operational-cleanup-confirm">
          Confirmación (escribe{' '}
          <span className="font-mono text-red-800">{CONFIRM_PHRASE}</span>)
        </label>
        <input
          id="operational-cleanup-confirm"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
          autoComplete="off"
          data-testid="operational-cleanup-confirm-input"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void loadPreview()}
          disabled={loading || isPending}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          data-testid="operational-cleanup-refresh"
        >
          Actualizar vista previa
        </button>
        <button
          type="button"
          onClick={handleExecute}
          disabled={
            isPending ||
            confirmText !== CONFIRM_PHRASE ||
            !preview ||
            (preview.workerCount === 0 && preview.companyDeleteCount === 0)
          }
          className="px-4 py-2 text-sm font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="operational-cleanup-execute"
        >
          {isPending ? 'Eliminando…' : 'Ejecutar limpieza'}
        </button>
      </div>
    </div>
  )
}
