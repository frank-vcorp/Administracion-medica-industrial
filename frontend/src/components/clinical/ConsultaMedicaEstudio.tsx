'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { saveConsultaMedica } from '@/actions/consulta-medica.actions'
import { AntecedentesCaptura } from '@/components/clinical/AntecedentesCaptura'
import { parseConsultaMedicaClinicalContext } from '@/lib/clinical/consulta-medica'
import {
  CONSULTA_MEDICA_SCHEMA_VERSION,
  TIPO_CONSULTA_VALUES,
  TIPO_CONSULTA_LABELS,
  buildDefaultExploracionPlantilla,
  emptySignosVitalesConsulta,
  type ConsultaMedicaPayload,
  type RecetaLinea,
  type TipoConsultaValue,
} from '@/schemas/clinical/consulta-medica.schema'
import type { AntecedentesCaptura as AntecedentesCapturaData } from '@/schemas/clinical/exam.schema'

type TabId =
  | 'motivo'
  | 'vitales'
  | 'antecedentes'
  | 'exploracion'
  | 'diagnostico'
  | 'tratamiento'
  | 'cierre'

const TABS: { id: TabId; label: string }[] = [
  { id: 'motivo', label: 'Motivo' },
  { id: 'vitales', label: 'Signos vitales' },
  { id: 'antecedentes', label: 'Antecedentes' },
  { id: 'exploracion', label: 'Exploración' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'tratamiento', label: 'Receta' },
  { id: 'cierre', label: 'Cierre' },
]

function mergeLongitudinalAntecedentes(
  longitudinal: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!longitudinal || typeof longitudinal !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const key of [
    'datos_personales',
    'historia_laboral',
    'heredo_familiares',
    'no_patologicos',
    'patologicos',
  ]) {
    if (longitudinal[key] && typeof longitudinal[key] === 'object') {
      out[key] = longitudinal[key]
    }
  }
  return out
}

function emptyRecetaLine(): RecetaLinea {
  return { medicamento: '', presentacion: '', dosis: '', frecuencia: '', duracion: '' }
}

export default function ConsultaMedicaEstudio({
  eventId,
  eventTestId,
  workerId,
  initialClinicalContext,
  longitudinalData,
  readonly = false,
}: {
  eventId: string
  eventTestId: string
  workerId: string
  initialClinicalContext: unknown
  longitudinalData?: Record<string, unknown> | null
  readonly?: boolean
}) {
  const { data: session } = useSession()
  const parsed = parseConsultaMedicaClinicalContext(initialClinicalContext)

  const [activeTab, setActiveTab] = useState<TabId>('motivo')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isPending, startTransition] = useTransition()

  const [tipoConsulta, setTipoConsulta] = useState<TipoConsultaValue>(
    parsed?.tipo_consulta ?? 'ENFERMEDAD_GENERAL',
  )
  const [motivo, setMotivo] = useState(parsed?.motivo_consulta ?? '')
  const [signos, setSignos] = useState(parsed?.signos_vitales ?? emptySignosVitalesConsulta())
  const [exploracion, setExploracion] = useState(
    parsed?.exploracion_fisica ?? buildDefaultExploracionPlantilla(),
  )
  const [diagSistema, setDiagSistema] = useState(parsed?.diagnostico_sistema ?? '')
  const [diagUnificado, setDiagUnificado] = useState(parsed?.diagnostico_unificado ?? '')
  const [diagEspecifico, setDiagEspecifico] = useState(parsed?.diagnostico_especifico ?? '')
  const [otorgaIncap, setOtorgaIncap] = useState<'SI' | 'NO'>(parsed?.otorga_incapacidad ?? 'NO')
  const [diasIncap, setDiasIncap] = useState(String(parsed?.dias_incapacidad ?? ''))
  const [paseSalida, setPaseSalida] = useState<'SI' | 'NO'>(parsed?.pase_salida ?? 'NO')
  const [materialMedico, setMaterialMedico] = useState(parsed?.material_medico ?? '')
  const [indicaciones, setIndicaciones] = useState(parsed?.indicaciones_generales ?? '')
  const [recetaLineas, setRecetaLineas] = useState<RecetaLinea[]>(
    parsed?.receta_lineas?.length ? parsed.receta_lineas : [emptyRecetaLine()],
  )
  const [medicoNombre, setMedicoNombre] = useState(
    parsed?.medico_nombre ?? session?.user?.name ?? '',
  )
  const [medicoCedula, setMedicoCedula] = useState(parsed?.medico_cedula ?? '')
  const [antecedentes, setAntecedentes] = useState<Record<string, unknown>>(() => ({
    ...mergeLongitudinalAntecedentes(longitudinalData),
    ...(parsed?.antecedentes ?? {}),
  }))
  const [cerradaAt, setCerradaAt] = useState(parsed?.cerrada_at ?? '')

  const imc = useMemo(() => {
    const p = parseFloat(signos.peso_kg ?? '')
    const t = parseFloat(signos.talla_m ?? '')
    if (!p || !t) return ''
    return (p / (t * t)).toFixed(2)
  }, [signos.peso_kg, signos.talla_m])

  const complexion = useMemo(() => {
    const v = parseFloat(imc)
    if (!v) return signos.complexion ?? ''
    if (v > 29.9) return 'OBESIDAD'
    if (v > 24.9) return 'SOBREPESO'
    if (v < 18.5) return 'BAJO PESO'
    return 'NORMAL'
  }, [imc, signos.complexion])

  const buildPayload = useCallback((): ConsultaMedicaPayload => {
    const sv = { ...signos, imc: imc || signos.imc, complexion: complexion || signos.complexion }
    const lineas = recetaLineas.filter((l) => l.medicamento.trim())
    return {
      schemaVersion: CONSULTA_MEDICA_SCHEMA_VERSION,
      tipo_consulta: tipoConsulta,
      motivo_consulta: motivo.trim(),
      signos_vitales: sv,
      exploracion_fisica: exploracion.trim(),
      diagnostico_sistema: diagSistema.trim(),
      diagnostico_unificado: diagUnificado.trim(),
      diagnostico_especifico: diagEspecifico.trim(),
      incapacidad_aplica: otorgaIncap === 'SI',
      otorga_incapacidad: otorgaIncap,
      dias_incapacidad:
        otorgaIncap === 'SI' ? Math.max(0, parseInt(diasIncap, 10) || 0) : undefined,
      pase_salida: otorgaIncap === 'SI' ? paseSalida : undefined,
      material_medico: materialMedico.trim() || undefined,
      indicaciones_generales: indicaciones.trim() || undefined,
      receta_lineas: lineas,
      medico_nombre: medicoNombre.trim() || 'Médico',
      medico_cedula: medicoCedula.trim() || '—',
      antecedentes: antecedentes as ConsultaMedicaPayload['antecedentes'],
      cerrada_at: cerradaAt || undefined,
    }
  }, [
    tipoConsulta,
    motivo,
    signos,
    imc,
    complexion,
    exploracion,
    diagSistema,
    diagUnificado,
    diagEspecifico,
    otorgaIncap,
    diasIncap,
    paseSalida,
    materialMedico,
    indicaciones,
    recetaLineas,
    medicoNombre,
    medicoCedula,
    antecedentes,
    cerradaAt,
  ])

  const runSave = (finalize: boolean) => {
    setSaveError('')
    setSaveMsg('')
    startTransition(async () => {
      const res = await saveConsultaMedica(
        eventTestId,
        eventId,
        workerId,
        buildPayload(),
        { finalize },
      )
      if (!res.success) {
        setSaveError(res.error)
        return
      }
      if (finalize && res.payload.cerrada_at) {
        setCerradaAt(res.payload.cerrada_at)
      }
      setSaveMsg(finalize ? 'Consulta cerrada y guardada.' : 'Borrador guardado.')
    })
  }

  const inputClass =
    'w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-400 border-none p-2.5 rounded-lg text-sm outline-none disabled:opacity-60'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5">
        <span className="text-teal-700 text-lg">🩺</span>
        <div>
          <p className="text-sm font-bold text-teal-900">Consulta médica</p>
          <p className="text-xs text-teal-700">
            Nota clínica + receta · Antecedentes se guardan en el perfil del paciente
          </p>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap bg-slate-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`text-xs font-semibold px-2.5 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white shadow text-teal-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'motivo' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Tipo de consulta
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TIPO_CONSULTA_VALUES.map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="tipo_consulta"
                  checked={tipoConsulta === v}
                  onChange={() => setTipoConsulta(v)}
                  disabled={readonly}
                />
                {TIPO_CONSULTA_LABELS[v]}
              </label>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Motivo de la consulta
            </label>
            <textarea
              className={`${inputClass} min-h-[140px]`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={readonly}
              placeholder="Padecimiento actual, síntomas, evolución…"
            />
          </div>
        </section>
      )}

      {activeTab === 'vitales' && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white border border-slate-200 rounded-xl p-4">
          {(
            [
              ['ta_sistolica', 'TA sistólica'],
              ['ta_diastolica', 'TA diastólica'],
              ['fc_min', 'FC / min'],
              ['fr_min', 'FR / min'],
              ['temperatura', 'T°'],
              ['peso_kg', 'Peso kg'],
              ['talla_m', 'Talla m'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
              <input
                className={inputClass}
                value={signos[key] ?? ''}
                onChange={(e) => setSignos((s) => ({ ...s, [key]: e.target.value }))}
                disabled={readonly}
              />
            </div>
          ))}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">IMC</label>
            <input className={inputClass} value={imc} readOnly />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Complexión</label>
            <input className={inputClass} value={complexion} readOnly />
          </div>
        </section>
      )}

      {activeTab === 'antecedentes' && workerId && (
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <AntecedentesCaptura
            value={antecedentes as AntecedentesCapturaData}
            onChange={(next) => setAntecedentes(next as Record<string, unknown>)}
            workerId={workerId}
            readonly={readonly}
            modulo1={{}}
            onModulo1Change={() => {}}
          />
          <p className="text-[10px] text-slate-500 mt-3">
            Al guardar la consulta, estos antecedentes se actualizan en{' '}
            <Link href={`/history/${workerId}`} className="text-teal-600 underline">
              Historia clínica del paciente
            </Link>
            .
          </p>
        </section>
      )}

      {activeTab === 'exploracion' && (
        <section className="space-y-2 bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Exploración física
            </p>
            {!readonly && (
              <button
                type="button"
                className="text-xs text-teal-700 font-semibold underline"
                onClick={() => setExploracion(buildDefaultExploracionPlantilla())}
              >
                Restaurar plantilla
              </button>
            )}
          </div>
          <textarea
            className={`${inputClass} min-h-[200px]`}
            value={exploracion}
            onChange={(e) => setExploracion(e.target.value)}
            disabled={readonly}
          />
        </section>
      )}

      {activeTab === 'diagnostico' && (
        <section className="space-y-3 bg-white border border-slate-200 rounded-xl p-4">
          <input
            className={inputClass}
            placeholder="Sistema (ej. Sistema digestivo)"
            value={diagSistema}
            onChange={(e) => setDiagSistema(e.target.value)}
            disabled={readonly}
          />
          <input
            className={inputClass}
            placeholder="Diagnóstico unificado / CIE"
            value={diagUnificado}
            onChange={(e) => setDiagUnificado(e.target.value)}
            disabled={readonly}
          />
          <textarea
            className={`${inputClass} min-h-[80px]`}
            placeholder="Diagnóstico específico"
            value={diagEspecifico}
            onChange={(e) => setDiagEspecifico(e.target.value)}
            disabled={readonly}
          />
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Incapacidad</p>
            <div className="flex gap-4">
              {(['SI', 'NO'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={otorgaIncap === v}
                    onChange={() => setOtorgaIncap(v)}
                    disabled={readonly}
                  />
                  Otorga: {v}
                </label>
              ))}
            </div>
            {otorgaIncap === 'SI' && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={365}
                  placeholder="Núm. días"
                  value={diasIncap}
                  onChange={(e) => setDiasIncap(e.target.value)}
                  disabled={readonly}
                />
                <select
                  className={inputClass}
                  value={paseSalida}
                  onChange={(e) => setPaseSalida(e.target.value as 'SI' | 'NO')}
                  disabled={readonly}
                >
                  <option value="NO">Pase de salida: NO</option>
                  <option value="SI">Pase de salida: SÍ</option>
                </select>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'tratamiento' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
          <textarea
            className={`${inputClass} min-h-[80px]`}
            placeholder="Material médico utilizado"
            value={materialMedico}
            onChange={(e) => setMaterialMedico(e.target.value)}
            disabled={readonly}
          />
          <textarea
            className={`${inputClass} min-h-[80px]`}
            placeholder="Indicaciones generales (dieta, reposo…)"
            value={indicaciones}
            onChange={(e) => setIndicaciones(e.target.value)}
            disabled={readonly}
          />
          <p className="text-[10px] font-bold text-slate-400 uppercase">Receta</p>
          {recetaLineas.map((line, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-100 rounded-lg p-3">
              <input
                className={inputClass}
                placeholder="Medicamento"
                value={line.medicamento}
                onChange={(e) => {
                  const next = [...recetaLineas]
                  next[idx] = { ...line, medicamento: e.target.value }
                  setRecetaLineas(next)
                }}
                disabled={readonly}
              />
              <input
                className={inputClass}
                placeholder="Presentación"
                value={line.presentacion ?? ''}
                onChange={(e) => {
                  const next = [...recetaLineas]
                  next[idx] = { ...line, presentacion: e.target.value }
                  setRecetaLineas(next)
                }}
                disabled={readonly}
              />
              <input
                className={inputClass}
                placeholder="Dosis"
                value={line.dosis}
                onChange={(e) => {
                  const next = [...recetaLineas]
                  next[idx] = { ...line, dosis: e.target.value }
                  setRecetaLineas(next)
                }}
                disabled={readonly}
              />
              <input
                className={inputClass}
                placeholder="Frecuencia"
                value={line.frecuencia}
                onChange={(e) => {
                  const next = [...recetaLineas]
                  next[idx] = { ...line, frecuencia: e.target.value }
                  setRecetaLineas(next)
                }}
                disabled={readonly}
              />
              <input
                className={inputClass}
                placeholder="Duración"
                value={line.duracion}
                onChange={(e) => {
                  const next = [...recetaLineas]
                  next[idx] = { ...line, duracion: e.target.value }
                  setRecetaLineas(next)
                }}
                disabled={readonly}
              />
            </div>
          ))}
          {!readonly && (
            <button
              type="button"
              className="text-xs font-bold text-teal-700"
              onClick={() => setRecetaLineas((l) => [...l, emptyRecetaLine()])}
            >
              + Agregar medicamento
            </button>
          )}
        </section>
      )}

      {activeTab === 'cierre' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Médico</label>
              <input
                className={inputClass}
                value={medicoNombre}
                onChange={(e) => setMedicoNombre(e.target.value)}
                disabled={readonly}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Cédula profesional</label>
              <input
                className={inputClass}
                value={medicoCedula}
                onChange={(e) => setMedicoCedula(e.target.value)}
                disabled={readonly}
              />
            </div>
          </div>
          {Boolean(cerradaAt) && (
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={`/api/pdf/consulta-medica/${eventId}/nota`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                📄 Nota médica (PDF)
              </a>
              <a
                href={`/api/pdf/consulta-medica/${eventId}/receta`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-teal-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                💊 Receta (PDF)
              </a>
            </div>
          )}
        </section>
      )}

      {!readonly && (
        <div className="flex flex-wrap gap-2 items-center sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 py-3 -mx-1 px-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => runSave(false)}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            Guardar borrador
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runSave(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            Cerrar consulta
          </button>
          {saveMsg && <span className="text-xs text-emerald-700 font-medium">{saveMsg}</span>}
          {saveError && <span className="text-xs text-red-600 font-medium">{saveError}</span>}
        </div>
      )}
    </div>
  )
}
