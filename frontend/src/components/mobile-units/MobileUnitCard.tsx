/**
 * @file MobileUnitCard — Tarjeta presentacional de unidad móvil.
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md §5.1
 *
 * Paridad visual con BranchCard:
 *   - bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md
 *   - Header con emoji 🚑 grande (h-24 bg-slate-100)
 *   - Body con nombre + status badge
 *   - Datos en grid de líneas con emoji (📞 / 🪪 / 👥 / 🔧)
 *   - Footer con botón ghost "Configurar" (o "Ver" en readOnly)
 *
 * En modo readOnly (staff no-admin en /operations/mobile-units) el botón
 * apunta a /admin/mobile-units/{id} (middleware redirige a /, pero se
 * mantiene por consistencia; OBS-2 GEMINI pendiente de fix futuro).
 */
'use client'

import Link from 'next/link'
import Image from 'next/image'
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
    <div className="bg-white p-0 rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
      <div className="h-24 bg-slate-100 flex items-center justify-center text-4xl border-b border-slate-100 relative">
        {unit.imageUrl ? (
          <Image
            src={unit.imageUrl}
            alt={unit.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <span>🚑</span>
        )}
      </div>
      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-slate-800 text-lg">{unit.name}</h3>
          <MobileUnitStatusBadge status={unit.status} />
        </div>
        <p className="text-sm text-slate-500 mb-4">
          {unit.plate ? `Placa: ${unit.plate}` : 'Sin placa asignada'}
        </p>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <span>👥</span>{' '}
            {unit.capacity != null ? `${unit.capacity} pacientes / día` : 'Capacidad N/A'}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <span>🗂️</span> {unit._count.projects} proyecto(s) asignado(s)
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <span>🔧</span>{' '}
            {nextDate ? (
              <>
                Próx. mantto: <strong className="text-slate-800">{nextDate}</strong>
                {unit.nextMaintenanceType && (
                  <span className="text-xs text-slate-500"> ({unit.nextMaintenanceType})</span>
                )}
              </>
            ) : (
              'Sin mantenimiento programado'
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Link
            href={`/admin/mobile-units/${unit.id}`}
            className="flex-1 text-center border border-slate-200 text-slate-600 py-1.5 rounded text-xs font-medium hover:bg-slate-50"
          >
            {readOnly ? 'Ver' : 'Configurar'}
          </Link>
        </div>
      </div>
    </div>
  )
}