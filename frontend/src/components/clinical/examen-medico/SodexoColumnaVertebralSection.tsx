'use client'

import { Fragment } from 'react'
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { SodexoColumnaNad } from '@/lib/sodexo-examen-fisico-columna'
import {
  SODEXO_COLUMNA_ARCO_MOVIMIENTOS,
  SODEXO_COLUMNA_CURVAS,
  SODEXO_COLUMNA_NAD_LABELS,
  SODEXO_COLUMNA_REGIONES,
  sodexoColumnaArcoKey,
  sodexoColumnaCurvaKey,
  sodexoColumnaIsEmpty,
} from '@/lib/sodexo-examen-fisico-columna'

const NAD_OPTS: SodexoColumnaNad[] = ['N', 'A', 'D']

type ColumnaValue = SodexoExtensionData['examen_fisico_columna_sodexo']

type Props = {
  value: ColumnaValue
  onChange: (next: ColumnaValue) => void
  readonly?: boolean
}

function patch(prev: ColumnaValue, p: Partial<NonNullable<ColumnaValue>>): NonNullable<ColumnaValue> {
  return { ...(prev ?? {}), ...p }
}

export function SodexoColumnaVertebralSection({ value, onChange, readonly }: Props) {
  const curvas = value?.curvas ?? {}
  const arcos = value?.arcos ?? {}

  const commit = (next: NonNullable<ColumnaValue>) => {
    onChange(sodexoColumnaIsEmpty(next) ? null : next)
  }

  const setCurva = (curva: string, region: string, nad: SodexoColumnaNad) => {
    const key = sodexoColumnaCurvaKey(curva, region)
    const nextCurvas = { ...curvas, [key]: nad }
    commit(patch(value, { curvas: nextCurvas }))
  }

  const setArco = (mov: string, region: string, resultado: 'NORMAL' | 'ANORMAL') => {
    const key = sodexoColumnaArcoKey(mov, region)
    const nextArcos = { ...arcos, [key]: resultado }
    commit(patch(value, { arcos: nextArcos }))
  }

  return (
    <div className="space-y-4">
      <div className="border border-slate-200 rounded-md overflow-hidden">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-slate-50 px-2 py-1.5 border-b border-slate-200">
          Curva — región × (N normal · A aumentada · D disminuida)
        </p>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-[10px] border-collapse min-w-[480px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th
                  rowSpan={2}
                  className="text-left p-1.5 font-semibold text-slate-600 border-r border-slate-100 sticky left-0 bg-white"
                >
                  Curva
                </th>
                {SODEXO_COLUMNA_REGIONES.map((r) => (
                  <th
                    key={r.id}
                    colSpan={3}
                    className="p-1 font-semibold text-slate-700 border-r border-slate-100 text-center"
                  >
                    {r.label}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200">
                {SODEXO_COLUMNA_REGIONES.map((r) =>
                  NAD_OPTS.map((nad) => (
                    <th
                      key={`${r.id}-${nad}`}
                      className="p-0.5 w-8 font-medium text-slate-500 border-r border-slate-100 text-center"
                      title={SODEXO_COLUMNA_NAD_LABELS[nad]}
                    >
                      {nad}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {SODEXO_COLUMNA_CURVAS.map((row) => (
                <tr key={row.id} className="border-b border-slate-50">
                  <td className="p-1.5 font-medium text-slate-800 border-r border-slate-100 sticky left-0 bg-white">
                    {row.label}
                  </td>
                  {SODEXO_COLUMNA_REGIONES.map((region) =>
                    NAD_OPTS.map((nad) => {
                      const key = sodexoColumnaCurvaKey(row.id, region.id)
                      const selected = curvas[key] === nad
                      const name = `col-curva-${key}`
                      return (
                        <td key={`${row.id}-${region.id}-${nad}`} className="p-0.5 text-center border-r border-slate-100">
                          <input
                            type="radio"
                            name={name}
                            disabled={readonly}
                            checked={selected}
                            onChange={() => setCurva(row.id, region.id, nad)}
                            className="h-3 w-3"
                            aria-label={`${row.label} ${region.label} ${SODEXO_COLUMNA_NAD_LABELS[nad]}`}
                          />
                        </td>
                      )
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-slate-200 rounded-md p-3 bg-white">
        <p className="text-[10px] font-bold uppercase text-slate-600 mb-2">Escoliosis</p>
        <div className="flex gap-4 text-xs">
          {(['DERECHA', 'IZQUIERDA'] as const).map((opt) => (
            <label key={opt} className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="col-escoliosis"
                disabled={readonly}
                checked={value?.escoliosis === opt}
                onChange={() => commit(patch(value, { escoliosis: opt }))}
              />
              {opt === 'DERECHA' ? 'Derecha' : 'Izquierda'}
            </label>
          ))}
          <label className="inline-flex items-center gap-1.5 text-slate-500">
            <input
              type="radio"
              name="col-escoliosis"
              disabled={readonly}
              checked={!value?.escoliosis}
              onChange={() => commit(patch(value, { escoliosis: null }))}
            />
            Sin marcar
          </label>
        </div>
      </div>

      <div className="border border-slate-200 rounded-md overflow-hidden">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-slate-50 px-2 py-1.5 border-b border-slate-200">
          Arcos de movimiento
        </p>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-[10px] border-collapse min-w-[400px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left p-1.5 font-semibold text-slate-600 border-r border-slate-100">
                  Movimiento
                </th>
                {SODEXO_COLUMNA_REGIONES.map((r) => (
                  <th
                    key={r.id}
                    colSpan={2}
                    className="p-1 font-semibold text-slate-700 border-r border-slate-100 text-center"
                  >
                    {r.label}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="border-r border-slate-100" />
                {SODEXO_COLUMNA_REGIONES.map((r) => (
                  <Fragment key={r.id}>
                    <th className="p-0.5 font-medium text-slate-500">Normal</th>
                    <th className="p-0.5 font-medium text-slate-500 border-r border-slate-100">Anorm.</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {SODEXO_COLUMNA_ARCO_MOVIMIENTOS.map((mov) => (
                <tr key={mov.id} className="border-b border-slate-50">
                  <td className="p-1.5 font-medium text-slate-800 border-r border-slate-100">{mov.label}</td>
                  {SODEXO_COLUMNA_REGIONES.map((region) => {
                    const key = sodexoColumnaArcoKey(mov.id, region.id)
                    const res = arcos[key]
                    return (
                      <Fragment key={region.id}>
                        <td className="p-0.5 text-center">
                          <input
                            type="radio"
                            name={`col-arco-${key}`}
                            disabled={readonly}
                            checked={res === 'NORMAL'}
                            onChange={() => setArco(mov.id, region.id, 'NORMAL')}
                          />
                        </td>
                        <td className="p-0.5 text-center border-r border-slate-100">
                          <input
                            type="radio"
                            name={`col-arco-${key}`}
                            disabled={readonly}
                            checked={res === 'ANORMAL'}
                            onChange={() => setArco(mov.id, region.id, 'ANORMAL')}
                          />
                        </td>
                      </Fragment>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(['dolor', 'espasmo'] as const).map((field) => (
          <div key={field} className="border border-slate-200 rounded-md p-3 bg-white">
            <p className="text-[10px] font-bold uppercase text-slate-600 mb-2">
              {field === 'dolor' ? 'Dolor' : 'Espasmo'}
            </p>
            <div className="flex gap-3 text-xs">
              {(['NO', 'SI'] as const).map((opt) => (
                <label key={opt} className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name={`col-${field}`}
                    disabled={readonly}
                    checked={value?.[field] === opt}
                    onChange={() => commit(patch(value, { [field]: opt }))}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border border-slate-200 rounded-md p-3 bg-white">
        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Observaciones</label>
        <textarea
          disabled={readonly}
          rows={2}
          value={value?.observaciones ?? ''}
          onChange={(e) => commit(patch(value, { observaciones: e.target.value }))}
          className="w-full text-xs border border-slate-200 rounded p-2 resize-none"
          placeholder="Texto913…"
        />
      </div>
    </div>
  )
}
