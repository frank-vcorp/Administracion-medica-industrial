import { isNoCumple } from '@/lib/clinical/aptitud.helper'

export function portalEventResolution(args: {
  status: string
  hasVerdict: boolean
  aptitud: string | null
  finalDiagnosis: string | null
}): { label: string; className: string } {
  if (args.status !== 'COMPLETED') {
    return { label: 'En tránsito', className: 'text-blue-600 font-medium text-xs' }
  }
  if (!args.hasVerdict) {
    return { label: 'Pendiente dictamen', className: 'text-amber-600 font-medium text-xs' }
  }
  const isApto = args.aptitud
    ? !isNoCumple(args.aptitud)
    : !(args.finalDiagnosis?.toLowerCase().includes('no apto') ?? false)
  return isApto
    ? { label: 'APTO', className: 'font-bold text-emerald-600' }
    : { label: 'NO APTO', className: 'font-bold text-red-600' }
}
