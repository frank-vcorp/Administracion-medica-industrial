'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import { saveCertificadoMedico } from '@/actions/certificado-medico.actions'
import { AntecedentesCaptura } from '@/components/clinical/AntecedentesCaptura'
import { parseCertificadoMedicoClinicalContext } from '@/lib/clinical/certificado-medico'
import type { AntecedentesCaptura as AntecedentesCapturaData } from '@/schemas/clinical/exam.schema'
import {
  CERTIFICADO_MEDICO_SCHEMA_VERSION,
  DEFAULT_DICTAMEN_LABORAL_TEXTO,
  DEFAULT_LUGAR_EXPEDICION,
  DICTAMEN_LABORAL_VALUES,
  DICTAMEN_LABORAL_LABELS,
  buildDefaultExploracionCertificado,
  emptySignosVitalesCertificado,
  type CertificadoMedicoPayload,
  type DictamenLaboralValue,
} from '@/schemas/clinical/certificado-medico.schema'

type TabId = 'antecedentes' | 'vitales' | 'exploracion' | 'dictamen' | 'cierre'

const TABS: { id: TabId; label: string }[] = [
  { id: 'antecedentes', label: 'Antecedentes' },
  { id: 'vitales', label: 'Signos vitales' },
  { id: 'exploracion', label: 'Exploración' },
  { id: 'dictamen', label: 'Dictamen' },
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

export default function CertificadoMedicoEstudio({
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
  const parsed = parseCertificadoMedicoClinicalContext(initialClinicalContext)

  const [activeTab, setActiveTab] = useState<TabId>('antecedentes')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isPending, startTransition] = useTransition()

  const [lugar, setLugar] = useState(parsed?.lugar_expedicion ?? DEFAULT_LUGAR_EXPEDICION)
  const [horaAtencion, setHoraAtencion] = useState(parsed?.hora_atencion ?? '')
  const [sexoAtencion, setSexoAtencion] = useState(parsed?.sexo_atencion ?? '')
  const [domicilioAtencion, setDomicilioAtencion] = useState(parsed?.domicilio_atencion ?? '')
  const [idTipo, setIdTipo] = useState(parsed?.identificacion_tipo ?? 'INE')
  const [idFolio, setIdFolio] = useState(parsed?.identificacion_folio ?? '')
  const [signos, setSignos] = useState(parsed?.signos_vitales ?? emptySignosVitalesCertificado())
  const [exploracion, setExploracion] = useState(
    parsed?.exploracion_fisica ?? buildDefaultExploracionCertificado(),
  )
  const [integracion, setIntegracion] = useState(parsed?.integracion_diagnostica ?? '')
  const [dictamen, setDictamen] = useState<DictamenLaboralValue>(
    parsed?.dictamen_laboral ?? 'APTO',
  )
  const [dictamenTexto, setDictamenTexto] = useState(
    parsed?.dictamen_laboral_texto ?? DEFAULT_DICTAMEN_LABORAL_TEXTO.APTO,
  )
  const [medicoNombre, setMedicoNombre] = useState(
    parsed?.medico_nombre ?? session?.user?.name ?? '',
  )
  const [medicoCedula, setMedicoCedula] = useState(parsed?.medico_cedula ?? '')
  const [medicoTitulo, setMedicoTitulo] = useState(parsed?.medico_titulo ?? 'Médico General')
  const [medicoUniversidad, setMedicoUniversidad] = useState(parsed?.medico_universidad ?? '')
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

  const onDictamenChange = (value: DictamenLaboralValue) => {
    setDictamen(value)
    if (!dictamenTexto.trim() || dictamenTexto === DEFAULT_DICTAMEN_LABORAL_TEXTO[dictamen]) {
      setDictamenTexto(DEFAULT_DICTAMEN_LABORAL_TEXTO[value])
    }
  }

  const buildPayload = useCallback((): CertificadoMedicoPayload => {
    const sv = { ...signos, imc: imc || signos.imc, complexion: complexion || signos.complexion }
    return {
      schemaVersion: CERTIFICADO_MEDICO_SCHEMA_VERSION,
      lugar_expedicion: lugar.trim() || DEFAULT_LUGAR_EXPEDICION,
      hora_atencion: horaAtencion.trim() || undefined,
      sexo_atencion: sexoAtencion.trim() || undefined,
      domicilio_atencion: domicilioAtencion.trim() || undefined,
      identificacion_tipo: idTipo.trim() || undefined,
      identificacion_folio: idFolio.trim() || undefined,
      medico_nombre: medicoNombre.trim() || 'Médico',
      medico_cedula: medicoCedula.trim() || '—',
      medico_titulo: medicoTitulo.trim() || undefined,
      medico_universidad: medicoUniversidad.trim() || undefined,
      signos_vitales: sv,
      exploracion_fisica: exploracion.trim(),
      integracion_diagnostica: integracion.trim(),
      dictamen_laboral: dictamen,
      dictamen_laboral_texto: dictamenTexto.trim(),
      antecedentes: antecedentes as CertificadoMedicoPayload['antecedentes'],
      cerrada_at: cerradaAt || undefined,
    }
  }, [
    lugar,
    horaAtencion,
    sexoAtencion,
    domicilioAtencion,
    idTipo,
    idFolio,
    signos,
    imc,
    complexion,
    exploracion,
    integracion,
    dictamen,
    dictamenTexto,
    medicoNombre,
    medicoCedula,
    medicoTitulo,
    medicoUniversidad,
    antecedentes,
    cerradaAt,
  ])

  const runSave = (finalize: boolean) => {
    setSaveError('')
    setSaveMsg('')
    startTransition(async () => {
      const res = await saveCertificadoMedico(
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
      setSaveMsg(finalize ? 'Certificado cerrado y guardado.' : 'Borrador guardado.')
    })
  }

  const inputClass =
    'w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500'

  const pdfHref = `/api/pdf/certificado-medico/${eventId}?eventTestId=${encodeURIComponent(eventTestId)}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              activeTab === t.id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'antecedentes' && (
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-3">
            El PDF arma las secciones I–III a partir de estos datos (y actualiza el historial del
            paciente al guardar).
          </p>
          <AntecedentesCaptura
            value={antecedentes as AntecedentesCapturaData}
            onChange={(next) => setAntecedentes(next as Record<string, unknown>)}
            workerId={workerId}
            readonly={readonly}
            modulo1={{}}
            onModulo1Change={() => {}}
          />
        </section>
      )}

      {activeTab === 'vitales' && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white border border-slate-200 rounded-xl p-4">
          {(
            [
              ['peso_kg', 'Peso (kg)'],
              ['talla_m', 'Talla (m)'],
              ['ta_sistolica', 'TA sistólica'],
              ['ta_diastolica', 'TA diastólica'],
              ['fc_min', 'FC (lpm)'],
              ['fr_min', 'FR (rpm)'],
              ['temperatura', 'Temperatura (°C)'],
              ['spo2_pct', 'SpO₂ (%)'],
              ['agudeza_vl', 'Agudeza VL'],
              ['agudeza_vlc', 'Agudeza VLC'],
              ['agudeza_vc', 'Agudeza VC'],
              ['agudeza_vcc', 'Agudeza VCC'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
              <input
                className={inputClass}
                value={signos[key]}
                onChange={(e) => setSignos((s) => ({ ...s, [key]: e.target.value }))}
                disabled={readonly}
              />
            </div>
          ))}
          <div className="col-span-2 sm:col-span-3 text-xs text-slate-500">
            IMC calculado: {imc || '—'} {complexion ? `· ${complexion}` : ''}
          </div>
        </section>
      )}

      {activeTab === 'exploracion' && (
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Exploración física (V)</label>
          <textarea
            className={`${inputClass} min-h-[200px]`}
            value={exploracion}
            onChange={(e) => setExploracion(e.target.value)}
            disabled={readonly}
          />
        </section>
      )}

      {activeTab === 'dictamen' && (
        <section className="space-y-3 bg-white border border-slate-200 rounded-xl p-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              Integración diagnóstica (VI)
            </label>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={integracion}
              onChange={(e) => setIntegracion(e.target.value)}
              placeholder="Diagnóstico o integración clínica en prosa breve"
              disabled={readonly}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Dictamen laboral</label>
            <select
              className={inputClass}
              value={dictamen}
              onChange={(e) => onDictamenChange(e.target.value as DictamenLaboralValue)}
              disabled={readonly}
            >
              {DICTAMEN_LABORAL_VALUES.map((v) => (
                <option key={v} value={v}>
                  {DICTAMEN_LABORAL_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              Frase para el PDF
            </label>
            <textarea
              className={`${inputClass} min-h-[72px]`}
              value={dictamenTexto}
              onChange={(e) => setDictamenTexto(e.target.value)}
              disabled={readonly}
            />
          </div>
        </section>
      )}

      {activeTab === 'cierre' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Lugar de expedición</label>
              <input
                className={inputClass}
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                disabled={readonly}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Hora de atención</label>
              <input
                className={inputClass}
                value={horaAtencion}
                onChange={(e) => setHoraAtencion(e.target.value)}
                placeholder="12:00"
                disabled={readonly}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Sexo (PDF)</label>
              <input
                className={inputClass}
                value={sexoAtencion}
                onChange={(e) => setSexoAtencion(e.target.value)}
                placeholder="Opcional si está en historial"
                disabled={readonly}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Domicilio (PDF)</label>
              <input
                className={inputClass}
                value={domicilioAtencion}
                onChange={(e) => setDomicilioAtencion(e.target.value)}
                disabled={readonly}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Identificación</label>
              <input
                className={inputClass}
                value={idTipo}
                onChange={(e) => setIdTipo(e.target.value)}
                disabled={readonly}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Folio / CURP</label>
              <input
                className={inputClass}
                value={idFolio}
                onChange={(e) => setIdFolio(e.target.value)}
                disabled={readonly}
              />
            </div>
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
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Título</label>
              <input
                className={inputClass}
                value={medicoTitulo}
                onChange={(e) => setMedicoTitulo(e.target.value)}
                disabled={readonly}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Universidad (opcional)</label>
              <input
                className={inputClass}
                value={medicoUniversidad}
                onChange={(e) => setMedicoUniversidad(e.target.value)}
                disabled={readonly}
              />
            </div>
          </div>
          {Boolean(cerradaAt) && (
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
            >
              📄 Certificado médico (PDF)
            </a>
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
            Cerrar certificado
          </button>
          {saveMsg && <span className="text-xs text-emerald-700 font-medium">{saveMsg}</span>}
          {saveError && <span className="text-xs text-red-600 font-medium">{saveError}</span>}
        </div>
      )}
    </div>
  )
}
