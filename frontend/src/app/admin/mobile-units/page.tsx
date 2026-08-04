/**
 * @file Catálogo de unidades móviles — Ruta: /admin/mobile-units.
 * @id IMPL-20260711-01
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md §5.1
 *
 * Server component que delega en MobileUnitManager (ahora con cards + modal).
 */
import { getMobileUnits } from '@/actions/mobile-unit.actions'
import MobileUnitManager from '@/components/mobile-units/MobileUnitManager'

export const dynamic = 'force-dynamic'

export default async function AdminMobileUnitsPage() {
  const units = await getMobileUnits()
  return <MobileUnitManager initialUnits={units} />
}