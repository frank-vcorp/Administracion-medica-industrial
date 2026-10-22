'use client'

import type { SodexoArcosCellValue, SodexoArcosLimbDef, SodexoArcosSide } from '@/lib/sodexo-examen-fisico-arcos'
import {
  sodexoArcosCellApplicable,
  sodexoArcosCellKey,
} from '@/lib/sodexo-examen-fisico-arcos'

const SIDES: SodexoArcosSide[] = ['D', 'I']

type Props = {
  def: SodexoArcosLimbDef
  value: Record<string, SodexoArcosCellValue> | null | undefined
  onChange: (next: Record<string, SodexoArcosCellValue> | null) => void
  readonly?: boolean
}

export function SodexoArcosMovimientoGrid({ def, value, onChange, readonly }: Props) {
  const map = value ?? {}

  const setCell = (key: string, anormal: boolean) => {
    const next = { ...map }
    if (!anormal) delete next[key]
    else next[key] = { anormal: true }
    const empty = Object.keys(next).length === 0
    onChange(empty ? null : next)
  }

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-slate-50 px-2 py-1.5 border-b border-slate-200">
        {def.title}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse min-w-[520px]">
          <thead>
            <tr className="bg-white border-b border-slate-200">
              <th
                rowSpan={2}
                className="text-left p-1.5 font-semibold text-slate-600 border-r border-slate-100 sticky left-0 bg-white z-10 min-w-[7rem]"
              >
                Arcos de movimiento
              </th>
              {def.joints.map((j) => (
                <th
                  key={j.id}
                  colSpan={2}
                  className="p-1 font-semibold text-slate-700 border-r border-slate-100 text-center"
                >
                  {j.short}
                </th>
              ))}
            </tr>
            <tr className="bg-slate-50 border-b border-slate-200">
              {def.joints.map((j) =>
                SIDES.map((side) => (
                  <th
                    key={`${j.id}-${side}`}
                    className="p-0.5 w-8 font-medium text-slate-500 border-r border-slate-100 text-center"
                  >
                    {side}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {def.movements.map((mov) => (
              <tr key={mov.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="p-1.5 text-slate-800 border-r border-slate-100 sticky left-0 bg-white font-medium">
                  {mov.label}
                </td>
                {def.joints.map((joint) =>
                  SIDES.map((side) => {
                    const applicable = sodexoArcosCellApplicable(def, mov.id, joint.id)
                    if (!applicable) {
                      return (
                        <td
                          key={`${mov.id}-${joint.id}-${side}`}
                          className="p-0.5 text-center bg-slate-100/80 text-slate-300 border-r border-slate-100"
                          aria-hidden
                        >
                          —
                        </td>
                      )
                    }
                    const key = sodexoArcosCellKey(def.limb, mov.id, joint.id, side)
                    const checked = map[key]?.anormal === true
                    return (
                      <td
                        key={`${mov.id}-${joint.id}-${side}`}
                        className="p-0.5 text-center border-r border-slate-100"
                      >
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={readonly}
                            checked={checked}
                            onChange={(e) => setCell(key, e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600"
                            title={`Anormal — ${mov.label}, ${joint.label}, ${side === 'D' ? 'derecha' : 'izquierda'}`}
                            aria-label={`Anormal ${mov.label} ${joint.label} ${side}`}
                          />
                        </label>
                      </td>
                    )
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[9px] text-slate-500 px-2 py-1 border-t border-slate-100">
        Marca solo si hay anormalidad en ese arco (D = derecha, I = izquierda). Las celdas «—» no aplican en el impreso.
      </p>
    </div>
  )
}
