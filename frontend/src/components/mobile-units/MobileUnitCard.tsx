/**
 * @file MobileUnitCard — Tarjeta presentacional de unidad móvil.
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md §5.1
 *
 * Paridad visual institucional SME:
 *   - rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md
 *   - Header visual con foto o ícono circular Lucide <Ambulance /> en gradiente suave
 *   - Datos con íconos circulares Lucide (sin emojis crudos)
 *   - Footer con botón "Configurar" (o "Ver" en readOnly)
 */
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Ambulance, FolderKanban, Users, Wrench } from 'lucide-react'
import { MobileUnitStatusBadge } from './MobileUnitStatusBadge'

export type MobileUnitCardData = {
  id: string
  name: string
  plate: string | null
  status: string
  capacity: number | null
  imageUrl: string | null
  nextMaintenanceDate: Date | string | null
  nextMaintenanceType: string | null
  _count: { projects: number; maintenances: number }
}

type Props = {
  unit: MobileUnitCardData
  readOnly?: boolean
}

export function MobileUnitCard({ unit, readOnly = false }: Props) {
  const nextDate = unit.nextMaintenanceDate
    ? new Date(unit.nextMaintenanceDate).toLocaleDateString('es-MX')
    : null

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md flex flex-col">
      <div className="relative flex h-24 items-center justify-center border-b border-slate-100 bg-gradient-to-br from-[#592c82]/10 via-slate-50 to-teal-50/70">
        {unit.imageUrl ? (
          <Image
            src={unit.imageUrl}
            alt={unit.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#592c82] shadow-sm ring-1 ring-[#592c82]/15">
            <Ambulance className="h-6 w-6" />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900 leading-snug">{unit.name}</h3>
          <MobileUnitStatusBadge status={unit.status} />
        </div>
        <p className="mb-4 text-xs font-medium text-slate-500">
          {unit.plate ? `Placa: ${unit.plate}` : 'Sin placa asignada'}
        </p>

        <div className="space-y-2.5 text-sm flex-1">
          <div className="flex items-center gap-2.5 text-slate-600">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#592c82]/10 text-[#592c82]">
              <Users className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs">
              {unit.capacity != null ? `${unit.capacity} pacientes / día` : 'Capacidad N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-600">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <FolderKanban className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs">
              {unit._count.projects} proyecto(s) asignado(s)
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-600">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Wrench className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs">
              {nextDate ? (
                <>
                  Próx. mantto: <strong className="text-slate-800">{nextDate}</strong>
                  {unit.nextMaintenanceType && (
                    <span className="text-slate-500"> ({unit.nextMaintenanceType})</span>
                  )}
                </>
              ) : (
                'Sin mantenimiento programado'
              )}
            </span>
          </div>
        </div>

        <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
          <Link
            href={`/admin/mobile-units/${unit.id}`}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 py-2 text-center text-xs font-semibold text-slate-700 transition-colors hover:border-[#592c82]/30 hover:bg-[#592c82]/5 hover:text-[#592c82]"
          >
            {readOnly ? 'Ver' : 'Configurar'}
          </Link>
        </div>
      </div>
    </div>
  )
}
