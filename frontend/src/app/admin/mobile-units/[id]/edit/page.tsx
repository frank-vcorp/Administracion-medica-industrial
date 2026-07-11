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
  )
}
