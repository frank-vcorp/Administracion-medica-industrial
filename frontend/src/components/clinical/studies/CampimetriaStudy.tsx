/**
 * @fileoverview Captura de Campimetría (confrontación + Ishihara + exploración).
 * Sin dropzone de PDF. El prediagnóstico IA vive en el mismo recuadro que
 * audio/espiro (StudyAIPrediagnosisPanel).
 *
 * @id IMPL-FEATURE-20260914-01
 * @spec SPEC-FEATURE-20260914-01-CAMPIMETRIA-CUESTIONARIO.md
 */
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveCampimetriaQuestionnaire } from '@/actions/campimetria-questionnaire.actions'
import { updateEventTestStatus } from '@/actions/event-test.actions'
import {
  CONFRONTACION_VALUES,
  EXPLORACION_OJO_FIELDS,
  EXPLORACION_OJO_LABEL,
  EXPLORACION_OJO_PLANTILLA,
  ISHIHARA_PLATES,
  ISHIHARA_RESULTADO_VALUES,
  TIEMPO_LENTES_VALUES,
  applyIshiharaDerivation,
  defaultCampimetriaDraftPayload,
  defaultExploracionCampo,
  deriveIshiharaResultado,
  emptyIshiharaPlates,
  expectedIshiharaAnswers,
  type CampimetriaQuestionnairePayload,
  type ExploracionEstadoCampimetria,
  type ExploracionOjoCampimetria,
  type ExploracionOjoField,
  type IshiharaPlateId,
} from '@/schemas/clinical/campimetria-questionnaire.schema'
import {
  inheritAcuityFromExam,
  inheritAntecedentesFromPapeleta,
} from '@/lib/clinical/campimetria-inherited'

const TIEMPO_LENTES_LABEL: Record<(typeof TIEMPO_LENTES_VALUES)[number], string> = {
  MENOS_1_ANIO: 'Menos de 1 año',
  '1_A_3_ANIOS': '1 a 3 años',
  '3_A_5_ANIOS': '3 a 5 años',
  MAS_5_ANIOS: 'Más de 5 años',
}

type WorkerBanner = {
  name: string
  company: string
  ageYears?: number | null
  eventDate?: string
}

export default function CampimetriaStudy({
  eventId,
  eventTestId,
  initialContext,
  examData,
  longitudinalData,
  workerInfo,
  readonly = false,
  onStatusChange,
}: {
  eventId: string
  eventTestId: string
  initialContext?: CampimetriaQuestionnairePayload | null
  examData?: {
    eyeAcuityData?: Record<string, unknown> | null
    physicalExamData?: Record<string, unknown> | null
  } | null
  longitudinalData?: Record<string, unknown> | null
  workerInfo: WorkerBanner
  readonly?: boolean
  onStatusChange?: (status: string) => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<CampimetriaQuestionnairePayload>(
    () => initialContext ?? defaultCampimetriaDraftPayload(),
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [aiWarning, setAiWarning] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const acuity = useMemo(
    () => inheritAcuityFromExam(examData?.eyeAcuityData),
    [examData?.eyeAcuityData],
  )
  const inheritedAnt = useMemo(
    () =>
      inheritAntecedentesFromPapeleta({
        physicalExamData: examData?.physicalExamData,
        longitudinalData,
      }),
    [examData?.physicalExamData, longitudinalData],
  )
  const setAntecedente = <K extends keyof CampimetriaQuestionnairePayload['antecedentes']>(
    key: K,
    value: CampimetriaQuestionnairePayload['antecedentes'][K],
  ) => {
    setForm(prev => ({
      ...prev,
      antecedentes: { ...prev.antecedentes, [key]: value },
    }))
  }

  const setExploracionCampo = (
    ojo: 'ojo_izquierdo' | 'ojo_derecho',
    field: ExploracionOjoField,
    estado: ExploracionEstadoCampimetria,
  ) => {
    setForm(prev => ({
      ...prev,
      exploracion: {
        ...prev.exploracion,
        [ojo]: {
          ...prev.exploracion[ojo],
          [field]:
            estado === 'ALTERADO'
              ? { estado, observacion: prev.exploracion[ojo][field].observacion ?? '' }
              : { estado },
        },
      },
    }))
  }

  const setExploracionObs = (
    ojo: 'ojo_izquierdo' | 'ojo_derecho',
    field: ExploracionOjoField,
    observacion: string,
  ) => {
    setForm(prev => ({
      ...prev,
      exploracion: {
        ...prev.exploracion,
        [ojo]: {
          ...prev.exploracion[ojo],
          [field]: { ...prev.exploracion[ojo][field], observacion },
        },
      },
    }))
  }

  const normalizarExploracion = () => {
    const ojo: ExploracionOjoCampimetria = {
      movimientos: defaultExploracionCampo(),
      reflejos: defaultExploracionCampo(),
      pupilas: defaultExploracionCampo(),
      conjuntiva: defaultExploracionCampo(),
      esclera: defaultExploracionCampo(),
      fondo_de_ojo: defaultExploracionCampo(),
      anexos: defaultExploracionCampo(),
    }
    setForm(prev => ({
      ...prev,
      exploracion: { ojo_izquierdo: ojo, ojo_derecho: { ...ojo } },
    }))
  }

  const fillIshiharaNormalAnswers = () => {
    const plates = expectedIshiharaAnswers()
    setForm(prev => ({
      ...prev,
      ishihara: applyIshiharaDerivation({
        ...prev.ishihara,
        resultado: 'ALTERADO',
        ojo_derecho: { ...plates },
        ojo_izquierdo: { ...plates },
      }),
    }))
  }

  const setIshiharaNoAplica = (noAplica: boolean) => {
    setForm(prev => ({
      ...prev,
      ishihara: noAplica
        ? {
            resultado: 'NO APLICA',
            ojo_derecho: emptyIshiharaPlates(),
            ojo_izquierdo: emptyIshiharaPlates(),
          }
        : {
            resultado: 'ALTERADO',
            ojo_derecho: emptyIshiharaPlates(),
            ojo_izquierdo: emptyIshiharaPlates(),
          },
    }))
  }

  const setPlate = (
    ojo: 'ojo_derecho' | 'ojo_izquierdo',
    plate: IshiharaPlateId,
    value: string,
  ) => {
    setForm(prev => {
      const nextIshihara = {
        ...prev.ishihara,
        resultado:
          prev.ishihara.resultado === 'NO APLICA' ? 'ALTERADO' : prev.ishihara.resultado,
        [ojo]: { ...prev.ishihara[ojo], [plate]: value },
      }
      return {
        ...prev,
        ishihara: applyIshiharaDerivation(nextIshihara),
      }
    })
  }

  const ishiharaDerived = deriveIshiharaResultado(form.ishihara)

  const save = async (complete: boolean) => {
    setSaving(true)
    setMessage('')
    setAiWarning('')
    setFieldErrors({})
    const payload: CampimetriaQuestionnairePayload = {
      ...form,
      ishihara: applyIshiharaDerivation(form.ishihara),
      capturedAt: new Date().toISOString(),
    }
    const res = await saveCampimetriaQuestionnaire(eventTestId, payload, eventId, {
      triggerPrediagnosis: complete,
    })
    if (!res.success) {
      setFieldErrors(res.fieldErrors ?? {})
      setMessage(res.error)
      setSaving(false)
      return
    }
    setForm(res.payload)
    const status = complete ? 'COMPLETED' : 'RESULT_REGISTERED'
    await updateEventTestStatus(
      eventTestId,
      status as Parameters<typeof updateEventTestStatus>[1],
      eventId,
    )
    onStatusChange?.(status)
    setMessage(
      complete
        ? res.aiWarning
          ? 'Campimetría completada (revisa el prediagnóstico IA a la derecha).'
          : 'Campimetría completada. Revisa y valida el prediagnóstico IA a la derecha.'
        : 'Borrador guardado.',
    )
    if (res.aiWarning) {
      setAiWarning(
        `La captura se guardó, pero la IA no pudo generar prediagnóstico: ${res.aiWarning}`,
      )
    }
    if (complete) router.refresh()
    setSaving(false)
  }

  const err = (path: string) => fieldErrors[path]?.[0]

  return (
    <div className="space-y-4">
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-sm font-bold text-violet-900">Campimetría — captura manual</p>
          <p className="text-xs text-violet-700 mt-0.5">
            Sin PDF. Nombre, empresa, agudeza y antecedentes del expediente se heredan.
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Heredado de la papeleta
          </h4>
          <p className="text-sm text-slate-800">
            {workerInfo.name}
            {workerInfo.ageYears != null ? ` · ${workerInfo.ageYears} años` : ''}
            {workerInfo.company ? ` · ${workerInfo.company}` : ''}
            {workerInfo.eventDate ? ` · ${workerInfo.eventDate}` : ''}
          </p>
          <div className="text-xs text-slate-600 space-y-1">
            {inheritedAnt.map(a => (
              <p key={a.label}>
                <span className="font-semibold">{a.label}:</span> {a.estado}
                {a.detalle ? ` — ${a.detalle}` : ''}
              </p>
            ))}
            <p>
              <span className="font-semibold">Agudeza visual:</span>{' '}
              {acuity.pending
                ? 'Pendiente en agudeza visual / examen médico'
                : `${acuity.resumen ?? '—'} · OD ${acuity.vision_lejana_od ?? '—'} / OI ${acuity.vision_lejana_oi ?? '—'}`}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Antecedentes oftalmológicos
          </h4>
          <SiNoRow
            label="Uso de lentes"
            value={form.antecedentes.uso_lentes}
            disabled={readonly}
            onChange={v => {
              setAntecedente('uso_lentes', v)
              if (v === 'NO') setAntecedente('tiempo_lentes', undefined)
            }}
          />
          {form.antecedentes.uso_lentes === 'SI' && (
            <label className="block text-xs font-medium text-slate-600">
              Desde hace
              <select
                disabled={readonly}
                value={form.antecedentes.tiempo_lentes ?? ''}
                onChange={e =>
                  setAntecedente(
                    'tiempo_lentes',
                    e.target.value as (typeof TIEMPO_LENTES_VALUES)[number],
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm"
              >
                <option value="">Selecciona</option>
                {TIEMPO_LENTES_VALUES.map(v => (
                  <option key={v} value={v}>
                    {TIEMPO_LENTES_LABEL[v]}
                  </option>
                ))}
              </select>
              {err('antecedentes.tiempo_lentes') && (
                <span className="text-red-600">{err('antecedentes.tiempo_lentes')}</span>
              )}
            </label>
          )}
          <SiNoRow
            label="Cirugías oculares"
            value={form.antecedentes.cirugias_oculares}
            disabled={readonly}
            onChange={v => {
              setAntecedente('cirugias_oculares', v)
              if (v === 'NO') setAntecedente('causa_cirugia', undefined)
            }}
          />
          {form.antecedentes.cirugias_oculares === 'SI' && (
            <input
              disabled={readonly}
              value={form.antecedentes.causa_cirugia ?? ''}
              onChange={e => setAntecedente('causa_cirugia', e.target.value)}
              placeholder="Causa de la cirugía"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm"
            />
          )}
        </section>

        <section className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Exploración OD / OI
            </h4>
            {!readonly && (
              <button
                type="button"
                onClick={normalizarExploracion}
                className="text-xs font-bold text-teal-700 hover:underline"
              >
                Todo normal
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left py-1">Campo</th>
                  <th className="text-left py-1">Ojo izquierdo</th>
                  <th className="text-left py-1">Ojo derecho</th>
                </tr>
              </thead>
              <tbody>
                {EXPLORACION_OJO_FIELDS.map(field => (
                  <tr key={field} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-2 font-semibold text-slate-700">
                      {EXPLORACION_OJO_LABEL[field]}
                      <p className="font-normal text-[10px] text-slate-400 leading-snug">
                        {EXPLORACION_OJO_PLANTILLA[field]}
                      </p>
                    </td>
                    {(['ojo_izquierdo', 'ojo_derecho'] as const).map(ojo => {
                      const cell = form.exploracion[ojo][field]
                      return (
                        <td key={ojo} className="py-2 pr-2">
                          <EstadoChips
                            value={cell.estado}
                            disabled={readonly}
                            onChange={v => setExploracionCampo(ojo, field, v)}
                          />
                          {cell.estado === 'ALTERADO' && (
                            <input
                              disabled={readonly}
                              value={cell.observacion ?? ''}
                              onChange={e => setExploracionObs(ojo, field, e.target.value)}
                              placeholder="Hallazgo"
                              className="mt-1 w-full rounded-lg border border-amber-200 bg-amber-50 p-1.5"
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Campimetría de confrontación
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <figure className="space-y-1">
              <img
                src="/clinical/campimetria/confrontacion-oi.png"
                alt="Campimetría de confrontación — ojo izquierdo (referencia)"
                className="w-full rounded-lg border border-slate-200 bg-white"
              />
              <figcaption className="text-center text-[10px] font-bold uppercase text-slate-500">
                Ojo izquierdo
              </figcaption>
            </figure>
            <figure className="space-y-1">
              <img
                src="/clinical/campimetria/confrontacion-od.png"
                alt="Campimetría de confrontación — ojo derecho (referencia)"
                className="w-full rounded-lg border border-slate-200 bg-white"
              />
              <figcaption className="text-center text-[10px] font-bold uppercase text-slate-500">
                Ojo derecho
              </figcaption>
            </figure>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['ojo_izquierdo', 'ojo_derecho'] as const).map(ojo => (
              <label key={ojo} className="block text-xs font-medium text-slate-600">
                {ojo === 'ojo_izquierdo' ? 'Ojo izquierdo' : 'Ojo derecho'}
                <select
                  disabled={readonly}
                  value={form.confrontacion[ojo]}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      confrontacion: {
                        ...prev.confrontacion,
                        [ojo]: e.target.value as (typeof CONFRONTACION_VALUES)[number],
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm"
                >
                  {CONFRONTACION_VALUES.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Prueba de Ishihara
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  ishiharaDerived === 'NORMAL'
                    ? 'bg-emerald-100 text-emerald-800'
                    : ishiharaDerived === 'ALTERADO'
                      ? 'bg-amber-100 text-amber-800'
                      : ishiharaDerived === 'NO APLICA'
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-slate-100 text-slate-500'
                }`}
              >
                Resultado:{' '}
                {ishiharaDerived === 'INCOMPLETO' ? 'Pendiente' : ishiharaDerived}
              </span>
              {!readonly && form.ishihara.resultado !== 'NO APLICA' && (
                <button
                  type="button"
                  onClick={fillIshiharaNormalAnswers}
                  className="text-xs font-bold text-teal-700 hover:underline"
                >
                  Rellenar respuestas normales
                </button>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              disabled={readonly}
              checked={form.ishihara.resultado === 'NO APLICA'}
              onChange={e => setIshiharaNoAplica(e.target.checked)}
              className="rounded border-slate-300"
            />
            Prueba no aplica
          </label>
          <p className="text-xs text-slate-500">
            Captura el número que ve el paciente en cada placa. El resultado se calcula solo.
          </p>
          <img
            src="/clinical/campimetria/ishihara.png"
            alt="Placas de Ishihara de referencia (12, 45, 3, 5, 2, 26, 74)"
            className="w-full rounded-lg border border-slate-200 bg-white"
          />
          {form.ishihara.resultado !== 'NO APLICA' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left py-1 pr-2">Ojo</th>
                    {ISHIHARA_PLATES.map(plate => (
                      <th key={plate.id} className="text-center py-1">
                        {plate.displayExpected ?? plate.expected}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(['ojo_izquierdo', 'ojo_derecho'] as const).map(ojo => (
                    <tr key={ojo} className="border-t border-slate-100">
                      <td className="py-1 pr-2 font-semibold text-slate-700">
                        {ojo === 'ojo_izquierdo' ? 'OI' : 'OD'}
                      </td>
                      {ISHIHARA_PLATES.map(plate => (
                        <td key={plate.id} className="p-1">
                          <input
                            disabled={readonly}
                            value={form.ishihara[ojo][plate.id]}
                            onChange={e => setPlate(ojo, plate.id, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 p-1 text-center"
                            placeholder="—"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {!readonly && (
          <p className="text-xs text-slate-500 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            La aptitud y el hallazgo final los valida el médico en el panel de{' '}
            <strong>Prediagnóstico IA</strong> (columna derecha), igual que en
            espirometría y audiometría.
          </p>
        )}

        {message && (
          <p className={`text-sm font-medium ${message.includes('inválid') || message.includes('Error') || fieldErrors && Object.keys(fieldErrors).length ? 'text-red-600' : 'text-teal-700'}`}>
            {message}
          </p>
        )}
        {aiWarning && (
          <p className="text-sm font-medium text-amber-700">{aiWarning}</p>
        )}

        {!readonly && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(false)}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(true)}
              className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Completar campimetría'}
            </button>
          </div>
        )}
    </div>
  )
}

function SiNoRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: 'SI' | 'NO'
  disabled?: boolean
  onChange: (v: 'SI' | 'NO') => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex gap-1">
        {(['NO', 'SI'] as const).map(v => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              value === v ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

function EstadoChips({
  value,
  disabled,
  onChange,
}: {
  value: ExploracionEstadoCampimetria
  disabled?: boolean
  onChange: (v: ExploracionEstadoCampimetria) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {(['NORMAL', 'ALTERADO', 'NO_REALIZADO'] as const).map(v => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            value === v
              ? v === 'ALTERADO'
                ? 'bg-amber-500 text-white'
                : 'bg-teal-600 text-white'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {v === 'NO_REALIZADO' ? 'N/R' : v}
        </button>
      ))}
    </div>
  )
}
