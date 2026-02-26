'use client'

import { generateExcelReport } from '@/actions/report.actions'
import { signMedicalDictamPDF } from '@/actions/signature.actions'
import { useState } from 'react'

interface EventRowButtonsProps {
  eventId: string
  isCompleted: boolean
  hasVerdict: boolean
}

export function EventRowButtons({
  eventId,
  isCompleted,
  hasVerdict
}: EventRowButtonsProps) {
  const [loadingSign, setLoadingSign] = useState(false)
  const [loadingExport, setLoadingExport] = useState(false)
  const [errorSign, setErrorSign] = useState<string | null>(null)

  const handleSignDictam = async () => {
    setLoadingSign(true)
    setErrorSign(null)
    try {
      const result = await signMedicalDictamPDF(eventId)
      if (result.success) {
        alert('Dictamen firmado exitosamente')
        window.location.reload()
      } else {
        setErrorSign(result.error || 'Error desconocido')
      }
    } catch {
      setErrorSign('Error desconocido')
    } finally {
      setLoadingSign(false)
    }
  }

  const handleExportExcel = async () => {
    setLoadingExport(true)
    try {
      const result = await generateExcelReport([eventId])
      if (result.success && result.fileData) {
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
        alert(result.error || 'Error al descargar')
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoadingExport(false)
    }
  }

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

  return (
    <span className="text-slate-300 text-xs italic">No disponible</span>
  )
}
