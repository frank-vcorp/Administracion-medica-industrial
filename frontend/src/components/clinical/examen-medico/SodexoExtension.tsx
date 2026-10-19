'use client'

import Link from 'next/link'
import { type SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import {
  SODEXO_MATRIZ_FACTOR_IDS,
  SODEXO_MATRIZ_FACTOR_LABELS,
} from '@/lib/sodexo-matriz-factor-labels'
import { SODEXO_GINECO_TOXICO_EXTENSION_ROWS } from '@/lib/sodexo-gineco-extension-rows'
import { SODEXO_PATOLOGICOS_EXTRA_KEYS } from '@/lib/sodexo-pdf-patologicos'

const MATRIZ_NIVELES = ['', '1', '2', '3', '4', '5', 'A'] as const
const FUNCIONES_ITEMS: { key: keyof NonNullable<SodexoExtensionData['funciones_principales']>; label: string }[] = [
  { key: 'administrativa', label: 'Administrativa' },
  { key: 'ayudante', label: 'Ayudante' },
  { key: 'mantenimiento', label: 'Mantenimiento' },
  { key: 'tecnica', label: 'Técnica' },
  { key: 'telefono', label: 'Atención telefónica' },
  { key: 'conduccion', label: 'Conducción' },
]

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
  sodexoPdfUrl?: string
  showSodexoPdfDownload?: boolean
  sodexoPdfPending?: boolean
  validatingViewHref?: string
}

export function SodexoExtension({
  value,
  onChange,
  readonly = false,
  sodexoPdfUrl,
  showSodexoPdfDownload = false,
  sodexoPdfPending = false,
  validatingViewHref,
}: Props) {
  const set = <K extends keyof SodexoExtensionData>(key: K, v: SodexoExtensionData[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <p className="text-sm font-bold text-emerald-900">Formato Sodexo — campos adicionales</p>
        <p className="text-xs text-emerald-700 mt-1">
          Solo campos del REG-SO-01 que <strong>no</strong> están en la papeleta AMI. Antecedentes,
          exploración, módulo 1 y aptitud salen del examen estándar; aquí capturas identificación
          Sodexo, matriz, HO tabular, funciones y encabezado de examen físico. El PDF no inventa
          datos: lo no capturado queda vacío en el impreso.
        </p>
      </div>

      {showSodexoPdfDownload && sodexoPdfUrl ? (
        <div
          className="bg-white border-2 border-emerald-400 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3"
          data-testid="sodexo-reg-so01-pdf-download"
        >
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-900">Impresión Sodexo REG-SO-01</p>
            <p className="text-xs text-slate-600 mt-1">
              Formato oficial de historia clínica laboral Sodexo (plantilla AcroForm). No sustituye
              el PDF clínico AMI.
            </p>
          </div>
          <a
            href={sodexoPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors whitespace-nowrap"
          >
            📄 PDF Sodexo
          </a>
        </div>
      ) : sodexoPdfPending ? (
        <div
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-3"
          data-testid="sodexo-reg-so01-pdf-pending"
        >
          <p>
            ⏳ El PDF Sodexo REG-SO-01 se habilita después de{' '}
            <strong>Firmar y Emitir Dictamen</strong> (mismo requisito que el entregable clínico).
          </p>
          {validatingViewHref ? (
            <Link
              href={validatingViewHref}
              className="inline-flex items-center justify-center rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-4 py-2.5 transition-colors"
            >
              Ir a Firma y emitir dictamen →
            </Link>
          ) : null}
        </div>
      ) : null}

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
        <Field
          label="Lugar de nacimiento (PDF §1)"
          value={value.lugar_nacimiento ?? ''}
          onChange={(v) => set('lugar_nacimiento', v)}
          readonly={readonly}
        />
        <Field
          label="Teléfono casa (PDF §1)"
          value={value.telefono_casa ?? ''}
          onChange={(v) => set('telefono_casa', v)}
          readonly={readonly}
        />
        <Field
          label="Teléfono móvil (PDF §1)"
          value={value.telefono_movil ?? ''}
          onChange={(v) => set('telefono_movil', v)}
          readonly={readonly}
        />
        <Field
          label="Núm. exterior"
          value={value.numero_exterior ?? ''}
          onChange={(v) => set('numero_exterior', v)}
          readonly={readonly}
        />
        <Field
          label="Núm. interior"
          value={value.numero_interior ?? ''}
          onChange={(v) => set('numero_interior', v)}
          readonly={readonly}
        />
        <Field
          label="Estado (domicilio)"
          value={value.estado_domicilio ?? ''}
          onChange={(v) => set('estado_domicilio', v)}
          readonly={readonly}
        />
        <Field
          label="Tiempo de radicar en la localidad"
          value={value.tiempo_radicar ?? ''}
          onChange={(v) => set('tiempo_radicar', v)}
          readonly={readonly}
        />
        <Field
          label="Profesión (PDF §1)"
          value={value.profesion ?? ''}
          onChange={(v) => set('profesion', v)}
          readonly={readonly}
        />
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Lee y escribe</label>
          <select
            disabled={readonly}
            value={value.lee_y_escribe ?? ''}
            onChange={(e) =>
              set('lee_y_escribe', (e.target.value || null) as SodexoExtensionData['lee_y_escribe'])
            }
            className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          >
            <option value="">—</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
          </select>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Funciones principales (PDF §1.2)</h3>
        <div className="flex flex-wrap gap-3">
          {FUNCIONES_ITEMS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={readonly}
                checked={Boolean(value.funciones_principales?.[key])}
                onChange={(e) =>
                  set('funciones_principales', {
                    ...(value.funciones_principales ?? {}),
                    [key]: e.target.checked,
                  })
                }
                className="rounded border-slate-300"
              />
              {label}
            </label>
          ))}
        </div>
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
        <div className="mb-3">
          <label className="block text-xs font-bold text-slate-500 mb-1">Uso de EPP (PDF)</label>
          <select
            disabled={readonly}
            value={value.epp_uso ?? ''}
            onChange={(e) =>
              set('epp_uso', (e.target.value || null) as SodexoExtensionData['epp_uso'])
            }
            className="w-full max-w-xs border border-slate-200 rounded-lg p-2 text-sm"
          >
            <option value="">—</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
            <option value="OCASIONAL">Ocasional</option>
          </select>
        </div>
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
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Matriz de riesgos (nivel 1–5 / A)</h3>
        <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left p-2 font-bold text-slate-600">Factor</th>
                <th className="text-left p-2 font-bold text-slate-600 w-24">Nivel</th>
              </tr>
            </thead>
            <tbody>
              {SODEXO_MATRIZ_FACTOR_IDS.map((id) => (
                <tr key={id} className="border-t border-slate-100">
                  <td className="p-2 text-slate-700">{SODEXO_MATRIZ_FACTOR_LABELS[id] ?? id}</td>
                  <td className="p-2">
                    <select
                      disabled={readonly}
                      value={value.matriz_factores?.[id] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        const next = { ...(value.matriz_factores ?? {}) }
                        if (!v) delete next[id]
                        else next[id] = v as '1' | '2' | '3' | '4' | '5' | 'A'
                        set(
                          'matriz_factores',
                          Object.keys(next).length ? next : null,
                        )
                      }}
                      className="w-full border border-slate-200 rounded p-1"
                    >
                      {MATRIZ_NIVELES.map((n) => (
                        <option key={n || 'empty'} value={n}>
                          {n || '—'}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="block text-xs font-bold text-slate-500 mb-1 mt-4">Observaciones matriz</label>
        <textarea
          disabled={readonly}
          rows={3}
          value={value.matriz_riesgos_observaciones ?? ''}
          onChange={(e) => set('matriz_riesgos_observaciones', e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          placeholder="Notas libres adicionales…"
        />
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Historia ocupacional — tabla PDF (4 filas)</h3>
        <p className="text-[11px] text-slate-500 mb-2">
          Si completas filas aquí, sustituyen el volcado automático desde la narrativa AMI.
        </p>
        <HoTabla value={value} onChange={onChange} readonly={readonly} />
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Examen físico — encabezado PDF §9</h3>
        <div className="flex flex-wrap gap-4 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readonly}
              checked={Boolean(value.examen_encabezado?.estado_general_normal)}
              onChange={(e) =>
                set('examen_encabezado', {
                  ...(value.examen_encabezado ?? {}),
                  estado_general_normal: e.target.checked,
                })
              }
            />
            Estado general normal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readonly}
              checked={Boolean(value.examen_encabezado?.estado_mental_normal)}
              onChange={(e) =>
                set('examen_encabezado', {
                  ...(value.examen_encabezado ?? {}),
                  estado_mental_normal: e.target.checked,
                })
              }
            />
            Estado mental normal
          </label>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Mano dominante</label>
            <select
              disabled={readonly}
              value={value.examen_encabezado?.mano_dominante ?? ''}
              onChange={(e) =>
                set('examen_encabezado', {
                  ...(value.examen_encabezado ?? {}),
                  mano_dominante: (e.target.value || null) as SodexoExtensionData['examen_encabezado']?.['mano_dominante'],
                })
              }
              className="border border-slate-200 rounded-lg p-2 text-sm"
            >
              <option value="">—</option>
              <option value="DIESTRA">Diestra</option>
              <option value="ZURDA">Zurda</option>
              <option value="AMBIDIESTRA">Ambidiestra</option>
            </select>
          </div>
        </div>
      </section>

      <section className="border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase">Consentimiento HO (PDF §2–3)</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={readonly}
            checked={Boolean(value.consentimiento_ho?.informacion_verdadera)}
            onChange={(e) =>
              set('consentimiento_ho', {
                ...(value.consentimiento_ho ?? {}),
                informacion_verdadera: e.target.checked,
              })
            }
          />
          Declaro que la información proporcionada es verídica
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={readonly}
            checked={Boolean(value.consentimiento_ho?.acepta_aviso_privacidad)}
            onChange={(e) =>
              set('consentimiento_ho', {
                ...(value.consentimiento_ho ?? {}),
                acepta_aviso_privacidad: e.target.checked,
              })
            }
          />
          Acepto aviso de privacidad
        </label>
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Agudeza visual — casillas PDF §9</h3>
        <p className="text-[11px] text-slate-500 mb-2">
          Los valores Snellen siguen en la papeleta AMI; aquí marcas las casillas del REG-SO-01.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {(
            [
              ['lejana_od_sin_correccion', 'Lejana OD sin corrección'],
              ['lejana_oi_sin_correccion', 'Lejana OI sin corrección'],
              ['lejana_od_con_correccion', 'Lejana OD con corrección'],
              ['lejana_oi_con_correccion', 'Lejana OI con corrección'],
              ['cercana_od_sin_correccion', 'Cercana OD sin corrección'],
              ['cercana_oi_sin_correccion', 'Cercana OI sin corrección'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={readonly}
                checked={Boolean(value.visiometria_casillas?.[key])}
                onChange={(e) =>
                  set('visiometria_casillas', {
                    ...(value.visiometria_casillas ?? {}),
                    [key]: e.target.checked,
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <InmunComplementariasSection value={value} onChange={onChange} readonly={readonly} />

      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Hallazgos anormales — texto «Cuál» (PDF §9)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(['cual_1', 'cual_2', 'cual_3', 'cual_4'] as const).map((k, i) => (
            <Field
              key={k}
              label={`Cuál ${i + 1}`}
              value={value.examen_anormal_cual?.[k] ?? ''}
              onChange={(v) =>
                set('examen_anormal_cual', { ...(value.examen_anormal_cual ?? {}), [k]: v })
              }
              readonly={readonly}
            />
          ))}
        </div>
      </section>

      <GinecoSodexoSection value={value} onChange={onChange} readonly={readonly} />

      <PatologicosSodexoSection value={value} onChange={onChange} readonly={readonly} />

      <EstilosVidaSodexoSection value={value} onChange={onChange} readonly={readonly} />

      <Field
        label="Título sección cierre PDF (opcional)"
        value={value.titulo_seccion_sodexo ?? ''}
        onChange={(v) => set('titulo_seccion_sodexo', v)}
        readonly={readonly}
        placeholder="SALUD OCUPACIONAL SODEXO MÉXICO"
      />

      <section>
        <label className="block text-xs font-bold text-slate-500 mb-1">
          Aclaración historia personal (PDF Sodexo §5, opcional)
        </label>
        <textarea
          disabled={readonly}
          rows={3}
          value={value.aclaracion_historia_personal ?? ''}
          onChange={(e) => set('aclaracion_historia_personal', e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          placeholder="Solo si necesitas texto adicional en el impreso REG-SO-01…"
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

function InmunComplementariasSection({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const ic = value.inmunizaciones_complementarias ?? {}
  const patch = (next: Partial<NonNullable<SodexoExtensionData['inmunizaciones_complementarias']>>) => {
    onChange({ ...value, inmunizaciones_complementarias: { ...ic, ...next } })
  }
  const patchVac = (
    key: 'covid' | 'hepatitis_ab' | 'otras',
    field: string,
    val: string,
  ) => {
    const row = { ...(ic[key] ?? {}), [field]: val }
    patch({ [key]: row })
  }
  return (
    <section>
      <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Inmunizaciones complementarias (PDF §6)</h3>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input
          type="checkbox"
          disabled={readonly}
          checked={Boolean(ic.niega)}
          onChange={(e) => patch({ niega: e.target.checked })}
        />
        Niega complementarias
      </label>
      {(['covid', 'hepatitis_ab'] as const).map((vac) => (
        <div key={vac} className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <select
            disabled={readonly}
            value={ic[vac]?.estado ?? ''}
            onChange={(e) => patchVac(vac, 'estado', e.target.value)}
            className="border border-slate-200 rounded p-2 text-sm"
          >
            <option value="">— {vac}</option>
            <option value="NEGADO">Negado</option>
            <option value="SI">Sí</option>
          </select>
          <input
            disabled={readonly}
            placeholder="Fecha"
            value={ic[vac]?.fecha ?? ''}
            onChange={(e) => patchVac(vac, 'fecha', e.target.value)}
            className="border border-slate-200 rounded p-2 text-sm"
          />
          <input
            disabled={readonly}
            placeholder="IMSS"
            value={ic[vac]?.imss ?? ''}
            onChange={(e) => patchVac(vac, 'imss', e.target.value)}
            className="border border-slate-200 rounded p-2 text-sm"
          />
          <input
            disabled={readonly}
            placeholder="SSA"
            value={ic[vac]?.ssa ?? ''}
            onChange={(e) => patchVac(vac, 'ssa', e.target.value)}
            className="border border-slate-200 rounded p-2 text-sm"
          />
        </div>
      ))}
    </section>
  )
}

function GinecoSodexoSection({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const g = value.gineco_sodexo ?? {}
  const setG = (patch: Partial<NonNullable<SodexoExtensionData['gineco_sodexo']>>) => {
    onChange({ ...value, gineco_sodexo: { ...g, ...patch } })
  }
  const setTox = (id: string, estado: string) => {
    const tox = { ...(g.toxicos_medicamentos ?? {}) }
    if (!estado) delete tox[id]
    else tox[id] = estado as 'NEGADO' | 'SI'
    setG({ toxicos_medicamentos: Object.keys(tox).length ? tox : null })
  }
  return (
    <section>
      <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Gineco §7 — rejilla Sodexo</h3>
      <div className="flex flex-wrap gap-4 mb-3">
        <div>
          <label className="text-xs text-slate-500">Dismenorrea</label>
          <select
            disabled={readonly}
            value={g.dismenorrea ?? ''}
            onChange={(e) => setG({ dismenorrea: (e.target.value || null) as 'NEGADO' | 'SI' | null })}
            className="border border-slate-200 rounded p-2 text-sm block mt-1"
          >
            <option value="">—</option>
            <option value="NEGADO">Negado</option>
            <option value="SI">Sí</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm mt-5">
          <input
            type="checkbox"
            disabled={readonly}
            checked={Boolean(g.dismenorrea_incapacitante)}
            onChange={(e) => setG({ dismenorrea_incapacitante: e.target.checked })}
          />
          Incapacitante
        </label>
      </div>
      <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg">
        <table className="w-full text-xs">
          <tbody>
            {SODEXO_GINECO_TOXICO_EXTENSION_ROWS.map((row) => (
              <tr key={row.id} className="border-t border-slate-50">
                <td className="p-2">{row.label}</td>
                <td className="p-2 w-28">
                  <select
                    disabled={readonly}
                    value={g.toxicos_medicamentos?.[row.id] ?? ''}
                    onChange={(e) => setTox(row.id, e.target.value)}
                    className="w-full border border-slate-200 rounded p-1"
                  >
                    <option value="">—</option>
                    <option value="NEGADO">Negado</option>
                    <option value="SI">Sí</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PatologicosSodexoSection({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  return (
    <section>
      <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">
        Patológicos §5 — ajuste impreso (opcional)
      </h3>
      <p className="text-[11px] text-slate-500 mb-2">
        La captura clínica sigue en Antecedentes AMI; usa esto solo si el PDF Sodexo debe reflejar
        un estado distinto en filas sin mapeo directo.
      </p>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {SODEXO_PATOLOGICOS_EXTRA_KEYS.map((key) => {
          const row = value.patologicos_sodexo?.[key]
          return (
            <div key={key} className="grid grid-cols-3 gap-2 items-center text-sm">
              <span className="capitalize">{key.replace(/_/g, ' ')}</span>
              <select
                disabled={readonly}
                value={row?.estado ?? ''}
                onChange={(e) => {
                  const map = { ...(value.patologicos_sodexo ?? {}) }
                  const estado = e.target.value as 'NEGADO' | 'SI' | ''
                  if (!estado) delete map[key]
                  else map[key] = { ...map[key], estado, descripcion: map[key]?.descripcion ?? '' }
                  onChange({
                    ...value,
                    patologicos_sodexo: Object.keys(map).length ? map : null,
                  })
                }}
                className="border border-slate-200 rounded p-1"
              >
                <option value="">—</option>
                <option value="NEGADO">Negado</option>
                <option value="SI">Sí</option>
              </select>
              <input
                disabled={readonly}
                placeholder="Detalle PDF"
                value={row?.descripcion ?? ''}
                onChange={(e) => {
                  const map = { ...(value.patologicos_sodexo ?? {}) }
                  map[key] = { estado: map[key]?.estado ?? null, descripcion: e.target.value }
                  onChange({ ...value, patologicos_sodexo: map })
                }}
                className="border border-slate-200 rounded p-1"
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function EstilosVidaSodexoSection({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const ev = value.estilos_vida_sodexo ?? {}
  const patch = (p: Partial<NonNullable<SodexoExtensionData['estilos_vida_sodexo']>>) => {
    onChange({ ...value, estilos_vida_sodexo: { ...ev, ...p } })
  }
  return (
    <section>
      <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Estilos de vida §8 — casillas finas</h3>
      <p className="text-[11px] text-slate-500 mb-2">Tabaco/alcohol base vienen de APNP en AMI.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500">Intensidad tabaco</label>
          <select
            disabled={readonly}
            value={ev.tabaco_intensidad ?? ''}
            onChange={(e) =>
              patch({
                tabaco_intensidad: (e.target.value || null) as SodexoExtensionData['estilos_vida_sodexo']?.['tabaco_intensidad'],
              })
            }
            className="w-full border border-slate-200 rounded p-2 text-sm mt-1"
          >
            <option value="">—</option>
            <option value="EVENTUAL">Eventual</option>
            <option value="HABITUAL">Habitual</option>
            <option value="COMPULSIVO">Compulsivo</option>
            <option value="EXFUMADOR">Exfumador</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Años de hábito</label>
          <select
            disabled={readonly}
            value={ev.tabaco_anios ?? ''}
            onChange={(e) =>
              patch({
                tabaco_anios: (e.target.value || null) as SodexoExtensionData['estilos_vida_sodexo']?.['tabaco_anios'],
              })
            }
            className="w-full border border-slate-200 rounded p-2 text-sm mt-1"
          >
            <option value="">—</option>
            <option value="1_5">1–5</option>
            <option value="6_10">6–10</option>
            <option value="11_20">11–20</option>
            <option value="MAS_20">&gt;20</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Alcohol</label>
          <select
            disabled={readonly}
            value={ev.alcohol_modo ?? ''}
            onChange={(e) =>
              patch({
                alcohol_modo: (e.target.value || null) as SodexoExtensionData['estilos_vida_sodexo']?.['alcohol_modo'],
              })
            }
            className="w-full border border-slate-200 rounded p-2 text-sm mt-1"
          >
            <option value="">—</option>
            <option value="OCASIONAL">Ocasional</option>
            <option value="FRECUENTE">Frecuente</option>
          </select>
        </div>
      </div>
    </section>
  )
}

function ensureHoFilas(value: SodexoExtensionData) {
  const base = value.historia_ocupacional_filas ?? []
  const filas = [...base]
  while (filas.length < 4) {
    filas.push({ empresa: '', ocupacion: '', tiempo: '', agentes_riesgo: '' })
  }
  return filas.slice(0, 4)
}

function HoTabla({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const filas = ensureHoFilas(value)

  const patchRow = (index: number, patch: Partial<(typeof filas)[0]>) => {
    const next = filas.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange({ ...value, historia_ocupacional_filas: next })
  }

  return (
    <div className="space-y-3">
      {filas.map((row, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 border border-slate-100 rounded-lg p-3">
          <span className="text-[10px] font-bold text-slate-400 md:col-span-4">Fila {i + 1}</span>
          <input
            disabled={readonly}
            placeholder="Empresa"
            value={row.empresa ?? ''}
            onChange={(e) => patchRow(i, { empresa: e.target.value })}
            className="border border-slate-200 rounded p-2 text-sm"
          />
          <input
            disabled={readonly}
            placeholder="Ocupación"
            value={row.ocupacion ?? ''}
            onChange={(e) => patchRow(i, { ocupacion: e.target.value })}
            className="border border-slate-200 rounded p-2 text-sm"
          />
          <input
            disabled={readonly}
            placeholder="Tiempo"
            value={row.tiempo ?? ''}
            onChange={(e) => patchRow(i, { tiempo: e.target.value })}
            className="border border-slate-200 rounded p-2 text-sm"
          />
          <input
            disabled={readonly}
            placeholder="Agentes de riesgo"
            value={row.agentes_riesgo ?? ''}
            onChange={(e) => patchRow(i, { agentes_riesgo: e.target.value })}
            className="border border-slate-200 rounded p-2 text-sm"
          />
        </div>
      ))}
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
