'use client'

import { generateExcelReport } from '@/actions/report.actions'
import { signMedicalDictamPDF } from '@/actions/signature.actions'
import { useState } from 'react'

interface EventRowButtonsProps {
  eventId: string
  isCompleted: boolean
  hasVerdict: boolean
  isApto?: boolean
}

/**
 * @id IMPL-20260225-03
 * Client Component para los botones de Exportar y Firmar
 * Maneja estados de carga y errores
 */
export function EventRowButtons({
  eventId,
  isCompleted,
  hasVerdict,
  isApto
}: EventRowButtonsProps) {
  const [loadingSign, setLoadingSign] = useState(false)
  const [loadingExport, setLoadingExport] = useState(false)
  const [errorSign, setErrorSign] = useState<string | null>(null)
  const [errorExport, setErrorExport] = useState<string | null>(null)

  const handleSignDictam = async () => {
    setLoadingSign(true)
    setErrorSign(null)
    try {
      const result = await signMedicalDictamPDF(eventId)
      if (result.success) {
        alert('Dictamen firmado exitosamente')
        window.location.reload() // Recargar para actualizar estado
      } else {
        setErrorSign(result.error || 'Error desconocido')
      }
    } catch (error) {
      setErrorSign(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoadingSign(false)
    }
  }

  const handleExportExcel = async () => {
    setLoadingExport(true)
    setErrorExport(null)
    try {
      const result = await generateExcelReport([eventId])
      if (result.success && result.fileData) {
        // Descargar el archivo
        const binaryString = atob(result.fileData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.fileName || 'expediente.xlsx'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        setErrorExport(result.error || 'Error al descargar')
      }
    } catch (error) {
      setErrorExport(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoadingExport(false)
    }
  }

  // Mostrar botón para firmar si está completado pero no tiene dictamen firmado
  if (isCompleted && hasVerdict && !errorSign) {
    return (
      <div className="flex gap-2 items-center justify-end">
        <button
          onClick={handleExportExcel}
          disabled={loadingExport}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingExport ? '⏳' : '📊'} Exportar
        </button>
        <button
          onClick={handleSignDictam}
          disabled={loadingSign}
          className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingSign ? '⏳' : '✍️'} Firmar
        </button>
      </div>
    )
  }

  // Mostrar PDF descargable si ya está firmado
  if (isCompleted && hasVerdict) {
    return (
      <div className="flex gap-2 items-center justify-end">
        <button
          onClick={handleExportExcel}
          disabled={loadingExport}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingExport ? '⏳' : '📊'} Exportar
        </button>
        <a
          href={`/api/pdf/${eventId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
        >
          📥 PDF
        </a>
      </div>
    )
  }

  // Estado por defecto: no disponible
  return (
    <span className="text-slate-300 text-xs italic">No disponible</span>
  )
}
