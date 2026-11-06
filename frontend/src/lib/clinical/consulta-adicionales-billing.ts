/**
 * Adicionales documentados en consulta médica (férula, aplicación medicamento, otros)
 * con monto para cobro — no son EventTest.
 */
import type { ConsultaMedicaPayload } from '@/schemas/clinical/consulta-medica.constants'

type AdicionalesSource = Pick<ConsultaMedicaPayload, 'adicionales_consulta'>

export type ConsultaAdicionalBillingLine = {
  testName: string
  code: null
  unitPrice: number
}

const LABELS = {
  ferula: 'Colocación de férula (consulta)',
  medicamento: 'Aplicación de medicamento (consulta)',
  otros: 'Otros (consulta)',
} as const

function clampPrice(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, 99999999.99)
}

/** Extrae líneas con precio > 0 para recibo / tarifa sugerida. */
export function consultaAdicionalesBillingLines(
  payload: AdicionalesSource | null | undefined,
): ConsultaAdicionalBillingLine[] {
  if (!payload?.adicionales_consulta) return []
  const a = payload.adicionales_consulta
  const lines: ConsultaAdicionalBillingLine[] = []

  const ferula = clampPrice(a.ferula?.precio ?? 0)
  if (ferula > 0) {
    lines.push({
      testName: a.ferula?.detalle?.trim()
        ? `${LABELS.ferula}: ${a.ferula.detalle.trim().slice(0, 120)}`
        : LABELS.ferula,
      code: null,
      unitPrice: ferula,
    })
  }

  const med = clampPrice(a.medicamento_aplicacion?.precio ?? 0)
  if (med > 0) {
    lines.push({
      testName: a.medicamento_aplicacion?.detalle?.trim()
        ? `${LABELS.medicamento}: ${a.medicamento_aplicacion.detalle.trim().slice(0, 120)}`
        : LABELS.medicamento,
      code: null,
      unitPrice: med,
    })
  }

  const otros = clampPrice(a.otros?.precio ?? 0)
  if (otros > 0) {
    lines.push({
      testName: a.otros?.detalle?.trim()
        ? `${LABELS.otros}: ${a.otros.detalle.trim().slice(0, 120)}`
        : LABELS.otros,
      code: null,
      unitPrice: otros,
    })
  }

  return lines
}

export function sumConsultaAdicionalesPrecios(
  payload: AdicionalesSource | null | undefined,
): number {
  return Number(
    consultaAdicionalesBillingLines(payload)
      .reduce((s, l) => s + l.unitPrice, 0)
      .toFixed(2),
  )
}
