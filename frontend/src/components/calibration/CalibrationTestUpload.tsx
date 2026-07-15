/**
 * @fileoverview Componente de upload de PDF de prueba para el módulo de
 *   calibración. Envía el PDF al backend (`POST /api/v1/calibration/upload`),
 *   muestra progreso y errores, y propaga los resultados al workspace padre.
 * @id IMPL-20260715-04
 * @backup context/SPECs/SPEC_ARCH-20260715-04-UPLOAD-PDFS-CALIBRACION.md
 *
 * NO persiste en DB, NO crea EventTest real — solo ejecuta el pipeline IA
 * en runtime para que el equipo de calibración valide prompts antes de
 * promover cambios.
 */
"use client"

import { useCallback, useRef, useState } from "react"
import type { CalibrationTestResults } from "@/types/calibration"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface CalibrationTestUploadProps {
  /** ID de la MedicalTest (Prisma) — se usa para resolver aiCalibration en backend. */
  testId: string
  /** Tipo de estudio canónico (ej. "Audiometria"). Si se omite, el backend usa aiCalibration.canonicalStudyType. */
  testType: string
  /** Callback invocado cuando el backend responde con resultados exitosos. */
  onResults: (results: CalibrationTestResults) => void
  /** URL base del backend FastAPI. Por defecto apunta a localhost:8000. */
  apiUrl?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado interno
// ─────────────────────────────────────────────────────────────────────────────

type UploadStatus = "idle" | "uploading" | "success" | "error"

interface UploadState {
  status: UploadStatus
  fileName: string | null
  errorMessage: string | null
  durationSeconds: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_API_URL = "http://localhost:8000"

export default function CalibrationTestUpload({
  testId,
  testType,
  onResults,
  apiUrl = DEFAULT_API_URL,
}: CalibrationTestUploadProps) {
  const [state, setState] = useState<UploadState>({
    status: "idle",
    fileName: null,
    errorMessage: null,
    durationSeconds: null,
  })
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadStartedAtRef = useRef<number | null>(null)

  const resetState = useCallback(() => {
    setState({ status: "idle", fileName: null, errorMessage: null, durationSeconds: null })
    uploadStartedAtRef.current = null
  }, [])

  const submitPdf = useCallback(
    async (file: File) => {
      // Reset defensivo
      setState({ status: "uploading", fileName: file.name, errorMessage: null, durationSeconds: null })
      uploadStartedAtRef.current = Date.now()

      const formData = new FormData()
      formData.append("file", file)
      formData.append("test_id", testId)
      formData.append("test_type", testType)

      try {
        const response = await fetch(`${apiUrl}/api/v1/calibration/upload`, {
          method: "POST",
          body: formData,
        })

        const elapsed = uploadStartedAtRef.current
          ? (Date.now() - uploadStartedAtRef.current) / 1000
          : null

        const payload = await response.json().catch(() => null)

        if (!response.ok || !payload) {
          const detail =
            (payload && typeof payload === "object" && "detail" in payload
              ? String((payload as { detail: unknown }).detail)
              : null) ?? `HTTP ${response.status}`
          setState({
            status: "error",
            fileName: file.name,
            errorMessage: detail,
            durationSeconds: elapsed,
          })
          return
        }

        if (!payload.success) {
          setState({
            status: "error",
            fileName: file.name,
            errorMessage:
              typeof payload.error === "string"
                ? payload.error
                : "El backend reportó un error al procesar el PDF.",
            durationSeconds: elapsed,
          })
          return
        }

        setState({
          status: "success",
          fileName: file.name,
          errorMessage: null,
          durationSeconds: elapsed,
        })
        onResults(payload as CalibrationTestResults)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error de red desconocido"
        setState({
          status: "error",
          fileName: file.name,
          errorMessage: `No se pudo contactar el backend: ${message}`,
          durationSeconds: null,
        })
      } finally {
        uploadStartedAtRef.current = null
      }
    },
    [apiUrl, onResults, testId, testType]
  )

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) void submitPdf(file)
      // Reset input para permitir re-subir el mismo archivo
      event.target.value = ""
    },
    [submitPdf]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragging(false)
      const file = event.dataTransfer.files?.[0]
      if (file) void submitPdf(file)
    },
    [submitPdf]
  )

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }, [])

  const handleSelectClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const isUploading = state.status === "uploading"

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Subir PDF de prueba
        </p>
        <p className="text-xs text-slate-400 font-mono">
          {testType} · test_id={testId.slice(0, 8)}…
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-disabled={isUploading}
        aria-label="Zona de carga de PDF de prueba"
        onClick={handleSelectClick}
        onKeyDown={(e) => {
          if (!isUploading && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            handleSelectClick()
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center text-center px-6 py-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer select-none ${
          isDragging
            ? "border-violet-500 bg-violet-50"
            : isUploading
              ? "border-slate-300 bg-slate-50 cursor-wait"
              : "border-slate-300 bg-white hover:border-violet-400 hover:bg-violet-50/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          disabled={isUploading}
          className="sr-only"
        />

        {isUploading ? (
          <>
            <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin mb-2" />
            <p className="text-sm font-medium text-slate-700">Procesando {state.fileName}…</p>
            <p className="text-xs text-slate-500 mt-1">
              Extracción + prediagnóstico IA en curso.
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl mb-2" aria-hidden="true">
              📄
            </p>
            <p className="text-sm font-semibold text-slate-700">
              Arrastra un PDF aquí o haz click para seleccionar
            </p>
            <p className="text-xs text-slate-500 mt-1">
              El archivo se procesa en runtime — no se persiste en DB ni crea EventTest.
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleSelectClick()
              }}
              className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-md bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              Seleccionar archivo
            </button>
          </>
        )}
      </div>

      {state.status === "error" && (
        <div
          role="alert"
          className="border border-red-200 bg-red-50 text-red-700 rounded-lg px-3 py-2 text-xs flex items-start gap-2"
        >
          <span className="font-bold">❌</span>
          <div className="flex-1 space-y-1">
            <p className="font-semibold">No se pudo procesar el PDF</p>
            <p className="font-mono break-words">{state.errorMessage}</p>
            {state.fileName && (
              <p className="text-red-500">Archivo: {state.fileName}</p>
            )}
            <button
              type="button"
              onClick={resetState}
              className="mt-1 text-xs font-semibold text-red-700 underline hover:text-red-900"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {state.status === "success" && state.fileName && (
        <div className="border border-green-200 bg-green-50 text-green-700 rounded-lg px-3 py-2 text-xs flex items-start gap-2">
          <span className="font-bold">✅</span>
          <div className="flex-1">
            <p className="font-semibold">Procesamiento completado</p>
            <p className="font-mono break-words">
              {state.fileName}
              {state.durationSeconds !== null && ` · ${state.durationSeconds.toFixed(1)}s`}
            </p>
          </div>
          <button
            type="button"
            onClick={resetState}
            className="text-xs font-semibold text-green-700 underline hover:text-green-900"
          >
            Subir otro
          </button>
        </div>
      )}
    </div>
  )
}