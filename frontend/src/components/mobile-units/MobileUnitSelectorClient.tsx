/**
 * @file Selector cliente de unidad móvil (wrapper client-only, recibe server data).
 * @id IMPL-20260711-01
 */
'use client'

import { useState } from 'react'
import MobileUnitSelector from './MobileUnitSelector'

type Unit = { id: string; name: string; plate: string | null; status: string }

export default function MobileUnitSelectorClient({
  units,
  initialValue,
  startDate,
  endDate,
  projectId,
}: {
  units: Unit[]
  initialValue?: string
  startDate?: string
  endDate?: string
  projectId?: string
}) {
  const [value, setValue] = useState(initialValue ?? '')
  return (
    <>
      <input type="hidden" name="mobileUnitId" value={value} />
      <MobileUnitSelector
        units={units}
        value={value}
        onChange={setValue}
        startDate={startDate}
        endDate={endDate}
        projectId={projectId}
      />
    </>
  )
}
