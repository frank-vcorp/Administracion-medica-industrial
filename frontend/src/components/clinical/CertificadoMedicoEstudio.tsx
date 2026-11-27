'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import { Mail, MessageSquare } from 'lucide-react'
import { getCurrentDoctorProfile } from '@/actions/doctor-profile.actions'
import {
  saveCertificadoMedico,
  sendCertificadoMedico,
} from '@/actions/certificado-medico.actions'
import { CierreSendModal } from '@/components/clinical/CierreSendModal'
import { AntecedentesCaptura } from '@/components/clinical/AntecedentesCaptura'
import {
  ClinicalSomaSignosVitalesCapture,
  type SomaSignosVitalesValue,
} from '@/components/clinical/ClinicalSomaSignosVitalesCapture'
import { ClinicalAutosaveIndicator } from '@/components/clinical/ClinicalAutosaveIndicator'
import { StudyCaptureMissingBanner } from '@/components/clinical/studies/StudyCaptureUi'
import { UserFacingErrorCallout } from '@/components/clinical/UserFacingErrorCallout'
import { ClinicalTextarea } from '@/components/clinical/ClinicalFreeTextControls'
import { useClinicalIntervalAutosave } from '@/lib/hooks/useClinicalIntervalAutosave'
import { mapSaveClinicalFailure, type UserFacingError } from '@/lib/user-facing-error'
import { mergeCertificadoSignosPrefill } from '@/lib/clinical/certificado-medico-prefill'
import { resolveCertificadoMedicoMetadata } from '@/lib/clinical/certificado-medico-metadata'
import { parseCertificadoMedicoDraftContext } from '@/lib/clinical/certificado-medico'
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
  type CertificadoMedicoPayload,
  type DictamenLaboralValue,
} from '@/schemas/clinical/certificado-medico.schema'
import { visionFieldSelectOptions } from '@/lib/clinical/agudeza-visual'
import { updateAgudezaVisual } from '@/actions/medical-exam.actions'
import {
  ORGANOS_ADJETIVOS,
  buildDefaultOrganosAdjetivosState,
  buildExploracionNarrativaDesdeAdjetivos,
  type OrganosAdjetivosState,
} from '@/lib/clinical/exploracion-adjetivos'

type TabId = 'antecedentes' | 'vitales' | 'exploracion' | 'dictamen'

const TABS: { id: TabId; label: string }[] = [
  { id: 'antecedentes', label: 'Antecedentes' },
  { id: 'vitales', label: 'Signos vitales' },
  { id: 'exploracion', label: 'Exploración' },
  { id: 'dictamen', label: 'Dictamen' },
]

function CertificadoPdfLink({
  href,
  isDraft,
  prominent,
  onBeforeOpen,
}: {
  href: string
  isDraft: boolean
  prominent?: boolean
  onBeforeOpen?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  if (isDraft) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onBeforeOpen}
      data-testid="certificado-pdf-download-link"
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

function deepMergeAntecedentes(
  longitudinal: Record<string, unknown> | null | undefined,
  studySpecific: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const section of ['heredo_familiares', 'no_patologicos', 'patologicos'] as const) {
    const longSec =
      longitudinal?.[section] && typeof longitudinal[section] === 'object'
        ? (longitudinal[section] as Record<string, unknown>)
        : {}
    const studySec =
      studySpecific?.[section] && typeof studySpecific[section] === 'object'
        ? (studySpecific[section] as Record<string, unknown>)
        : {}
    const hasStudyFields = Object.values(studySec).some(
      (v) => v !== null && v !== undefined && (typeof v !== 'object' || Object.keys(v as object).length > 0),
    )
    result[section] = hasStudyFields ? { ...longSec, ...studySec } : longSec
  }
  return result
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
  examModulo1 = null,
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
  examModulo1?: Record<string, unknown> | null
  readonly?: boolean
}) {
  const { data: session } = useSession()
  const parsed = parseCertificadoMedicoDraftContext(initialClinicalContext)

  const [doctorProfile, setDoctorProfile] = useState<{
    fullName: string
    professionalLicense: string | null
  } | null>(null)

  const [activeTab, setActiveTab] = useState<TabId>('antecedentes')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState<UserFacingError | null>(null)
  const [missingFieldsBanner, setMissingFieldsBanner] = useState('')
  const [isPending, startTransition] = useTransition()
  const [sendModal, setSendModal] = useState<{
    isOpen: boolean
    channel: 'email' | 'whatsapp'
  }>({ isOpen: false, channel: 'email' })

  const [signos, setSignos] = useState(() =>
    mergeCertificadoSignosPrefill(parsed?.signos_vitales, somatometryData, eyeAcuityData),
  )

  // Agudeza visual estructurada (Snellen OD / OI)
  const [eyeState, setEyeState] = useState(() => {
    const e = eyeAcuityData ?? {}
    const parsePair = (val: string | undefined) => {
      if (!val || !val.trim()) return { od: 'NO APLICA', oi: 'NO APLICA' }
      const match = val.match(/^(.*?)\s*OD\s*\/\s*(.*?)\s*OI$/i)
      if (match) return { od: match[1].trim(), oi: match[2].trim() }
      const single = val.trim()
      return { od: single, oi: single }
    }
    const initSignos = mergeCertificadoSignosPrefill(parsed?.signos_vitales, somatometryData, eyeAcuityData)
    const vl = parsePair(initSignos.agudeza_vl)
    const vlc = parsePair(initSignos.agudeza_vlc)
    const vc = parsePair(initSignos.agudeza_vc)
    const vcc = parsePair(initSignos.agudeza_vcc)

    return {
      vision_lejana_od: String(e.vision_lejana_od ?? vl.od ?? 'NO APLICA'),
      vision_lejana_oi: String(e.vision_lejana_oi ?? vl.oi ?? 'NO APLICA'),
      lejana_corregida_od: String(e.lejana_corregida_od ?? vlc.od ?? 'NO APLICA'),
      lejana_corregida_oi: String(e.lejana_corregida_oi ?? vlc.oi ?? 'NO APLICA'),
      vision_cercana_od: String(e.vision_cercana_od ?? vc.od ?? 'NO APLICA'),
      vision_cercana_oi: String(e.vision_cercana_oi ?? vc.oi ?? 'NO APLICA'),
      cercana_corregida_od: String(e.cercana_corregida_od ?? vcc.od ?? 'NO APLICA'),
      cercana_corregida_oi: String(e.cercana_corregida_oi ?? vcc.oi ?? 'NO APLICA'),
    }
  })

  const [freeTextAgudeza, setFreeTextAgudeza] = useState(false)

  const handleEyeChange = (field: string, value: string) => {
    const nextEye = { ...eyeState, [field]: value }
    setEyeState(nextEye)

    const formatPair = (od: string, oi: string) => {
      const isOdEmpty = !od || od === 'NO APLICA'
      const isOiEmpty = !oi || oi === 'NO APLICA'
      if (isOdEmpty && isOiEmpty) return ''
      if (!isOdEmpty && !isOiEmpty) return `${od} OD / ${oi} OI`
      if (!isOdEmpty) return `${od} OD`
      return `${oi} OI`
    }

    setSignos((s) => ({
      ...s,
      agudeza_vl: formatPair(nextEye.vision_lejana_od, nextEye.vision_lejana_oi),
      agudeza_vlc: formatPair(nextEye.lejana_corregida_od, nextEye.lejana_corregida_oi),
      agudeza_vc: formatPair(nextEye.vision_cercana_od, nextEye.vision_cercana_oi),
      agudeza_vcc: formatPair(nextEye.cercana_corregida_od, nextEye.cercana_corregida_oi),
    }))

    void updateAgudezaVisual(eventId, nextEye, { autosave: true, revalidate: false }).catch(() => {})
  }
  const [antecedentes, setAntecedentes] = useState<Record<string, unknown>>(() =>
    deepMergeAntecedentes(longitudinalData, parsed?.antecedentes as Record<string, unknown> | undefined),
  )
  const [modulo1, setModulo1] = useState<Record<string, any>>(() => {
    if (parsed && typeof parsed === 'object' && 'modulo1' in parsed) {
      const m1 = (parsed as any).modulo1
      if (m1 && typeof m1 === 'object' && Object.keys(m1).length > 0) {
        return m1
      }
    }
    if (examModulo1 && typeof examModulo1 === 'object' && Object.keys(examModulo1).length > 0) {
      return examModulo1
    }
    if (longitudinalData && typeof longitudinalData === 'object' && 'modulo1' in longitudinalData) {
      const lm1 = (longitudinalData as any).modulo1
      if (lm1 && typeof lm1 === 'object') {
        return lm1
      }
    }
    return {}
  })
  const [adjetivosState, setAdjetivosState] = useState<OrganosAdjetivosState>(() =>
    buildDefaultOrganosAdjetivosState(),
  )
  const [exploracion, setExploracion] = useState(
    parsed?.exploracion_fisica && parsed.exploracion_fisica.trim() !== ''
      ? parsed.exploracion_fisica
      : buildExploracionNarrativaDesdeAdjetivos(buildDefaultOrganosAdjetivosState(), longitudinalData),
  )
  const [showOrganosChecklist, setShowOrganosChecklist] = useState(true)
  const [dictamen, setDictamen] = useState<DictamenLaboralValue>(
    parsed?.dictamen_laboral ?? 'APTO',
  )
  const [dictamenTexto, setDictamenTexto] = useState(
    parsed?.dictamen_laboral_texto ?? DEFAULT_DICTAMEN_LABORAL_TEXTO.APTO,
  )

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

  const [integracion, setIntegracion] = useState(() => {
    const saved = parsed?.integracion_diagnostica?.trim()
    if (saved && !isIntegracionDiagnosticaPlaceholder(saved)) {
      return saved
    }
    return integracionPropuesta.trim()
  })

  const lastPropuestaRef = useRef(integracionPropuesta.trim())

  useEffect(() => {
    if (formReadonly) return
    const propuesta = integracionPropuesta.trim()
    if (!propuesta) return

    // Si los antecedentes o signos cambiaron, la propuesta cambia -> actualizar en tiempo real
    if (lastPropuestaRef.current !== propuesta) {
      lastPropuestaRef.current = propuesta
      setIntegracion(propuesta)
      return
    }

    // Si el texto actual está vacío o es un placeholder genérico, poblarlo con la propuesta
    const currentTrimmed = integracion.trim()
    if (!currentTrimmed || isIntegracionDiagnosticaPlaceholder(currentTrimmed)) {
      if (currentTrimmed !== propuesta) {
        setIntegracion(propuesta)
      }
    }
  }, [integracionPropuesta, formReadonly, integracion])

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
    setDictamenTexto(DEFAULT_DICTAMEN_LABORAL_TEXTO[value] || '')
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
      dictamen_laboral_texto:
        (dictamen === 'OTRO' ? dictamenTexto.trim() : DEFAULT_DICTAMEN_LABORAL_TEXTO[dictamen]) ||
        DEFAULT_DICTAMEN_LABORAL_TEXTO.APTO,
      antecedentes: antecedentes as CertificadoMedicoPayload['antecedentes'],
      modulo1,
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
    modulo1,
    cerradaAt,
  ])

  const certificadoSnapshotKey = useMemo(() => JSON.stringify(buildPayload()), [buildPayload])

  const persistCertificadoDraft = useCallback(async () => {
    const res = await saveCertificadoMedico(
      eventTestId,
      eventId,
      workerId,
      buildPayload(),
      { finalize: false, autosave: true },
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
  const {
    status: autosaveStatus,
    statusLabel: autosaveLabel,
    markSaved: markCertificadoSaved,
    userFacingError: certAutosaveError,
  } = useClinicalIntervalAutosave({
    enabled: autosaveEnabled,
    snapshotKey: certificadoSnapshotKey,
    save: persistCertificadoDraft,
  })

  const runSave = (finalize: boolean) => {
    setSaveError(null)
    setMissingFieldsBanner('')
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
        const mapped = mapSaveClinicalFailure(
          {
            success: false,
            error: res.error,
            fieldErrors: res.fieldErrors,
            technicalDetail: res.technicalDetail,
          },
          { context: finalize ? 'Certificado médico (cierre)' : 'Certificado médico (borrador)' },
        )
        setSaveError(mapped)
        if (mapped.kind === 'validation' || (res.fieldErrors && Object.keys(res.fieldErrors).length > 0)) {
          setMissingFieldsBanner(mapped.userMessage.replace(/\n/g, ' · '))
        }
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

  const isDraft = !cerradaAt
  const pdfHref = `/api/pdf/certificado-medico/${eventId}?eventTestId=${encodeURIComponent(eventTestId)}${isDraft ? '&preview=1' : ''}`

  const handleDraftPreviewClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!isDraft || formReadonly || autosaveStatus !== 'dirty') return
      e.preventDefault()
      const previewWin = window.open('about:blank', '_blank')
      if (previewWin) previewWin.opener = null
      void persistCertificadoDraft().then((ok) => {
        if (ok === true) {
          markCertificadoSaved()
          if (previewWin) {
            previewWin.location.href = pdfHref
          } else {
            window.open(pdfHref, '_blank', 'noopener,noreferrer')
          }
          return
        }
        previewWin?.close()
        setSaveError(
          mapSaveClinicalFailure(
            {
              success: false,
              error:
                typeof ok === 'object' && ok.message
                  ? ok.message
                  : 'No se pudo guardar el borrador para la vista previa.',
              fieldErrors: typeof ok === 'object' ? ok.fieldErrors : undefined,
              technicalDetail: typeof ok === 'object' ? ok.technicalDetail : undefined,
            },
            { context: 'Certificado médico (vista previa)' },
          ),
        )
      })
    },
    [
      isDraft,
      formReadonly,
      autosaveStatus,
      persistCertificadoDraft,
      markCertificadoSaved,
      pdfHref,
    ],
  )

  return (
    <div className="space-y-4">
      <StudyCaptureMissingBanner message={missingFieldsBanner} />
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
      </div>

      {activeTab === 'antecedentes' && (
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <AntecedentesCaptura
            value={antecedentes as AntecedentesCapturaData}
            onChange={(next) => setAntecedentes(next as Record<string, unknown>)}
            workerId={workerId}
            readonly={formReadonly}
            captureLayout="certificado"
            modulo1={modulo1}
            onModulo1Change={setModulo1}
          />
        </section>
      )}

      {activeTab === 'vitales' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
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
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>👁️</span> Agudeza visual (Snellen OD / OI)
                </p>
                <p className="text-[11px] text-slate-500">
                  Selecciona la agudeza visual. Se formatea automáticamente para el PDF y se guarda en el expediente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFreeTextAgudeza((prev) => !prev)}
                className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 underline self-start sm:self-auto cursor-pointer"
              >
                {freeTextAgudeza ? '← Usar selectores Snellen' : 'Editar texto libre directo'}
              </button>
            </div>

            {!freeTextAgudeza ? (
              <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                {/* 1. Visión Lejana */}
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    1. Visión Lejana (sin lentes)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500">Ojo Derecho (OD)</label>
                      <select
                        value={eyeState.vision_lejana_od}
                        onChange={(e) => handleEyeChange('vision_lejana_od', e.target.value)}
                        disabled={formReadonly}
                        className={`${inputClass} font-mono bg-white`}
                      >
                        {visionFieldSelectOptions('vision_lejana_od', eyeState.vision_lejana_od).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500">Ojo Izquierdo (OI)</label>
                      <select
                        value={eyeState.vision_lejana_oi}
                        onChange={(e) => handleEyeChange('vision_lejana_oi', e.target.value)}
                        disabled={formReadonly}
                        className={`${inputClass} font-mono bg-white`}
                      >
                        {visionFieldSelectOptions('vision_lejana_oi', eyeState.vision_lejana_oi).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Visión Lejana Corregida */}
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    2. Visión Lejana Corregida (con lentes)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500">Ojo Derecho (OD)</label>
                      <select
                        value={eyeState.lejana_corregida_od}
                        onChange={(e) => handleEyeChange('lejana_corregida_od', e.target.value)}
                        disabled={formReadonly}
                        className={`${inputClass} font-mono bg-white`}
                      >
                        {visionFieldSelectOptions('lejana_corregida_od', eyeState.lejana_corregida_od).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500">Ojo Izquierdo (OI)</label>
                      <select
                        value={eyeState.lejana_corregida_oi}
                        onChange={(e) => handleEyeChange('lejana_corregida_oi', e.target.value)}
                        disabled={formReadonly}
                        className={`${inputClass} font-mono bg-white`}
                      >
                        {visionFieldSelectOptions('lejana_corregida_oi', eyeState.lejana_corregida_oi).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Visión Cercana */}
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    3. Visión Cercana (sin lentes)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500">Ojo Derecho (OD)</label>
                      <select
                        value={eyeState.vision_cercana_od}
                        onChange={(e) => handleEyeChange('vision_cercana_od', e.target.value)}
                        disabled={formReadonly}
                        className={`${inputClass} font-mono bg-white`}
                      >
                        {visionFieldSelectOptions('vision_cercana_od', eyeState.vision_cercana_od).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500">Ojo Izquierdo (OI)</label>
                      <select
                        value={eyeState.vision_cercana_oi}
                        onChange={(e) => handleEyeChange('vision_cercana_oi', e.target.value)}
                        disabled={formReadonly}
                        className={`${inputClass} font-mono bg-white`}
                      >
                        {visionFieldSelectOptions('vision_cercana_oi', eyeState.vision_cercana_oi).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Visión Cercana Corregida */}
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    4. Visión Cercana Corregida (con lentes)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500">Ojo Derecho (OD)</label>
                      <select
                        value={eyeState.cercana_corregida_od}
                        onChange={(e) => handleEyeChange('cercana_corregida_od', e.target.value)}
                        disabled={formReadonly}
                        className={`${inputClass} font-mono bg-white`}
                      >
                        {visionFieldSelectOptions('cercana_corregida_od', eyeState.cercana_corregida_od).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500">Ojo Izquierdo (OI)</label>
                      <select
                        value={eyeState.cercana_corregida_oi}
                        onChange={(e) => handleEyeChange('cercana_corregida_oi', e.target.value)}
                        disabled={formReadonly}
                        className={`${inputClass} font-mono bg-white`}
                      >
                        {visionFieldSelectOptions('cercana_corregida_oi', eyeState.cercana_corregida_oi).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Resumen formateado para PDF */}
                <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                  <span><strong>VL:</strong> {signos.agudeza_vl || '—'}</span>
                  <span><strong>VLC:</strong> {signos.agudeza_vlc || '—'}</span>
                  <span><strong>VC:</strong> {signos.agudeza_vc || '—'}</span>
                  <span><strong>VCC:</strong> {signos.agudeza_vcc || '—'}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ['agudeza_vl', 'Agudeza VL (Lejana)'],
                    ['agudeza_vlc', 'Agudeza VLC (Lejana corregida)'],
                    ['agudeza_vc', 'Agudeza VC (Cercana)'],
                    ['agudeza_vcc', 'Agudeza VCC (Cercana corregida)'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-[10px] font-semibold text-slate-500">{label}</label>
                    <input
                      className={inputClass}
                      value={signos[key] ?? ''}
                      onChange={(e) => setSignos((s) => ({ ...s, [key]: e.target.value }))}
                      disabled={formReadonly}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'exploracion' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>🩺</span> Exploración física (V) — Adjetivos por órgano
              </p>
              <p className="text-[11px] text-slate-500">
                Selecciona los adjetivos de cada órgano. El formato narrativo oficial se genera automáticamente en tiempo real.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const def = buildDefaultOrganosAdjetivosState()
                  setAdjetivosState(def)
                  setExploracion(buildExploracionNarrativaDesdeAdjetivos(def, antecedentes))
                }}
                disabled={formReadonly}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Restablece todos los órganos a su valor normal estándar"
              >
                ↺ Restablecer todo normal
              </button>
            </div>
          </div>

          {/* Selector de Adjetivos por Órgano */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>📋</span> Revisión por órganos (adjetivos clínicos)
              </span>
              <button
                type="button"
                onClick={() => setShowOrganosChecklist((v) => !v)}
                className="text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
              >
                {showOrganosChecklist ? 'Ocultar panel ▲' : 'Mostrar panel ▼'}
              </button>
            </div>

            {showOrganosChecklist && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {ORGANOS_ADJETIVOS.map((organo) => {
                  const st = adjetivosState[organo.id] ?? { selectedIds: [], notaLibre: '' }
                  const hasAbnormal =
                    organo.opciones.some(
                      (opt) => !opt.esNormal && st.selectedIds.includes(opt.id),
                    ) || Boolean(st.notaLibre?.trim())

                  return (
                    <div
                      key={organo.id}
                      className={`p-3 rounded-xl border transition-colors ${
                        hasAbnormal ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{organo.icono}</span>
                          <span>{organo.nombre}</span>
                        </span>
                        {hasAbnormal && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Hallazgo
                          </span>
                        )}
                      </div>

                      {/* Chips de adjetivos */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {organo.opciones.map((opt) => {
                          const isSelected = st.selectedIds.includes(opt.id)
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={formReadonly}
                              onClick={() => {
                                let nextIds: string[]
                                if (opt.esNormal) {
                                  nextIds = [opt.id]
                                } else {
                                  const withoutNormal = st.selectedIds.filter(
                                    (id) => !organo.opciones.find((o) => o.id === id)?.esNormal,
                                  )
                                  if (withoutNormal.includes(opt.id)) {
                                    nextIds = withoutNormal.filter((id) => id !== opt.id)
                                    if (nextIds.length === 0) {
                                      const normalDef = organo.opciones.find((o) => o.esNormal)
                                      if (normalDef) nextIds = [normalDef.id]
                                    }
                                  } else {
                                    nextIds = [...withoutNormal, opt.id]
                                  }
                                }
                                const nextState = {
                                  ...adjetivosState,
                                  [organo.id]: { ...st, selectedIds: nextIds },
                                }
                                setAdjetivosState(nextState)
                                setExploracion(
                                  buildExploracionNarrativaDesdeAdjetivos(nextState, antecedentes),
                                )
                              }}
                              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                isSelected
                                  ? opt.esNormal
                                    ? 'bg-teal-50 border-teal-500 text-teal-800 font-semibold'
                                    : 'bg-amber-100 border-amber-500 text-amber-900 font-semibold shadow-xs'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {isSelected && <span>✓ </span>}
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Campo opcional de observación específica */}
                      <input
                        type="text"
                        placeholder="Anotar detalle u observación específica..."
                        value={st.notaLibre}
                        disabled={formReadonly}
                        onChange={(e) => {
                          const nextState = {
                            ...adjetivosState,
                            [organo.id]: { ...st, notaLibre: e.target.value },
                          }
                          setAdjetivosState(nextState)
                          setExploracion(
                            buildExploracionNarrativaDesdeAdjetivos(nextState, antecedentes),
                          )
                        }}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Texto narrativo de Exploración física (se imprimirá en el PDF):
              </label>
              <span className="text-[10px] text-slate-400">
                Se actualiza automáticamente al tocar los adjetivos. Puedes editarlo libremente.
              </span>
            </div>
            <ClinicalTextarea
              className={`${inputClass} min-h-[190px] font-sans`}
              value={exploracion}
              onChange={(v) => {
                setMissingFieldsBanner('')
                setExploracion(v)
              }}
              placeholder="El formato narrativo se genera automáticamente a partir de los adjetivos seleccionados arriba..."
              disabled={formReadonly}
            />
          </div>
        </section>
      )}

      {activeTab === 'dictamen' && (
        <section className="space-y-4 bg-white border border-slate-200 rounded-xl p-4">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  Integración diagnóstica (VI)
                </label>
                <p className="text-[11px] text-slate-500">
                  Diagnósticos clínicos encontrados. Clic en las píldoras para agregar rápidamente.
                </p>
              </div>
            </div>

            {/* Píldoras de diagnósticos frecuentes */}
            {!formReadonly && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {[
                  'Clínicamente sano al momento de la valoración',
                  'Sobrepeso (IMC ≥ 25)',
                  'Obesidad grado I',
                  'Disminución de agudeza visual lejana (requiere lentes)',
                  'Ametropía corregida con lentes',
                  'Caries dental (valoración odontológica)',
                  'Cifras tensionales elevadas',
                ].map((diag) => (
                  <button
                    key={diag}
                    type="button"
                    onClick={() => {
                      setIntegracion((prev) => {
                        const trimmed = prev.trim()
                        if (!trimmed || trimmed.toLowerCase().includes('clínicamente sano')) {
                          return diag.endsWith('.') ? diag : `${diag}.`
                        }
                        if (trimmed.includes(diag)) return trimmed
                        return `${trimmed} ${diag.endsWith('.') ? diag : `${diag}.`}`
                      })
                    }}
                    className="text-[10px] font-semibold bg-slate-100 hover:bg-teal-50 hover:text-teal-800 border border-slate-200 hover:border-teal-300 rounded-full px-2.5 py-1 text-slate-700 transition-colors cursor-pointer"
                  >
                    + {diag}
                  </button>
                ))}
              </div>
            )}

            <ClinicalTextarea
              className={`${inputClass} min-h-[90px]`}
              value={integracion}
              onChange={(v) => {
                setMissingFieldsBanner('')
                setIntegracion(v)
              }}
              placeholder="Ej. Clínicamente sano al momento de la valoración."
              disabled={formReadonly}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">
              Dictamen laboral
            </label>
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
            {dictamen === 'OTRO' && (
              <div className="mt-2">
                <input
                  type="text"
                  className={inputClass}
                  value={dictamenTexto}
                  onChange={(e) => {
                    setMissingFieldsBanner('')
                    setDictamenTexto(e.target.value)
                  }}
                  placeholder="Especifica el dictamen para el PDF..."
                  disabled={formReadonly}
                />
              </div>
            )}
          </div>
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
          {formReadonly
            ? readonlyBanner
            : 'Puedes corregir cualquier campo; los cambios se guardan automáticamente.'}
        </div>
      )}
      {(Boolean(cerradaAt) || !formReadonly) && (
        <div className="flex flex-wrap gap-2 items-center sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 py-3 -mx-1 px-1 z-10">
          <CertificadoPdfLink
            href={pdfHref}
            isDraft={isDraft}
            prominent
            onBeforeOpen={handleDraftPreviewClick}
          />
          {Boolean(cerradaAt) && (
            <>
              <button
                type="button"
                onClick={() => setSendModal({ isOpen: true, channel: 'email' })}
                className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                <Mail className="h-4 w-4" strokeWidth={2.25} />
                <span>Enviar por correo</span>
              </button>
              <button
                type="button"
                onClick={() => setSendModal({ isOpen: true, channel: 'whatsapp' })}
                className="inline-flex items-center gap-1.5 bg-[#128C7E] hover:bg-[#0d6e63] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" strokeWidth={2.25} />
                <span>Enviar por WhatsApp</span>
              </button>
            </>
          )}
          {!formReadonly && !cerradaAt && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => runSave(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
            >
              Cerrar certificado
            </button>
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
      <CierreSendModal
        isOpen={sendModal.isOpen}
        onClose={() => setSendModal((prev) => ({ ...prev, isOpen: false }))}
        eventId={eventId}
        channel={sendModal.channel}
        documentTitle="Certificado Médico Laboral"
        sendAction={async (input) => {
          return sendCertificadoMedico({
            ...input,
            eventTestId,
          })
        }}
        onSent={(msg, isError) => {
          if (isError) {
            setSaveError({
              kind: 'technical',
              title: 'No se pudo enviar el certificado',
              userMessage: msg,
            })
          } else {
            setSaveMsg(msg)
          }
        }}
      />
    </div>
  )
}
