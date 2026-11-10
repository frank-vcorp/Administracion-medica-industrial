'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { saveConsultaMedica } from '@/actions/consulta-medica.actions'
import ConsultaSeguimientoAgenda from '@/components/clinical/ConsultaSeguimientoAgenda'
import { getCurrentDoctorProfile } from '@/actions/doctor-profile.actions'
import { AntecedentesCaptura } from '@/components/clinical/AntecedentesCaptura'
import { ConsultaAntecedentesResumen } from '@/components/clinical/ConsultaAntecedentesResumen'
import { ClinicalAutosaveIndicator } from '@/components/clinical/ClinicalAutosaveIndicator'
import { UserFacingErrorCallout } from '@/components/clinical/UserFacingErrorCallout'
import {
  ClinicalFreeTextInput,
  ClinicalTextarea,
} from '@/components/clinical/ClinicalFreeTextControls'
import { useClinicalIntervalAutosave } from '@/lib/hooks/useClinicalIntervalAutosave'
import ConsultaDerivadosStudiesPicker from '@/components/clinical/ConsultaDerivadosStudiesPicker'
import { mapSaveClinicalFailure, type UserFacingError } from '@/lib/user-facing-error'
import { Cie10Autocomplete, type Cie10Selection } from '@/components/clinical/Cie10Autocomplete'
import { parseConsultaMedicaClinicalContext } from '@/lib/clinical/consulta-medica'
import { buildProximaCitaFields, formatProximaCitaLine } from '@/lib/clinical/consulta-seguimiento'
import {
  formatCie10Unified,
  parseDiagnosticoUnificadoDisplay,
} from '@/lib/clinical/cie-10-format'
import {
  mergeProfileAntecedentesIntoConsulta,
  modulo1Record,
} from '@/lib/clinical/consulta-antecedentes'
import {
  mergeAntecedentesConsultaResumen,
  suggestAntecedentesConsultaFromProfile,
} from '@/lib/clinical/consulta-antecedentes-resumen'
import {
  CONSULTA_MEDICA_SCHEMA_VERSION,
  TIPO_CONSULTA_VALUES,
  TIPO_CONSULTA_LABELS,
  TIPO_INCAPACIDAD_CONSULTA_VALUES,
  TIPO_INCAPACIDAD_CONSULTA_LABELS,
  buildDefaultExploracionPlantilla,
  emptySignosVitalesConsulta,
  type ConsultaMedicaPayload,
  type RecetaLinea,
  type TipoConsultaValue,
  type TipoIncapacidadConsultaValue,
} from '@/schemas/clinical/consulta-medica.constants'
import type { AntecedentesCaptura as AntecedentesCapturaData } from '@/schemas/clinical/exam.schema'

type TabId =
  | 'motivo'
  | 'vitales'
  | 'antecedentes'
  | 'exploracion'
  | 'diagnostico'
  | 'tratamiento'
  | 'derivados'
  | 'seguimiento'
  | 'cierre'

const TABS: { id: TabId; label: string }[] = [
  { id: 'motivo', label: 'Motivo' },
  { id: 'vitales', label: 'Signos vitales' },
  { id: 'antecedentes', label: 'Antecedentes' },
  { id: 'exploracion', label: 'Exploración' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'tratamiento', label: 'Tratamiento' },
  { id: 'derivados', label: 'Estudios derivados' },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'cierre', label: 'Cierre' },
]

function emptyRecetaLine(): RecetaLinea {
  return { medicamento: '', presentacion: '', dosis: '', frecuencia: '', duracion: '' }
}

export default function ConsultaMedicaEstudio({
  eventId,
  eventTestId,
  workerId,
  initialClinicalContext,
  longitudinalData,
  profileAntecedentes,
  profileModulo1,
  readonly = false,
}: {
  eventId: string
  eventTestId: string
  workerId: string
  initialClinicalContext: unknown
  longitudinalData?: Record<string, unknown> | null
  /** Snapshot de antecedentes del examen de esta visita, si el perfil aplica. */
  profileAntecedentes?: Record<string, unknown> | null
  /** Módulo 1 (gineco / vacunas) del examen, ya viviendo dentro de antecedentes. */
  profileModulo1?: Record<string, string> | null
  readonly?: boolean
}) {
  const { data: session } = useSession()
  const parsed = parseConsultaMedicaClinicalContext(initialClinicalContext)

  const [activeTab, setActiveTab] = useState<TabId>('motivo')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState<UserFacingError | null>(null)
  const [isPending, startTransition] = useTransition()

  const [tipoConsulta, setTipoConsulta] = useState<TipoConsultaValue>(
    parsed?.tipo_consulta ?? 'ENFERMEDAD_GENERAL',
  )
  const [motivo, setMotivo] = useState(parsed?.motivo_consulta ?? '')
  const [signos, setSignos] = useState(parsed?.signos_vitales ?? emptySignosVitalesConsulta())
  const [exploracion, setExploracion] = useState(
    parsed?.exploracion_fisica ?? buildDefaultExploracionPlantilla(),
  )
  const [diagCie, setDiagCie] = useState<Cie10Selection | null>(() => {
    return parseDiagnosticoUnificadoDisplay(parsed?.diagnostico_unificado)
  })
  const [diagEspecifico, setDiagEspecifico] = useState(parsed?.diagnostico_especifico ?? '')
  const [otorgaIncap, setOtorgaIncap] = useState<'SI' | 'NO'>(parsed?.otorga_incapacidad ?? 'NO')
  const [tipoIncap, setTipoIncap] = useState<TipoIncapacidadConsultaValue>(() => {
    const t = parsed?.tipo_incapacidad
    if (t && TIPO_INCAPACIDAD_CONSULTA_VALUES.includes(t)) return t
    if (parsed?.otorga_incapacidad === 'SI') {
      if (parsed?.pase_salida === 'SI') return 'PASE_SALIDA'
      const d = parsed?.dias_incapacidad
      if (typeof d === 'number' && d > 0) return 'INTERNA_SME'
      return 'IMSS'
    }
    return 'NINGUNA'
  })
  const [diasIncap, setDiasIncap] = useState(String(parsed?.dias_incapacidad ?? ''))
  const [materialMedico, setMaterialMedico] = useState(parsed?.material_medico ?? '')
  const [indicaciones, setIndicaciones] = useState(parsed?.indicaciones_generales ?? '')
  const [proximaCitaFecha, setProximaCitaFecha] = useState(parsed?.proxima_cita_fecha ?? '')
  const [proximaCitaHora, setProximaCitaHora] = useState(parsed?.proxima_cita_hora ?? '')
  const [proximaCitaAppointmentId, setProximaCitaAppointmentId] = useState(
    parsed?.proxima_cita_appointment_id ?? '',
  )
  const [recetaLineas, setRecetaLineas] = useState<RecetaLinea[]>(
    parsed?.receta_lineas?.length ? parsed.receta_lineas : [emptyRecetaLine()],
  )
  const [medicoNombre, setMedicoNombre] = useState(
    parsed?.medico_nombre ?? session?.user?.fullName ?? session?.user?.name ?? '',
  )
  const [medicoCedula, setMedicoCedula] = useState(parsed?.medico_cedula ?? '')
  const initialAntecedentesMerged = useMemo(
    () =>
      mergeProfileAntecedentesIntoConsulta(
        parsed?.antecedentes,
        longitudinalData,
        profileAntecedentes,
      ),
    [parsed?.antecedentes, longitudinalData, profileAntecedentes],
  )

  const [antecedentes, setAntecedentes] = useState<Record<string, unknown>>(
    () => initialAntecedentesMerged,
  )

  const [antecedentesConsulta, setAntecedentesConsulta] = useState(() =>
    mergeAntecedentesConsultaResumen(
      parsed?.antecedentes_consulta,
      suggestAntecedentesConsultaFromProfile(initialAntecedentesMerged),
    ),
  )
  const antecedentesHydratedRef = useRef(false)
  useEffect(() => {
    if (antecedentesHydratedRef.current) return
    antecedentesHydratedRef.current = true
    setAntecedentes((prev) =>
      mergeProfileAntecedentesIntoConsulta(parsed?.antecedentes ?? prev, longitudinalData, profileAntecedentes),
    )
  }, [longitudinalData, profileAntecedentes, parsed?.antecedentes])
  const [modulo1, setModulo1] = useState<Record<string, string>>(() => {
    const saved = modulo1Record(parsed?.modulo1)
    if (Object.values(saved).some((value) => value.trim() !== '')) return saved
    return modulo1Record(profileModulo1)
  })
  const [cerradaAt, setCerradaAt] = useState(parsed?.cerrada_at ?? '')
  const [hasPersisted, setHasPersisted] = useState(Boolean(parsed))

  useEffect(() => {
    const savedName = parsed?.medico_nombre?.trim() ?? ''
    const savedLicense = parsed?.medico_cedula?.trim() ?? ''
    if (savedName && savedLicense && savedLicense !== '—') return
    let cancelled = false
    void getCurrentDoctorProfile().then((res) => {
      if (cancelled || !res.success) return
      const name = res.profile.fullName?.trim() ?? ''
      const license = res.profile.professionalLicense?.trim() ?? ''
      if (!savedName && name) setMedicoNombre(name)
      if ((!savedLicense || savedLicense === '—') && license) setMedicoCedula(license)
    })
    return () => {
      cancelled = true
    }
  }, [parsed?.medico_cedula, parsed?.medico_nombre])

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
      diagnostico_unificado: diagCie ? formatCie10Unified(diagCie) : '',
      diagnostico_especifico: diagEspecifico.trim(),
      incapacidad_aplica: otorgaIncap === 'SI',
      otorga_incapacidad: otorgaIncap,
      tipo_incapacidad:
        otorgaIncap === 'SI' && tipoIncap !== 'NINGUNA' ? tipoIncap : undefined,
      dias_incapacidad:
        otorgaIncap === 'SI' && tipoIncap === 'INTERNA_SME'
          ? (() => {
              const n = parseInt(diasIncap.trim(), 10)
              return Number.isFinite(n) && n >= 1 ? n : undefined
            })()
          : undefined,
      material_medico: materialMedico.trim() || undefined,
      indicaciones_generales: indicaciones.trim() || undefined,
      ...buildProximaCitaFields({
        fecha: proximaCitaFecha,
        hora: proximaCitaHora,
        appointmentId: proximaCitaAppointmentId,
      }),
      receta_lineas: lineas,
      medico_nombre: medicoNombre.trim() || session?.user?.fullName || session?.user?.name || 'Médico',
      medico_cedula: medicoCedula.trim() || '—',
      antecedentes: antecedentes as ConsultaMedicaPayload['antecedentes'],
      antecedentes_consulta: antecedentesConsulta,
      modulo1,
      cerrada_at: cerradaAt || undefined,
    }
  }, [
    tipoConsulta,
    motivo,
    signos,
    imc,
    complexion,
    exploracion,
    diagCie,
    diagEspecifico,
    otorgaIncap,
    tipoIncap,
    diasIncap,
    materialMedico,
    indicaciones,
    proximaCitaFecha,
    proximaCitaHora,
    proximaCitaAppointmentId,
    recetaLineas,
    medicoNombre,
    medicoCedula,
    antecedentes,
    antecedentesConsulta,
    modulo1,
    cerradaAt,
    session?.user?.fullName,
    session?.user?.name,
  ])

  useEffect(() => {
    if (otorgaIncap === 'NO') {
      setTipoIncap('NINGUNA')
      setDiasIncap('')
      return
    }
    setTipoIncap((prev) => (prev === 'NINGUNA' ? 'IMSS' : prev))
  }, [otorgaIncap])

  const consultaSnapshotKey = useMemo(() => JSON.stringify(buildPayload()), [buildPayload])

  const persistConsultaDraft = useCallback(async () => {
    const res = await saveConsultaMedica(
      eventTestId,
      eventId,
      workerId,
      buildPayload(),
      { finalize: false },
    )
    if (!res.success) {
      return {
        ok: false,
        message: res.error,
        fieldErrors: res.fieldErrors,
        technicalDetail: res.technicalDetail,
        context: 'Consulta médica (autoguardado)',
      } as const
    }
    setHasPersisted(true)
    return true
  }, [eventTestId, eventId, workerId, buildPayload])

  const autosaveEnabled = !readonly && !cerradaAt
  const { statusLabel: autosaveLabel, markSaved: markConsultaSaved, userFacingError: consultaAutosaveError } =
    useClinicalIntervalAutosave({
    enabled: autosaveEnabled,
    snapshotKey: consultaSnapshotKey,
    save: persistConsultaDraft,
  })

  const runSave = (finalize: boolean) => {
    setSaveError(null)
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
        setSaveError(
          mapSaveClinicalFailure(
            {
              success: false,
              error: res.error,
              fieldErrors: res.fieldErrors,
              technicalDetail: res.technicalDetail,
            },
            { context: finalize ? 'Consulta médica (cierre)' : 'Consulta médica (borrador)' },
          ),
        )
        return
      }
      if (finalize && res.payload.cerrada_at) {
        setCerradaAt(res.payload.cerrada_at)
      }
      markConsultaSaved()
      setHasPersisted(true)
      setSaveMsg(finalize ? 'Consulta cerrada y guardada.' : 'Borrador guardado.')
    })
  }

  const inputClass =
    'w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-400 border-none p-2.5 rounded-lg text-sm outline-none disabled:opacity-60'

  const seguimientoAgendado = formatProximaCitaLine({
    proxima_cita_fecha: proximaCitaFecha,
    proxima_cita_hora: proximaCitaHora,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5">
        <span className="text-teal-700 text-lg">🩺</span>
        <div>
          <p className="text-sm font-bold text-teal-900">Consulta médica</p>
          <p className="text-xs text-teal-700">
            Nota clínica + receta · Borrador con autoguardado cada 7 s (incluye antecedentes en el
            perfil del paciente)
          </p>
          <ClinicalAutosaveIndicator
            label={autosaveEnabled ? autosaveLabel : null}
            error={autosaveEnabled ? consultaAutosaveError : null}
            className="mt-1"
          />
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
            <ClinicalTextarea
              className={`${inputClass} min-h-[140px]`}
              value={motivo}
              onChange={setMotivo}
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
        <section className="space-y-4">
          <ConsultaAntecedentesResumen
            value={antecedentesConsulta}
            onChange={setAntecedentesConsulta}
            readonly={readonly}
          />
          {!readonly && (
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs font-bold text-teal-700 hover:text-teal-900 underline"
                onClick={() =>
                  setAntecedentesConsulta(suggestAntecedentesConsultaFromProfile(antecedentes))
                }
              >
                Precargar 6 rubros desde cuestionario estructurado
              </button>
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
          <AntecedentesCaptura
            value={antecedentes as AntecedentesCapturaData}
            onChange={(next) => setAntecedentes(next as Record<string, unknown>)}
            workerId={workerId}
            readonly={readonly}
            modulo1={modulo1}
            onModulo1Change={setModulo1}
          />
          <p className="text-[10px] text-slate-500 mt-3">
            Precarga desde historial clínico longitudinal (y examen previo si aplica). Al guardar, se
            actualizan en{' '}
            <Link href={`/history/${workerId}`} className="text-teal-600 underline">
              Historia clínica del paciente
            </Link>
            .
          </p>
          </div>
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
          <ClinicalTextarea
            className={`${inputClass} min-h-[200px]`}
            value={exploracion}
            onChange={setExploracion}
            disabled={readonly}
          />
        </section>
      )}

      {activeTab === 'diagnostico' && (
        <section className="space-y-3 bg-white border border-slate-200 rounded-xl p-4">
          <Cie10Autocomplete
            value={diagCie}
            onChange={setDiagCie}
            disabled={readonly}
            inputClassName={inputClass}
          />
          <ClinicalTextarea
            className={`${inputClass} min-h-[80px]`}
            placeholder="Diagnóstico específico"
            value={diagEspecifico}
            onChange={setDiagEspecifico}
            disabled={readonly}
            spellCheck
          />
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Incapacidad</p>
            <p className="text-xs text-slate-500">¿Requiere incapacidad?</p>
            <div className="flex gap-4">
              {(['SI', 'NO'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={otorgaIncap === v}
                    onChange={() => setOtorgaIncap(v)}
                    disabled={readonly}
                  />
                  {v === 'SI' ? 'Sí' : 'No'}
                </label>
              ))}
            </div>
            {otorgaIncap === 'SI' && (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Tipo</span>
                  <select
                    className={`${inputClass} mt-1`}
                    value={tipoIncap}
                    onChange={(e) =>
                      setTipoIncap(e.target.value as TipoIncapacidadConsultaValue)
                    }
                    disabled={readonly}
                  >
                    {(['PASE_SALIDA', 'INTERNA_SME', 'IMSS'] as const).map((k) => (
                      <option key={k} value={k}>
                        {TIPO_INCAPACIDAD_CONSULTA_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[10px] text-slate-500">
                  Pase de salida e IMSS no llevan días aquí. Solo incapacidad interna (SME) pide número
                  de días.
                </p>
                {tipoIncap === 'INTERNA_SME' && (
                  <label className="block">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Días (incapacidad interna SME)
                    </span>
                    <input
                      className={`${inputClass} mt-1`}
                      type="number"
                      min={1}
                      max={365}
                      placeholder="Ej. 3"
                      value={diasIncap}
                      onChange={(e) => setDiasIncap(e.target.value)}
                      disabled={readonly}
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'tratamiento' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
          <ClinicalTextarea
            className={`${inputClass} min-h-[80px]`}
            placeholder="Material médico utilizado"
            value={materialMedico}
            onChange={setMaterialMedico}
            disabled={readonly}
          />
          <ClinicalTextarea
            className={`${inputClass} min-h-[80px]`}
            placeholder="Indicaciones generales (dieta, reposo…)"
            value={indicaciones}
            onChange={setIndicaciones}
            disabled={readonly}
          />
          <p className="text-[10px] font-bold text-slate-400 uppercase">Medicamento</p>
          {recetaLineas.map((line, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-100 rounded-lg p-3">
              <ClinicalFreeTextInput
                className={inputClass}
                placeholder="Medicamento"
                value={line.medicamento}
                onChange={(medicamento) => {
                  const next = [...recetaLineas]
                  next[idx] = { ...line, medicamento }
                  setRecetaLineas(next)
                }}
                disabled={readonly}
              />
              <ClinicalFreeTextInput
                className={inputClass}
                placeholder="Presentación"
                value={line.presentacion ?? ''}
                onChange={(presentacion) => {
                  const next = [...recetaLineas]
                  next[idx] = { ...line, presentacion }
                  setRecetaLineas(next)
                }}
                disabled={readonly}
              />
              <ClinicalFreeTextInput
                className={inputClass}
                placeholder="Dosis"
                value={line.dosis}
                onChange={(dosis) => {
                  const next = [...recetaLineas]
                  next[idx] = { ...line, dosis }
                  setRecetaLineas(next)
                }}
                disabled={readonly}
              />
              <ClinicalFreeTextInput
                className={inputClass}
                placeholder="Frecuencia"
                value={line.frecuencia}
                onChange={(frecuencia) => {
                  const next = [...recetaLineas]
                  next[idx] = { ...line, frecuencia }
                  setRecetaLineas(next)
                }}
                disabled={readonly}
              />
              <ClinicalFreeTextInput
                className={inputClass}
                placeholder="Duración"
                value={line.duracion}
                onChange={(duracion) => {
                  const next = [...recetaLineas]
                  next[idx] = { ...line, duracion }
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
          {hasPersisted ? (
            <a
              href={`/api/pdf/consulta-medica/${eventId}/receta`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-teal-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
            >
              Imprimir
            </a>
          ) : (
            <p className="text-xs text-slate-500">Guarda la consulta para imprimir el medicamento.</p>
          )}
        </section>
      )}

      {activeTab === 'derivados' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Estudios derivados (catálogo)
          </p>
          <ConsultaDerivadosStudiesPicker
            eventId={eventId}
            consultaEventTestId={eventTestId}
            readonly={readonly}
          />
        </section>
      )}

      {activeTab === 'seguimiento' && (
        <ConsultaSeguimientoAgenda
          eventId={eventId}
          eventTestId={eventTestId}
          workerId={workerId}
          readonly={readonly}
          scheduledLabel={seguimientoAgendado}
          existingAppointmentId={proximaCitaAppointmentId}
          onScheduled={(scheduled) => {
            setProximaCitaFecha(scheduled.fecha)
            setProximaCitaHora(scheduled.hora)
            setProximaCitaAppointmentId(scheduled.appointmentId)
            setHasPersisted(true)
          }}
        />
      )}

      {activeTab === 'cierre' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
          {!cerradaAt && (
            <p className="text-xs text-slate-500">
              La nota y la receta se imprimen aquí al cerrar la consulta.
            </p>
          )}
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
                Imprimir
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
          {saveError && (
            <div className="w-full min-w-[220px]">
              <UserFacingErrorCallout mapped={saveError} className="border-red-200 bg-red-50/90" />
            </div>
          )}
          <ClinicalAutosaveIndicator
            label={autosaveEnabled ? autosaveLabel : null}
            error={autosaveEnabled ? consultaAutosaveError : null}
          />
        </div>
      )}
    </div>
  )
}
