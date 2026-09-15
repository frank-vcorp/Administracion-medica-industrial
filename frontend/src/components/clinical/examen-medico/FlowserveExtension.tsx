'use client'

import {
  INTERROGATORIO_SISTEMAS,
  NORDICO_REGIONES,
  NORDICO_REGION_LABELS,
  emptyNordicoCuestionario,
  type FlowserveExtensionData,
  type NordicoRegionData,
} from '@/schemas/clinical/examen-medico-variant.schema'

const ALIMENTACION_OPTS = [
  ['OPTIMO', 'Óptimo'],
  ['BUENO', 'Bueno'],
  ['REGULAR', 'Regular'],
  ['MALO', 'Malo'],
  ['MUY_MALO', 'Muy malo'],
] as const

const SISTEMA_LABELS: Record<(typeof INTERROGATORIO_SISTEMAS)[number], string> = {
  cardiovascular: 'Cardiovascular',
  digestivo: 'Digestivo',
  respiratorio: 'Respiratorio',
  musculoesqueletico: 'Musculoesquelético',
  genitourinario: 'Genitourinario',
  linfohematico: 'Linfohemático',
  endocrino: 'Endócrino',
  neurosensorial: 'Neurosensorial',
  piel_faneras: 'Piel y faneras',
}

type Props = {
  value: FlowserveExtensionData
  onChange: (next: FlowserveExtensionData) => void
  readonly?: boolean
}

export function FlowserveExtension({ value, onChange, readonly = false }: Props) {
  const set = <K extends keyof FlowserveExtensionData>(key: K, v: FlowserveExtensionData[K]) => {
    onChange({ ...value, [key]: v })
  }

  const setNordico = (
    region: (typeof NORDICO_REGIONES)[number],
    field: keyof NordicoRegionData,
    v: NordicoRegionData[keyof NordicoRegionData],
  ) => {
    const base = value.cuestionario_nordico ?? emptyNordicoCuestionario()
    const row = base[region]
    onChange({
      ...value,
      cuestionario_nordico: {
        ...base,
        [region]: { ...row, [field]: v },
      },
    })
  }

  const setInterrogatorio = (
    sistema: (typeof INTERROGATORIO_SISTEMAS)[number],
    field: 'estado' | 'especifique',
    v: string,
  ) => {
    const row = value.interrogatorio?.[sistema] ?? { estado: 'SIN_SINTOMAS', especifique: '' }
    const nextInterrogatorio = {
      ...(value.interrogatorio ?? {}),
      [sistema]: { ...row, [field]: v },
    } as FlowserveExtensionData['interrogatorio']
    onChange({
      ...value,
      interrogatorio: nextInterrogatorio,
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
        <p className="text-sm font-bold text-orange-900">Formato Flowserve — campos adicionales</p>
        <p className="text-xs text-orange-700 mt-1">
          Complementa el examen AMI estándar. Los datos base (antecedentes, exploración, aptitud) se
          capturan en las pestañas anteriores.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Área" value={value.area ?? ''} onChange={(v) => set('area', v)} readonly={readonly} />
        <Field label="Alergias" value={value.alergias ?? ''} onChange={(v) => set('alergias', v)} readonly={readonly} />
        <Field label="Religión" value={value.religion ?? ''} onChange={(v) => set('religion', v)} readonly={readonly} />
        <Field
          label="Contacto de emergencia"
          value={value.contacto_emergencia ?? ''}
          onChange={(v) => set('contacto_emergencia', v)}
          readonly={readonly}
        />
        <Field
          label="Celular emergencia"
          value={value.celular_emergencia ?? ''}
          onChange={(v) => set('celular_emergencia', v)}
          readonly={readonly}
        />
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Higiene (× semana)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Baño" value={value.higiene_bano ?? ''} onChange={(v) => set('higiene_bano', v)} readonly={readonly} />
          <Field label="Aseo bucal" value={value.higiene_aseo_bucal ?? ''} onChange={(v) => set('higiene_aseo_bucal', v)} readonly={readonly} />
          <Field label="Cambio de ropa" value={value.higiene_cambio_ropa ?? ''} onChange={(v) => set('higiene_cambio_ropa', v)} readonly={readonly} />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Alimentación (Flowserve)</label>
          <select
            disabled={readonly}
            value={value.alimentacion_nivel ?? ''}
            onChange={(e) => set('alimentacion_nivel', (e.target.value || null) as FlowserveExtensionData['alimentacion_nivel'])}
            className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          >
            <option value="">—</option>
            {ALIMENTACION_OPTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <Field
          label="Actividad física — frecuencia"
          value={value.actividad_fisica_frecuencia ?? ''}
          onChange={(v) => set('actividad_fisica_frecuencia', v)}
          readonly={readonly}
        />
        <Field
          label="Actividad física — tipo"
          value={value.actividad_fisica_tipo ?? ''}
          onChange={(v) => set('actividad_fisica_tipo', v)}
          readonly={readonly}
        />
        <Field label="Sat O₂ %" value={value.sat_o2 ?? ''} onChange={(v) => set('sat_o2', v)} readonly={readonly} />
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Test de Ruffier</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="FC inicial" value={value.ruffier_fc_inicial ?? ''} onChange={(v) => set('ruffier_fc_inicial', v)} readonly={readonly} />
          <Field label="FC flexiones" value={value.ruffier_fc_flexiones ?? ''} onChange={(v) => set('ruffier_fc_flexiones', v)} readonly={readonly} />
          <Field label="FC al minuto" value={value.ruffier_fc_minuto ?? ''} onChange={(v) => set('ruffier_fc_minuto', v)} readonly={readonly} />
          <Field label="Resultado" value={value.ruffier_resultado ?? ''} onChange={(v) => set('ruffier_resultado', v)} readonly={readonly} />
        </div>
      </section>

      <Field label="Nivel de salud" value={value.nivel_salud ?? ''} onChange={(v) => set('nivel_salud', v)} readonly={readonly} />

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Interrogatorio por aparatos y sistemas</h3>
        <div className="space-y-3">
          {INTERROGATORIO_SISTEMAS.map((sistema) => {
            const row = value.interrogatorio?.[sistema] ?? { estado: 'SIN_SINTOMAS', especifique: '' }
            return (
              <div key={sistema} className="border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                <p className="text-sm font-semibold text-slate-700 md:col-span-1">{SISTEMA_LABELS[sistema]}</p>
                <select
                  disabled={readonly}
                  value={row.estado ?? 'SIN_SINTOMAS'}
                  onChange={(e) => setInterrogatorio(sistema, 'estado', e.target.value)}
                  className="border border-slate-200 rounded-lg p-2 text-sm"
                >
                  <option value="SIN_SINTOMAS">Sin síntomas</option>
                  <option value="CON_SINTOMAS">Con síntomas</option>
                </select>
                <input
                  disabled={readonly || row.estado !== 'CON_SINTOMAS'}
                  placeholder="Especifique"
                  value={row.especifique ?? ''}
                  onChange={(e) => setInterrogatorio(sistema, 'especifique', e.target.value)}
                  className="border border-slate-200 rounded-lg p-2 text-sm"
                />
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm font-bold text-slate-800">Cuestionario Nórdico Kuorinka</p>
          <p className="text-xs text-slate-600 mt-1">
            Molestias musculoesqueléticas por región anatómica. Integrado al formato Flowserve (no es
            un estudio aparte en la papeleta).
          </p>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="text-left p-2 font-bold">Región</th>
                <th className="text-left p-2 font-bold">Molestias 12 meses</th>
                <th className="text-left p-2 font-bold">Impidió trabajo 12 meses</th>
                <th className="text-left p-2 font-bold">Molestias 7 días</th>
              </tr>
            </thead>
            <tbody>
              {NORDICO_REGIONES.map((region) => {
                const row = value.cuestionario_nordico?.[region] ?? {
                  sintomas_12m: null,
                  impidio_trabajo_12m: null,
                  sintomas_7d: null,
                }
                const blocked = row.sintomas_12m !== 'SI'
                return (
                  <tr key={region} className="border-t border-slate-100">
                    <td className="p-2 font-medium text-slate-700">{NORDICO_REGION_LABELS[region]}</td>
                    {(['sintomas_12m', 'impidio_trabajo_12m', 'sintomas_7d'] as const).map((field) => (
                      <td key={field} className="p-2">
                        <select
                          disabled={readonly || (field !== 'sintomas_12m' && blocked)}
                          value={row[field] ?? ''}
                          onChange={(e) =>
                            setNordico(
                              region,
                              field,
                              (e.target.value || null) as NordicoRegionData[keyof NordicoRegionData],
                            )
                          }
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-sm"
                        >
                          <option value="">—</option>
                          <option value="SI">Sí</option>
                          <option value="NO">No</option>
                        </select>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <label className="block text-xs font-bold text-slate-500 mb-1">Declaración bajo protesta</label>
        <textarea
          disabled={readonly}
          rows={3}
          value={value.declaracion_protesta ?? ''}
          onChange={(e) => set('declaracion_protesta', e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          placeholder="Nombre del examinado bajo protesta de decir verdad…"
        />
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  readonly,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  readonly?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
      <input
        disabled={readonly}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg p-2 text-sm"
      />
    </div>
  )
}
