/**
 * @file Página de edición de unidad móvil.
 * @id IMPL-20260711-01
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS — header sistema
 *
 * Server component que carga la unidad y la pasa a MobileUnitForm (client).
 * Wrapper con header sistema (text-2xl font-bold text-slate-800) y botón
 * "Volver" outline.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MobileUnitForm from '@/components/mobile-units/MobileUnitForm'
import { getMobileUnitById } from '@/actions/mobile-unit.actions'

export const dynamic = 'force-dynamic'

export default async function EditMobileUnitPage({
  params,
}: {
  // IMPL-20260711-01: Next.js 16 — params es una Promise.
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let unit
  try {
    unit = await getMobileUnitById(id)
  } catch {
    notFound()
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Editar {unit.name}</h2>
          <p className="text-sm text-slate-500">
            Modifica datos, equipamiento, notas e imagen de la unidad.
          </p>
        </div>
        <Link
          href={`/admin/mobile-units/${id}`}
          className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
        >
          ← Volver al detalle
        </Link>
      </header>

      <MobileUnitForm
        existing={{
          id: unit.id,
          name: unit.name,
          plate: unit.plate,
          vin: unit.vin,
          year: unit.year,
          capacity: unit.capacity,
          economicNumber: unit.economicNumber,
          status: unit.status,
          equipment: (unit.equipment as Record<string, boolean> | null) ?? null,
          notes: unit.notes,
          imageUrl: unit.imageUrl,
        }}
      />
    </div>
  )
}