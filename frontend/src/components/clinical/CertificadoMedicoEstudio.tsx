'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import { getCurrentDoctorProfile } from '@/actions/doctor-profile.actions'
import { saveCertificadoMedico } from '@/actions/certificado-medico.actions'
import { AntecedentesCaptura } from '@/components/clinical/AntecedentesCaptura'
import {
  ClinicalSomaSignosVitalesCapture,
  type SomaSignosVitalesValue,
} from '@/components/clinical/ClinicalSomaSignosVitalesCapture'
import { ClinicalAutosaveIndicator } from '@/components/clinical/ClinicalAutosaveIndicator'
import { UserFacingErrorCallout } from '@/components/clinical/UserFacingErrorCallout'
import { ClinicalTextarea } from '@/components/clinical/ClinicalFreeTextControls'
import { useClinicalIntervalAutosave } from '@/lib/hooks/useClinicalIntervalAutosave'
import { mapSaveClinicalFailure, type UserFacingError } from '@/lib/user-facing-error'
import { mergeCertificadoSignosPrefill } from '@/lib/clinical/certificado-medico-prefill'
import { resolveCertificadoMedicoMetadata } from '@/lib/clinical/certificado-medico-metadata'
import { parseCertificadoMedicoClinicalContext } from '@/lib/clinical/certificado-medico'
import {
  buildIntegracionDiagnosticaCertificado,
  isIntegracionDiagnosticaPlaceholder,
} from '@/lib/clinical/certificado-integracion-diagnostica'
import { computeBmi, complexionFromImc } from '@/lib/clinical/talla-meters'
import {
  clinicalCaptureReadonlyBannerText,
  resolveClinicalStudyReadonly,
} from '@/lib/clinical/papeleta-readonly'
import type { AntecedentesCaptura as AntecedentesCapturaData } from '@/schemas/clinical/exam.schema'
import {
  CERTIFICADO_MEDICO_SCHEMA_VERSION,
  DEFAULT_DICTAMEN_LABORAL_TEXTO,
  DICTAMEN_LABORAL_VALUES,
  DICTAMEN_LABORAL_LABELS,
  buildDefaultExploracionCertificado,
  emptySignosVitalesCertificado,
  type CertificadoMedicoPayload,
  type DictamenLaboralValue,
} from '@/schemas/clinical/certificado-medico.schema'

type TabId = 'antecedentes' | 'vitales' | 'exploracion' | 'dictamen'

const TABS: { id: TabId; label: string }[] = [
  { id: 'antecedentes', label: 'Antecedentes' },
  { id: 'vitales', label: 'Signos vitales' },
  { id: 'exploracion', label: 'Exploración' },
  { id: 'dictamen', label: 'Dictamen' },
]

function CertificadoPdfLink({ href, prominent }: { href: string; prominent?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        prominent
          ? 'inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md transition-colors'
          : 'inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors'
      }
    >
      📄 Generar / descargar certificado (PDF)
    </a>
  )
}

function mergeLongitudinalAntecedentes(
  longitudinal: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!longitudinal || typeof longitudinal !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const key of ['heredo_familiares', 'no_patologicos', 'patologicos']) {
    if (longitudinal[key] && typeof longitudinal[key] === 'object') {
      out[key] = longitudinal[key]
    }
  }
  return out
}

function signosToSomaVitalsValue(
  signos: CertificadoMedicoPayload['signos_vitales'],
): SomaSignosVitalesValue {
  return {
    peso_kg: signos.peso_kg ?? '',
    talla_m: signos.talla_m ?? '',
    imc: signos.imc,
    complexion: signos.complexion,
    ta_sistolica: signos.ta_sistolica ?? '',
    ta_diastolica: signos.ta_diastolica ?? '',
    fc_min: signos.fc_min ?? '',
    fr_min: signos.fr_min ?? '',
    temperatura: signos.temperatura ?? '',
    spo2: signos.spo2_pct ?? '',
  }
}

export default function CertificadoMedicoEstudio({
  eventId,
  eventTestId,
  workerId,
  workerNationalId = null,
  eventAtIso = null,
  initialClinicalContext,
  longitudinalData,
  somatometryData = null,
  eyeAcuityData = null,
  readonly = false,
}: {
  eventId: string
  eventTestId: string
  workerId: string
  workerNationalId?: string | null
  eventAtIso?: string | null
  initialClinicalContext: unknown
  longitudinalData?: Record<string, unknown> | null
  somatometryData?: Record<string, unknown> | null
  eyeAcuityData?: Record<string, unknown> | null
  readonly?: boolean
}) {
  const { data: session } = useSession()
  const parsed = parseCertificadoMedicoClinicalContext(initialClinicalContext)

  const [doctorProfile, setDoctorProfile] = useState<{
    fullName: string
    professionalLicense: string | null
  } | null>(null)

  const [activeTab, setActiveTab] = useState<TabId>('antecedentes')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState<UserFacingError | null>(null)
  const [isPending, startTransition] = useTransition()

  const [signos, setSignos] = useState(() =>
    mergeCertificadoSignosPrefill(parsed?.signos_vitales, somatometryData, eyeAcuityData),
  )
  const [exploracion, setExploracion] = useState(
    parsed?.exploracion_fisica ?? buildDefaultExploracionCertificado(),
  )
  const [integracion, setIntegracion] = useState(parsed?.integracion_diagnostica ?? '')
  const integracionManualRef = useRef(false)
  const lastAutoIntegracionRef = useRef('')
  const [dictamen, setDictamen] = useState<DictamenLaboralValue>(
    parsed?.dictamen_laboral ?? 'APTO',
  )
  const [dictamenTexto, setDictamenTexto] = useState(
    parsed?.dictamen_laboral_texto ?? DEFAULT_DICTAMEN_LABORAL_TEXTO.APTO,
  )
  const [antecedentes, setAntecedentes] = useState<Record<string, unknown>>(() => ({
    ...mergeLongitudinalAntecedentes(longitudinalData),
    ...(parsed?.antecedentes ?? {}),
  }))
  const [cerradaAt, setCerradaAt] = useState(parsed?.cerrada_at ?? '')
  const editorRole = session?.user?.role
  const formReadonly = useMemo(
    () => resolveClinicalStudyReadonly(readonly, Boolean(cerradaAt), editorRole),
    [readonly, cerradaAt, editorRole],
  )
  const readonlyBanner = clinicalCaptureReadonlyBannerText(
    formReadonly,
    Boolean(cerradaAt),
    editorRole,
  )

  useEffect(() => {
    let cancelled = false
    void getCurrentDoctorProfile().then((res) => {
      if (cancelled || !res.success) return
      setDoctorProfile({
        fullName: res.profile.fullName,
        professionalLicense: res.profile.professionalLicense,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const { imc, imcValue } = useMemo(
    () => computeBmi(signos.peso_kg, signos.talla_m),
    [signos.peso_kg, signos.talla_m],
  )
  const complexion = useMemo(() => complexionFromImc(imcValue), [imcValue])

  const integracionPropuesta = useMemo(
    () =>
      buildIntegracionDiagnosticaCertificado({
        antecedentes,
        signos: {
          ...signos,
          imc: imc || signos.imc,
          complexion: complexion || signos.complexion,
        },
      }),
    [antecedentes, signos, imc, complexion],
  )

  useEffect(() => {
    if (formReadonly) return
    if (integracionManualRef.current) return
    const propuesta = integracionPropuesta.trim()
    if (!propuesta) return
    setIntegracion((current) => {
      const trimmed = current.trim()
      const lastAuto = lastAutoIntegracionRef.current
      const replaceable =
        isIntegracionDiagnosticaPlaceholder(trimmed) ||
        (lastAuto !== '' && trimmed === lastAuto)
      if (!replaceable || trimmed === propuesta) return current
      lastAutoIntegracionRef.current = propuesta
      return propuesta
    })
  }, [integracionPropuesta, formReadonly])

  const resolvedMetadata = useMemo(
    () =>
      resolveCertificadoMedicoMetadata({
        parsed,
        workerNationalId,
        longitudinalData: longitudinalData ?? null,
        doctorFullName: doctorProfile?.fullName ?? null,
        doctorLicense: doctorProfile?.professionalLicense ?? null,
        sessionUserName: session?.user?.name ?? null,
        eventAt: eventAtIso,
      }),
    [
      parsed,
      workerNationalId,
      longitudinalData,
      doctorProfile,
      session?.user?.name,
      eventAtIso,
    ],
  )

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
      ...resolvedMetadata,
      signos_vitales: sv,
      exploracion_fisica: exploracion.trim(),
      integracion_diagnostica: integracion.trim(),
      dictamen_laboral: dictamen,
      dictamen_laboral_texto: dictamenTexto.trim(),
      antecedentes: antecedentes as CertificadoMedicoPayload['antecedentes'],
      cerrada_at: cerradaAt || undefined,
    }
  }, [
    resolvedMetadata,
    signos,
    imc,
    complexion,
    exploracion,
    integracion,
    dictamen,
    dictamenTexto,
    antecedentes,
    cerradaAt,
  ])

  const certificadoSnapshotKey = useMemo(() => JSON.stringify(buildPayload()), [buildPayload])

  const persistCertificadoDraft = useCallback(async () => {
    const res = await saveCertificadoMedico(
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
        context: 'Certificado médico (autoguardado)',
      } as const
    }
    return true
  }, [eventTestId, eventId, workerId, buildPayload])

  const autosaveEnabled = !formReadonly && !cerradaAt
  const { statusLabel: autosaveLabel, markSaved: markCertificadoSaved, userFacingError: certAutosaveError } =
    useClinicalIntervalAutosave({
    enabled: autosaveEnabled,
    snapshotKey: certificadoSnapshotKey,
    save: persistCertificadoDraft,
  })

  const runSave = (finalize: boolean) => {
    setSaveError(null)
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
        setSaveError(
          mapSaveClinicalFailure(
            {
              success: false,
              error: res.error,
              fieldErrors: res.fieldErrors,
              technicalDetail: res.technicalDetail,
            },
            { context: finalize ? 'Certificado médico (cierre)' : 'Certificado médico (borrador)' },
          ),
        )
        return
      }
      if (finalize && res.payload.cerrada_at) {
        setCerradaAt(res.payload.cerrada_at)
      }
      markCertificadoSaved()
      setSaveMsg(finalize ? 'Certificado cerrado y guardado.' : 'Borrador guardado.')
    })
  }

  const inputClass =
    'w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500'

  const pdfHref = `/api/pdf/certificado-medico/${eventId}?eventTestId=${encodeURIComponent(eventTestId)}`

  return (
    <div className="space-y-4">
      <ClinicalAutosaveIndicator
        label={autosaveEnabled ? autosaveLabel : null}
        error={autosaveEnabled ? certAutosaveError : null}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-1">
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
        {Boolean(cerradaAt) && <CertificadoPdfLink href={pdfHref} prominent />}
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
            readonly={formReadonly}
            captureLayout="certificado"
            modulo1={{}}
            onModulo1Change={() => {}}
          />
        </section>
      )}

      {activeTab === 'vitales' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">
            Mismos campos de somatometría y signos vitales que el examen médico. Se precargan desde
            los estudios del evento cuando aún no hay captura en el certificado.
          </p>
          <ClinicalSomaSignosVitalesCapture
            value={signosToSomaVitalsValue(signos)}
            onChange={(next) =>
              setSignos((s) => ({
                ...s,
                peso_kg: next.peso_kg,
                talla_m: next.talla_m,
                ta_sistolica: next.ta_sistolica,
                ta_diastolica: next.ta_diastolica,
                fc_min: next.fc_min,
                fr_min: next.fr_min,
                temperatura: next.temperatura,
                spo2_pct: next.spo2,
              }))
            }
            readonly={formReadonly}
            spo2Field="spo2_pct"
            sexoForPrediagnosis={resolvedMetadata.sexo_atencion?.trim() || undefined}
            inputClass={inputClass}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <p className="sm:col-span-2 text-[10px] font-semibold text-slate-500">
              Agudeza visual (PDF)
            </p>
            {(
              [
                ['agudeza_vl', 'Agudeza VL'],
                ['agudeza_vlc', 'Agudeza VLC'],
                ['agudeza_vc', 'Agudeza VC'],
                ['agudeza_vcc', 'Agudeza VCC'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] font-semibold text-slate-500">{label}</label>
                <input
                  className={inputClass}
                  value={signos[key]}
                  onChange={(e) => setSignos((s) => ({ ...s, [key]: e.target.value }))}
                  disabled={formReadonly}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'exploracion' && (
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <label className="text-[10px] font-semibold text-slate-500">Exploración física (V)</label>
          <ClinicalTextarea
            className={`${inputClass} min-h-[200px]`}
            value={exploracion}
            onChange={setExploracion}
            disabled={formReadonly}
          />
        </section>
      )}

      {activeTab === 'dictamen' && (
        <section className="space-y-3 bg-white border border-slate-200 rounded-xl p-4">
          <div>
            <label className="text-[10px] font-semibold text-slate-500">
              Integración diagnóstica (VI)
            </label>
            <ClinicalTextarea
              className={`${inputClass} min-h-[80px]`}
              value={integracion}
              onChange={(v) => {
                integracionManualRef.current = true
                setIntegracion(v)
              }}
              placeholder="Diagnóstico o integración clínica en prosa breve"
              disabled={formReadonly}
            />
            {!formReadonly && integracionPropuesta.trim() && (
              <button
                type="button"
                className="mt-2 text-xs font-bold text-teal-700 underline"
                onClick={() => {
                  integracionManualRef.current = false
                  const p = integracionPropuesta.trim()
                  lastAutoIntegracionRef.current = p
                  setIntegracion(p)
                }}
              >
                Regenerar desde antecedentes y signos vitales
              </button>
            )}
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500">Dictamen laboral</label>
            <select
              className={inputClass}
              value={dictamen}
              onChange={(e) => onDictamenChange(e.target.value as DictamenLaboralValue)}
              disabled={formReadonly}
            >
              {DICTAMEN_LABORAL_VALUES.map((v) => (
                <option key={v} value={v}>
                  {DICTAMEN_LABORAL_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500">
              Frase para el PDF
            </label>
            <ClinicalTextarea
              className={`${inputClass} min-h-[72px]`}
              value={dictamenTexto}
              onChange={setDictamenTexto}
              disabled={formReadonly}
            />
          </div>
          {Boolean(cerradaAt) && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
              <CertificadoPdfLink href={pdfHref} prominent />
              <p className="text-[10px] text-slate-500">
                El certificado está cerrado. Lugar, hora, datos del paciente y del médico se tomaron
                del expediente y del evento al guardar.
              </p>
            </div>
          )}
        </section>
      )}

      {readonlyBanner && (
        <div
          className={`border rounded-xl p-3 text-xs text-center ${
            formReadonly
              ? 'bg-slate-50 border-slate-200 text-slate-400'
              : 'bg-teal-50 border-teal-200 text-teal-800'
          }`}
        >
          {readonlyBanner}
        </div>
      )}
      {(Boolean(cerradaAt) || !formReadonly) && (
        <div className="flex flex-wrap gap-2 items-center sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 py-3 -mx-1 px-1 z-10">
          {Boolean(cerradaAt) && <CertificadoPdfLink href={pdfHref} prominent />}
          {!formReadonly && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => runSave(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                Guardar borrador
              </button>
              {!cerradaAt && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => runSave(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  Cerrar certificado
                </button>
              )}
            </>
          )}
          {saveMsg && <span className="text-xs text-emerald-700 font-medium">{saveMsg}</span>}
          {saveError && (
            <div className="w-full min-w-[220px]">
              <UserFacingErrorCallout mapped={saveError} className="border-red-200 bg-red-50/90" />
            </div>
          )}
          {!formReadonly && (
            <ClinicalAutosaveIndicator
              label={autosaveEnabled ? autosaveLabel : null}
              error={autosaveEnabled ? certAutosaveError : null}
            />
          )}
        </div>
      )}
    </div>
  )
}
