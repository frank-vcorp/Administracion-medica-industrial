import * as XLSX from 'xlsx'

import type { getSatisfactionReport } from '@/actions/satisfaction.actions'

type Report = Awaited<ReturnType<typeof getSatisfactionReport>>

export function downloadSatisfactionReportExcel(report: Report, fileLabel?: string) {
  const sheetRows = report.rows.map((row) => ({
    Fecha: new Date(row.submittedAt).toLocaleString('es-MX'),
    Paciente: row.patientName,
    'ID universal': row.universalId,
    Empresa: row.companyName,
    Sucursal: row.branchName,
    Turno: row.turno,
    'Satisfacción general (1-5)': row.overall,
    'Recomendaría (1-5)': row.recomienda,
    Trato: row.qTrato,
    Escucha: row.qEscucha,
    Resolución: row.qResolucion,
    Espera: row.qEspera,
    Limpieza: row.qLimpieza,
    Privacidad: row.qPrivacidad,
    Canal: row.channel,
    Comentario: row.comentario ?? '',
    'Folio expediente': row.eventId,
  }))

  const summaryRows = [
    { Métrica: 'Respuestas', Valor: report.kpis.count },
    { Métrica: 'Promedio general', Valor: report.kpis.avgOverall },
    { Métrica: '% recomienda ≥4', Valor: report.kpis.recommendRate },
    { Métrica: 'Prom. trato', Valor: report.kpis.avgTrato },
    { Métrica: 'Prom. escucha', Valor: report.kpis.avgEscucha },
    { Métrica: 'Prom. resolución', Valor: report.kpis.avgResolucion },
    { Métrica: 'Prom. espera', Valor: report.kpis.avgEspera },
    { Métrica: 'Prom. limpieza', Valor: report.kpis.avgLimpieza },
    { Métrica: 'Prom. privacidad', Valor: report.kpis.avgPrivacidad },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), 'Detalle')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Resumen')

  const stamp = fileLabel ?? new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `encuestas-satisfaccion-${stamp}.xlsx`)
}

type DimensionKpiKey =
  | 'avgTrato'
  | 'avgEscucha'
  | 'avgResolucion'
  | 'avgEspera'
  | 'avgLimpieza'
  | 'avgPrivacidad'

export const SATISFACTION_DIMENSION_LABELS: { key: DimensionKpiKey; label: string }[] = [
  { key: 'avgTrato', label: 'Trato' },
  { key: 'avgEscucha', label: 'Escucha' },
  { key: 'avgResolucion', label: 'Resolución' },
  { key: 'avgEspera', label: 'Espera' },
  { key: 'avgLimpieza', label: 'Limpieza' },
  { key: 'avgPrivacidad', label: 'Privacidad' },
]
