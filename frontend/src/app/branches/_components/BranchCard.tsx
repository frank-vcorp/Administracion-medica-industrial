/**
 * @file BranchCard — Tarjeta presentacional de sucursal (PR-2 de ARCH-20260730-01).
 * @id IMPL-20260730-04
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §7.1, §7.4
 *
 * Client Component porque requiere `<Link>` interactivo (en realidad Link es
 * Server-rendered pero la tarjeta va dentro de un grid dinámico y queremos
 * mantener una pieza auto-contenida).
 *
 * Recibe `branch` con shape serializable (Prisma Branch + `_count`). NO recibe
 * objetos Date complejos ni nada que requiera serialización especial.
 *
 * Botón "Configurar" navega a `/branches/[id]` (la pantalla detalle/edición se
 * crea en PR-3; hasta entonces Next.js mostrará 404 — comportamiento aceptado).
 */
'use client'

import Link from 'next/link'
import type { Branch } from '@prisma/client'
import { BranchStatusBadge } from './BranchStatusBadge'

type BranchWithCounts = Branch & {
  _count: {
    appointments: number
    events: number
    workers: number
    projects: number
    allowedByCompanies: number
    companies: number
  }
}

export function BranchCard({ branch }: { branch: BranchWithCounts }) {
  return (
    <div className="bg-white p-0 rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
      <div className="h-24 bg-slate-100 flex items-center justify-center text-4xl border-b border-slate-100">
        🏥
      </div>
      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-slate-800 text-lg">{branch.name}</h3>
          <BranchStatusBadge isActive={branch.isActive} />
        </div>
        <p className="text-sm text-slate-500 mb-4">{branch.address ?? '—'}</p>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <span>📞</span> {branch.phone || 'N/A'}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <span>👨‍⚕️</span> {branch.managerName || 'N/A'}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <span>⏱️</span> {branch.openingTime} - {branch.closingTime}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <span>👥</span> {branch.hourlyCapacity} pacientes / hora
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Link
            href={`/branches/${branch.id}`}
            className="flex-1 text-center border border-slate-200 text-slate-600 py-1.5 rounded text-xs font-medium hover:bg-slate-50"
          >
            Configurar
          </Link>
        </div>
      </div>
    </div>
  )
}
