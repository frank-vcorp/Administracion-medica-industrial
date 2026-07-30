/**
 * @file BranchUsageStats — Tab Uso: stats read-only.
 * @id IMPL-20260730-05 (PR-3 de ARCH-20260730-01)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §7.2, §3.2
 *
 * Read-only de los `_count` que ya incluye `getBranchById`. NO consume
 * `getBranchUsageStats` (BACKLOG opcional).
 *
 * Métricas mostradas:
 *   - Citas totales (`_count.appointments`).
 *   - Empresas permitidas (`_count.allowedByCompanies`).
 *   - Sucursal default para N empresas (`_count.companies`).
 *
 * Pendiente (futuro PR): métricas por últimos 30d, eventos, workers, projects.
 */
'use client'

import type { BranchDetail } from './BranchDetailTabs'

export function BranchUsageStats({ branch }: { branch: BranchDetail }) {
  const stats: Array<{ label: string; value: number; hint?: string }> = [
    {
      label: 'Citas Totales',
      value: branch._count.appointments,
      hint: 'Histórico completo de la sucursal',
    },
    {
      label: 'Empresas Permitidas',
      value: branch._count.allowedByCompanies,
      hint: 'Pueden asignar citas/trabajadores aquí',
    },
    {
      label: 'Sucursal Default',
      value: branch._count.companies,
      hint: 'Sucursal predeterminada para estas empresas',
    },
  ]

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-slate-500">
        Métricas agregadas a partir de los registros asociados a esta sucursal.
        Conteos históricos (sin filtro temporal).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white p-4 rounded-lg border border-slate-200"
          >
            <div className="text-xs text-slate-500 uppercase tracking-wide">
              {s.label}
            </div>
            <div className="text-3xl font-bold text-slate-800 mt-1">
              {s.value}
            </div>
            {s.hint && (
              <div className="text-xs text-slate-400 mt-1">{s.hint}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}