'use client'

import { type SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'

const TIPO_EXAMEN_OPTS = [
  ['PREINGRESO', 'Preingreso'],
  ['PERIODICA', 'Periódica'],
  ['RETIRO', 'Retiro'],
  ['REINGRESO', 'Reingreso'],
] as const

const EPP_ITEMS: { key: keyof SodexoExtensionData; label: string }[] = [
  { key: 'epp_casco', label: 'Casco' },
  { key: 'epp_mascarilla', label: 'Mascarilla' },
  { key: 'epp_lentes', label: 'Lentes de seguridad' },
  { key: 'epp_botas', label: 'Botas' },
  { key: 'epp_guantes', label: 'Guantes' },
  { key: 'epp_faja', label: 'Faja' },
]

type Props = {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}

export function SodexoExtension({ value, onChange, readonly = false }: Props) {
  const set = <K extends keyof SodexoExtensionData>(key: K, v: SodexoExtensionData[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <p className="text-sm font-bold text-emerald-900">Formato Sodexo — campos adicionales</p>
        <p className="text-xs text-emerald-700 mt-1">
          Complementa el examen AMI (REG-SO-01). Historia ocupacional detallada y matriz de riesgos.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de examen Sodexo</label>
          <select
            disabled={readonly}
            value={value.tipo_examen ?? ''}
            onChange={(e) => set('tipo_examen', (e.target.value || null) as SodexoExtensionData['tipo_examen'])}
            className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          >
            <option value="">—</option>
            {TIPO_EXAMEN_OPTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <Field
          label="Contacto de emergencia"
          value={value.contacto_emergencia ?? ''}
          onChange={(v) => set('contacto_emergencia', v)}
          readonly={readonly}
        />
        <Field
          label="Teléfono de emergencia"
          value={value.telefono_emergencia ?? ''}
          onChange={(v) => set('telefono_emergencia', v)}
          readonly={readonly}
        />
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Identificación de actividades (periódicos / retiro)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Cargo" value={value.actividades_cargo ?? ''} onChange={(v) => set('actividades_cargo', v)} readonly={readonly} />
          <Field label="Fecha de ingreso" value={value.fecha_ingreso_actividades ?? ''} onChange={(v) => set('fecha_ingreso_actividades', v)} readonly={readonly} />
          <Field label="Antigüedad" value={value.antiguedad_actividades ?? ''} onChange={(v) => set('antiguedad_actividades', v)} readonly={readonly} />
          <Field
            label="Tipo de actividad"
            value={value.tipo_actividad ?? ''}
            onChange={(v) => set('tipo_actividad', v)}
            readonly={readonly}
            placeholder="Administrativa, mantenimiento, conducción…"
          />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">EPP declarado</h3>
        <div className="flex flex-wrap gap-3">
          {EPP_ITEMS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={readonly}
                checked={Boolean(value[key])}
                onChange={(e) => set(key, e.target.checked)}
                className="rounded border-slate-300"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <label className="block text-xs font-bold text-slate-500 mb-1">Matriz de riesgos / observaciones</label>
        <textarea
          disabled={readonly}
          rows={4}
          value={value.matriz_riesgos_observaciones ?? ''}
          onChange={(e) => set('matriz_riesgos_observaciones', e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          placeholder="Factores físicos, químicos, ergonómicos, psicosociales, tiempos de exposición…"
        />
      </section>

      <section>
        <label className="block text-xs font-bold text-slate-500 mb-1">Declaración bajo protesta — nombre</label>
        <input
          disabled={readonly}
          value={value.declaracion_protesta_nombre ?? ''}
          onChange={(e) => set('declaracion_protesta_nombre', e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2 text-sm"
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
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  readonly?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
      <input
        disabled={readonly}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg p-2 text-sm"
      />
    </div>
  )
}
