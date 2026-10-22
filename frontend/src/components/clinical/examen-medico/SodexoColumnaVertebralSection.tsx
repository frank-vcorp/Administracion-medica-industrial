'use client'

import { Fragment } from 'react'
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { SodexoColumnaNad, SodexoColumnaSiNo } from '@/lib/sodexo-examen-fisico-columna'
import {
  SODEXO_COLUMNA_ARCO_MOVIMIENTOS,
  SODEXO_COLUMNA_ARCO_REGIONES,
  SODEXO_COLUMNA_CURVAS,
  SODEXO_COLUMNA_ESCOLIOSIS_LADOS,
  SODEXO_COLUMNA_NAD_LABELS,
  SODEXO_COLUMNA_REGIONES,
  sodexoColumnaArcoKey,
  sodexoColumnaCurvaKey,
  sodexoColumnaEscoliosisKey,
  sodexoColumnaIsEmpty,
} from '@/lib/sodexo-examen-fisico-columna'

const NAD_OPTS: SodexoColumnaNad[] = ['N', 'A', 'D']
const SI_NO_OPTS: SodexoColumnaSiNo[] = ['NO', 'SI']

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
  const escoliosis = value?.escoliosis ?? {}
  const arcos = value?.arcos ?? {}

  const commit = (next: NonNullable<ColumnaValue>) => {
    onChange(sodexoColumnaIsEmpty(next) ? null : next)
  }

  const setCurva = (curva: string, region: string, nad: SodexoColumnaNad) => {
    const key = sodexoColumnaCurvaKey(curva, region)
    commit(patch(value, { curvas: { ...curvas, [key]: nad } }))
  }

  const setEscoliosis = (lado: 'derecha' | 'izquierda', region: string, opt: SodexoColumnaSiNo) => {
    const key = sodexoColumnaEscoliosisKey(lado, region)
    commit(patch(value, { escoliosis: { ...escoliosis, [key]: opt } }))
  }

  const setArco = (
    mov: string,
    aspect: string,
    resultado: 'NORMAL' | 'ANORMAL' | SodexoColumnaSiNo,
  ) => {
    const key = sodexoColumnaArcoKey(mov, aspect)
    commit(patch(value, { arcos: { ...arcos, [key]: resultado } }))
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

      <div className="border border-slate-200 rounded-md overflow-hidden">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-slate-50 px-2 py-1.5 border-b border-slate-200">
          Escoliosis
        </p>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-[10px] border-collapse min-w-[360px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left p-1.5 font-semibold text-slate-600 border-r border-slate-100" />
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
                    <th className="p-0.5 font-medium text-slate-500">No</th>
                    <th className="p-0.5 font-medium text-slate-500 border-r border-slate-100">Sí</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {SODEXO_COLUMNA_ESCOLIOSIS_LADOS.map((lado) => (
                <tr key={lado.id} className="border-b border-slate-50">
                  <td className="p-1.5 font-medium text-slate-800 border-r border-slate-100">{lado.label}</td>
                  {SODEXO_COLUMNA_REGIONES.map((region) => {
                    const key = sodexoColumnaEscoliosisKey(lado.id, region.id)
                    const val = escoliosis[key]
                    return (
                      <Fragment key={region.id}>
                        {SI_NO_OPTS.map((opt) => (
                          <td
                            key={opt}
                            className={`p-0.5 text-center ${opt === 'SI' ? 'border-r border-slate-100' : ''}`}
                          >
                            <input
                              type="radio"
                              name={`col-esc-${key}`}
                              disabled={readonly}
                              checked={val === opt}
                              onChange={() => setEscoliosis(lado.id, region.id, opt)}
                              aria-label={`Escoliosis ${lado.label} ${region.label} ${opt}`}
                            />
                          </td>
                        ))}
                      </Fragment>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-slate-200 rounded-md overflow-hidden">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-slate-50 px-2 py-1.5 border-b border-slate-200">
          Arcos de movimiento
        </p>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-[10px] border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left p-1.5 font-semibold text-slate-600 border-r border-slate-100">
                  Movimiento
                </th>
                {SODEXO_COLUMNA_ARCO_REGIONES.map((r) => (
                  <th
                    key={r.id}
                    colSpan={2}
                    className="p-1 font-semibold text-slate-700 border-r border-slate-100 text-center"
                  >
                    {r.label}
                  </th>
                ))}
                <th colSpan={2} className="p-1 font-semibold text-slate-700 border-r border-slate-100 text-center">
                  Dolor
                </th>
                <th colSpan={2} className="p-1 font-semibold text-slate-700 text-center">Espasmo</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="border-r border-slate-100" />
                {SODEXO_COLUMNA_ARCO_REGIONES.map((r) => (
                  <Fragment key={r.id}>
                    <th className="p-0.5 font-medium text-slate-500">Normal</th>
                    <th className="p-0.5 font-medium text-slate-500 border-r border-slate-100">Anorm.</th>
                  </Fragment>
                ))}
                <th className="p-0.5 font-medium text-slate-500">No</th>
                <th className="p-0.5 font-medium text-slate-500 border-r border-slate-100">Sí</th>
                <th className="p-0.5 font-medium text-slate-500">No</th>
                <th className="p-0.5 font-medium text-slate-500">Sí</th>
              </tr>
            </thead>
            <tbody>
              {SODEXO_COLUMNA_ARCO_MOVIMIENTOS.map((mov) => (
                <tr key={mov.id} className="border-b border-slate-50">
                  <td className="p-1.5 font-medium text-slate-800 border-r border-slate-100">{mov.label}</td>
                  {SODEXO_COLUMNA_ARCO_REGIONES.map((region) => {
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
                  {(['dolor', 'espasmo'] as const).map((aspect) => (
                    <Fragment key={aspect}>
                      {SI_NO_OPTS.map((opt, idx) => (
                        <td
                          key={opt}
                          className={`p-0.5 text-center ${idx === 1 && aspect === 'dolor' ? 'border-r border-slate-100' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`col-arco-${sodexoColumnaArcoKey(mov.id, aspect)}`}
                            disabled={readonly}
                            checked={arcos[sodexoColumnaArcoKey(mov.id, aspect)] === opt}
                            onChange={() => setArco(mov.id, aspect, opt)}
                          />
                        </td>
                      ))}
                    </Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
