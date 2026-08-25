/**
 * @fileoverview Modal emergente del cuestionario auditivo de Audiometría
 *   (FEATURE-20260825-02).
 *
 * - Disparado desde el Event de Audiometría con `Completar cuestionario`
 *   (no hay contexto) o `Editar cuestionario` (ya hay contexto).
 * - Predominantemente seleccionable: Sí/No, No aplica, rangos, catálogos.
 * - Campos condicionales: cada campo `_otro` / rango / duración sólo aparece
 *   cuando la respuesta padre lo habilita.
 * - Cancelar no guarda; guardar crea/reemplaza el snapshot atómicamente.
 * - Errores visibles por campo (rechazo server-side se renderiza desde el
 *   resultado del server action).
 *
 * El componente NO emite diagnóstico ni aptitud y NO duplica PII del
 * encabezado de la papeleta.
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AudiometriaQuestionnairePayloadSchema,
  AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  TIEMPO_RANGO_VALUES,
  TIPO_EXPOSICION_RUIDO_VALUES,
  TIPO_TRAUMA_VALUES,
  INFECCION_OTICA_VALUES,
  MEDICAMENTO_OTOTOXICO_VALUES,
  EXPLORACION_ESTADO_VALUES,
  type AudiometriaQuestionnairePayload,
  type AntecedentesAudiometria,
  type ExploracionFisicaAudiometria,
  type ExploracionEstado,
} from '@/schemas/clinical/audiometria-questionnaire.schema'
import { saveAudiometriaQuestionnaire } from '@/actions/audiometria-questionnaire.actions'

// ──────────────────────────────────────────────────────────────────────────
// Etiquetas legibles (FEATURE-20260825-02 §UI: predominantemente seleccionable)
// ──────────────────────────────────────────────────────────────────────────

const TIEMPO_RANGO_LABEL: Record<(typeof TIEMPO_RANGO_VALUES)[number], string> = {
  MENOS_1_ANIO: 'Menos de 1 año',
  '1_A_3_ANIOS': '1 a 3 años',
  '3_A_5_ANIOS': '3 a 5 años',
  MAS_5_ANIOS: 'Más de 5 años',
}

const EXPLORACION_LABEL: Record<ExploracionEstado, string> = {
  NORMAL: 'Normal',
  ALTERADO: 'Alterado',
  NO_REALIZADO: 'No realizado',
}

const TIPO_EXPOSICION_LABEL: Record<
  (typeof TIPO_EXPOSICION_RUIDO_VALUES)[number],
  string
> = {
  INDUSTRIAL: 'Industrial',
  RECREATIVA: 'Recreativa',
  MILITAR: 'Militar',
  MUSICAL: 'Musical',
  CONSTRUCCION: 'Construcción',
  OTRO: 'Otro',
}

const TIPO_TRAUMA_LABEL: Record<(typeof TIPO_TRAUMA_VALUES)[number], string> = {
  EXPLOSION: 'Explosión',
  GOLPE: 'Golpe',
  ACCIDENTE: 'Accidente',
  OTRO: 'Otro',
}

const INFECCION_OTICA_LABEL: Record<
  (typeof INFECCION_OTICA_VALUES)[number],
  string
> = {
  OTITIS_MEDIA: 'Otitis media',
  OTITIS_EXTERNA: 'Otitis externa',
  SARAMPION: 'Sarampión',
  RUBEOLA: 'Rubéola',
  PAROTIDITIS: 'Parotiditis',
  MENINGITIS: 'Meningitis',
  OTRO: 'Otro',
}

const MEDICAMENTO_OTOTOXICO_LABEL: Record<
  (typeof MEDICAMENTO_OTOTOXICO_VALUES)[number],
  string
> = {
  AMINOGLUCOSIDOS: 'Aminoglucósidos',
  DIURETICOS: 'Diuréticos',
  QUIMIOTERAPIA: 'Quimioterapia',
  AAS_ALTAS_DOSIS: 'AAS a dosis altas',
  OTRO: 'Otro',
}

const LADO_LABEL: Record<
  'OD' | 'OI' | 'BILATERAL' | 'NO_APLICA',
  string
> = {
  OD: 'OD (oído derecho)',
  OI: 'OI (oído izquierdo)',
  BILATERAL: 'Bilateral',
  NO_APLICA: 'No aplica',
}

// ──────────────────────────────────────────────────────────────────────────
// Tipos auxiliares
// ──────────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string[]>

export type AudiometriaQuestionnaireModalProps = {
  eventTestId: string
  eventId: string
  initialContext: AudiometriaQuestionnairePayload | null
  onClose: () => void
  onSaved: (payload: AudiometriaQuestionnairePayload) => void
}

function emptyAntecedentes(): AntecedentesAudiometria {
  return {
    audiometria_previa: undefined,
    audiometria_previa_rango: undefined,
    dificultad_auditiva: undefined,
    dificultad_auditiva_lado: undefined,
    exposicion_ruido_laboral: undefined,
    exposicion_tipos: undefined,
    exposicion_otro: undefined,
    exposicion_duracion_rango: undefined,
    exposicion_ruido_recreativa: undefined,
    exposicion_recreativa_tipos: undefined,
    exposicion_recreativa_otro: undefined,
    exposicion_recreativa_duracion_rango: undefined,
    explosion_o_trauma: undefined,
    explosion_tipos: undefined,
    explosion_otro: undefined,
    infecciones_oticas: undefined,
    infecciones_tipos: undefined,
    infecciones_otro: undefined,
    tinnitus_o_mareos: undefined,
    tinnitus_lado: undefined,
    medicamentos_otoxicos: undefined,
    medicamentos_tipos: undefined,
    medicamentos_otro: undefined,
    observaciones: undefined,
  }
}

function emptyExploracion(): ExploracionFisicaAudiometria {
  return {
    faringe: { estado: 'NORMAL', observacion: undefined },
    cad: { estado: 'NORMAL', observacion: undefined },
    cai: { estado: 'NORMAL', observacion: undefined },
    mtd: { estado: 'NORMAL', observacion: undefined },
    mti: { estado: 'NORMAL', observacion: undefined },
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────────

export default function AudiometriaQuestionnaireModal({
  eventTestId,
  eventId,
  initialContext,
  onClose,
  onSaved,
}: AudiometriaQuestionnaireModalProps) {
  const isEditing = !!initialContext

  const [antecedentes, setAntecedentes] =
    useState<AntecedentesAudiometria>(() => {
      if (!initialContext) return emptyAntecedentes()
      return { ...emptyAntecedentes(), ...initialContext.antecedentes }
    })
  const [exploracion, setExploracion] =
    useState<ExploracionFisicaAudiometria>(() => {
      if (!initialContext) return emptyExploracion()
      return {
        faringe: { ...initialContext.exploracionFisica.faringe },
        cad: { ...initialContext.exploracionFisica.cad },
        cai: { ...initialContext.exploracionFisica.cai },
        mtd: { ...initialContext.exploracionFisica.mtd },
        mti: { ...initialContext.exploracionFisica.mti },
      }
    })
  const [observaciones, setObservaciones] = useState<string>(
    initialContext?.observaciones ?? '',
  )
  // DEC-20260825-08 / BR-20260825-09 — los campos `Patient ID del
  // formato`, `consentimiento`, `responsableCaptura` y `responsableMedico`
  // fueron RETIRADOS del cuestionario y del payload por rectificación. La
  // identidad del paciente/Event viene de la papeleta; el médico y el
  // usuario de sesión se derivan de la sesión y/o del documento fuente.

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Cerrar con ESC (accesibilidad por teclado).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSaving) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, isSaving])

  // Foco inicial sobre el contenedor del modal.
  const dialogRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  function setBoolAntecedente<K extends keyof AntecedentesAudiometria>(
    key: K,
    value: AntecedentesAudiometria[K],
  ) {
    setAntecedentes(prev => ({ ...prev, [key]: value }))
  }

  // Cuando cambia un Sí/No a "No" o undefined, limpiamos los sub-campos
  // condicionales para que la UI muestre sólo lo aplicable y el payload
  // guardado no contenga valores colgados.
  function setSiNoAntecedente(
    key:
      | 'audiometria_previa'
      | 'dificultad_auditiva'
      | 'exposicion_ruido_laboral'
      | 'exposicion_ruido_recreativa'
      | 'explosion_o_trauma'
      | 'infecciones_oticas'
      | 'tinnitus_o_mareos'
      | 'medicamentos_otoxicos',
    value: 'SI' | 'NO' | undefined,
  ) {
    setAntecedentes(prev => {
      const next: AntecedentesAudiometria = { ...prev, [key]: value }
      if (value !== 'SI') {
        if (key === 'audiometria_previa') {
          next.audiometria_previa_rango = undefined
        }
        if (key === 'dificultad_auditiva') {
          next.dificultad_auditiva_lado = undefined
        }
        if (key === 'exposicion_ruido_laboral') {
          next.exposicion_tipos = undefined
          next.exposicion_otro = undefined
          next.exposicion_duracion_rango = undefined
        }
        if (key === 'exposicion_ruido_recreativa') {
          next.exposicion_recreativa_tipos = undefined
          next.exposicion_recreativa_otro = undefined
          next.exposicion_recreativa_duracion_rango = undefined
        }
        if (key === 'explosion_o_trauma') {
          next.explosion_tipos = undefined
          next.explosion_otro = undefined
        }
        if (key === 'infecciones_oticas') {
          next.infecciones_tipos = undefined
          next.infecciones_otro = undefined
        }
        if (key === 'tinnitus_o_mareos') {
          next.tinnitus_lado = undefined
        }
        if (key === 'medicamentos_otoxicos') {
          next.medicamentos_tipos = undefined
          next.medicamentos_otro = undefined
        }
      }
      return next
    })
  }

  function toggleArrayValue<K extends keyof AntecedentesAudiometria>(
    key: K,
    value: string,
  ) {
    setAntecedentes(prev => {
      const arr = (prev[key] as unknown as string[] | undefined) ?? []
      const next = arr.includes(value)
        ? arr.filter(v => v !== value)
        : [...arr, value]
      return { ...prev, [key]: next as unknown as AntecedentesAudiometria[K] }
    })
  }

  async function handleSubmit() {
    setIsSaving(true)
    setFieldErrors({})
    setSubmitError(null)

    const payload = {
      schemaVersion: AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
      capturedAt: new Date().toISOString(),
      // DEC-20260825-08 / BR-20260825-09: el payload guarda SÓLO
      // antecedentes, exploración física y observaciones. Los campos
      // administrativos (Patient ID, consentimiento, responsables) están
      // RETIRADOS y NO se incluyen.
      antecedentes,
      exploracionFisica: exploracion,
      observaciones: observaciones.trim() ? observaciones.trim() : undefined,
    }

    // Validación cliente-side con el mismo schema (defensa en profundidad).
    const clientParsed = AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    if (!clientParsed.success) {
      const fe: FieldErrors = {}
      for (const issue of clientParsed.error.issues) {
        const k = issue.path.join('.') || '_root'
        if (!fe[k]) fe[k] = []
        fe[k].push(issue.message)
      }
      setFieldErrors(fe)
      setSubmitError(
        'Revise los campos marcados antes de guardar el cuestionario.',
      )
      setIsSaving(false)
      return
    }

    const result = await saveAudiometriaQuestionnaire(
      eventTestId,
      clientParsed.data,
      eventId,
    )
    if (!result.success) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors)
      setSubmitError(result.error)
      setIsSaving(false)
      return
    }
    onSaved(result.payload)
    setIsSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audiometria-questionnaire-title"
      onClick={e => {
        if (e.target === e.currentTarget && !isSaving) onClose()
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto outline-none"
        data-testid="audiometria-questionnaire-modal"
      >
        <header className="px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2
            id="audiometria-questionnaire-title"
            className="text-base font-bold text-slate-800"
          >
            {isEditing
              ? 'Editar cuestionario de Audiometría'
              : 'Cuestionario de Audiometría'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Antecedentes auditivos y exploración física. Los datos
            personales y laborales del encabezado ya se obtienen de la
            papeleta — no se duplican aquí.
          </p>
        </header>

        <div className="px-6 py-4 space-y-6">
          {/* DEC-20260825-08 / BR-20260825-09 — sección de metadatos del
              formato RETIRADA por rectificación. Ya no se piden al médico
              los campos administrativos: Patient ID del formato,
              consentimiento, responsable de captura, responsable médico.
              Esos datos los aporta la papeleta (paciente), la sesión
              (médico/usuario) o el documento fuente (audiómetro/técnico).
              El payload guarda SÓLO antecedentes, exploración física y
              observaciones clínicas. */}

          {/* ── ANTECEDENTES ── */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              Antecedentes auditivos
            </h3>

            {/* Audiometría previa */}
            <Field
              label="¿Audiometría previa?"
              error={fieldErrors['antecedentes.audiometria_previa']?.[0]}
            >
              <YesNo
                value={antecedentes.audiometria_previa}
                onChange={v => setSiNoAntecedente('audiometria_previa', v)}
                idPrefix="audiometria-previa"
              />
            </Field>
            {antecedentes.audiometria_previa === 'SI' && (
              <SubField
                label="¿Hace cuánto?"
                error={fieldErrors['antecedentes.audiometria_previa_rango']?.[0]}
              >
                <SelectRangoTiempo
                  value={antecedentes.audiometria_previa_rango}
                  onChange={v =>
                    setBoolAntecedente('audiometria_previa_rango', v)
                  }
                  idPrefix="audiometria-previa-rango"
                />
              </SubField>
            )}

            {/* Dificultad auditiva */}
            <Field
              label="¿Dificultad auditiva subjetiva?"
              error={fieldErrors['antecedentes.dificultad_auditiva']?.[0]}
            >
              <YesNo
                value={antecedentes.dificultad_auditiva}
                onChange={v => setSiNoAntecedente('dificultad_auditiva', v)}
                idPrefix="audiometria-dificultad"
              />
            </Field>
            {antecedentes.dificultad_auditiva === 'SI' && (
              <SubField
                label="Oído afectado"
                error={
                  fieldErrors['antecedentes.dificultad_auditiva_lado']?.[0]
                }
              >
                <SelectLado
                  value={antecedentes.dificultad_auditiva_lado}
                  onChange={v =>
                    setBoolAntecedente('dificultad_auditiva_lado', v)
                  }
                  idPrefix="audiometria-dificultad-lado"
                />
              </SubField>
            )}

            {/* Exposición laboral */}
            <Field
              label="¿Exposición a ruido laboral?"
              error={
                fieldErrors['antecedentes.exposicion_ruido_laboral']?.[0]
              }
            >
              <YesNo
                value={antecedentes.exposicion_ruido_laboral}
                onChange={v =>
                  setSiNoAntecedente('exposicion_ruido_laboral', v)
                }
                idPrefix="audiometria-expo-laboral"
              />
            </Field>
            {antecedentes.exposicion_ruido_laboral === 'SI' && (
              <SubField
                label="Tipo de exposición laboral"
                error={fieldErrors['antecedentes.exposicion_tipos']?.[0]}
              >
                <CheckboxGroup
                  options={TIPO_EXPOSICION_RUIDO_VALUES.map(v => ({
                    value: v,
                    label: TIPO_EXPOSICION_LABEL[v],
                  }))}
                  selected={antecedentes.exposicion_tipos ?? []}
                  onToggle={v => toggleArrayValue('exposicion_tipos', v)}
                  idPrefix="audiometria-expo-laboral-tipo"
                />
                {(antecedentes.exposicion_tipos ?? []).includes('OTRO') && (
                  <div className="mt-2">
                    <label
                      htmlFor="audiometria-expo-laboral-otro"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Especifique (Otro)
                    </label>
                    <input
                      id="audiometria-expo-laboral-otro"
                      type="text"
                      maxLength={500}
                      value={antecedentes.exposicion_otro ?? ''}
                      onChange={e =>
                        setBoolAntecedente(
                          'exposicion_otro',
                          e.target.value || undefined,
                        )
                      }
                      className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                )}
                <SubField
                  label="Duración de la exposición laboral"
                  error={
                    fieldErrors['antecedentes.exposicion_duracion_rango']?.[0]
                  }
                >
                  <SelectRangoTiempo
                    value={antecedentes.exposicion_duracion_rango}
                    onChange={v =>
                      setBoolAntecedente('exposicion_duracion_rango', v)
                    }
                    idPrefix="audiometria-expo-laboral-duracion"
                  />
                </SubField>
              </SubField>
            )}

            {/* Exposición recreativa */}
            <Field
              label="¿Exposición recreativa a ruido?"
              error={
                fieldErrors['antecedentes.exposicion_ruido_recreativa']?.[0]
              }
            >
              <YesNo
                value={antecedentes.exposicion_ruido_recreativa}
                onChange={v =>
                  setSiNoAntecedente('exposicion_ruido_recreativa', v)
                }
                idPrefix="audiometria-expo-recreativa"
              />
            </Field>
            {antecedentes.exposicion_ruido_recreativa === 'SI' && (
              <SubField
                label="Tipo de exposición recreativa"
                error={
                  fieldErrors['antecedentes.exposicion_recreativa_tipos']?.[0]
                }
              >
                <CheckboxGroup
                  options={TIPO_EXPOSICION_RUIDO_VALUES.map(v => ({
                    value: v,
                    label: TIPO_EXPOSICION_LABEL[v],
                  }))}
                  selected={antecedentes.exposicion_recreativa_tipos ?? []}
                  onToggle={v =>
                    toggleArrayValue('exposicion_recreativa_tipos', v)
                  }
                  idPrefix="audiometria-expo-recreativa-tipo"
                />
                {(antecedentes.exposicion_recreativa_tipos ?? []).includes(
                  'OTRO',
                ) && (
                  <div className="mt-2">
                    <label
                      htmlFor="audiometria-expo-recreativa-otro"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Especifique (Otro)
                    </label>
                    <input
                      id="audiometria-expo-recreativa-otro"
                      type="text"
                      maxLength={500}
                      value={antecedentes.exposicion_recreativa_otro ?? ''}
                      onChange={e =>
                        setBoolAntecedente(
                          'exposicion_recreativa_otro',
                          e.target.value || undefined,
                        )
                      }
                      className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                )}
                <SubField
                  label="Duración de la exposición recreativa"
                  error={
                    fieldErrors[
                      'antecedentes.exposicion_recreativa_duracion_rango'
                    ]?.[0]
                  }
                >
                  <SelectRangoTiempo
                    value={antecedentes.exposicion_recreativa_duracion_rango}
                    onChange={v =>
                      setBoolAntecedente(
                        'exposicion_recreativa_duracion_rango',
                        v,
                      )
                    }
                    idPrefix="audiometria-expo-recreativa-duracion"
                  />
                </SubField>
              </SubField>
            )}

            {/* Explosión / trauma */}
            <Field
              label="¿Explosión o trauma acústico?"
              error={fieldErrors['antecedentes.explosion_o_trauma']?.[0]}
            >
              <YesNo
                value={antecedentes.explosion_o_trauma}
                onChange={v => setSiNoAntecedente('explosion_o_trauma', v)}
                idPrefix="audiometria-explosion"
              />
            </Field>
            {antecedentes.explosion_o_trauma === 'SI' && (
              <SubField
                label="Tipo de evento"
                error={fieldErrors['antecedentes.explosion_tipos']?.[0]}
              >
                <CheckboxGroup
                  options={TIPO_TRAUMA_VALUES.map(v => ({
                    value: v,
                    label: TIPO_TRAUMA_LABEL[v],
                  }))}
                  selected={antecedentes.explosion_tipos ?? []}
                  onToggle={v => toggleArrayValue('explosion_tipos', v)}
                  idPrefix="audiometria-explosion-tipo"
                />
                {(antecedentes.explosion_tipos ?? []).includes('OTRO') && (
                  <div className="mt-2">
                    <label
                      htmlFor="audiometria-explosion-otro"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Especifique (Otro)
                    </label>
                    <input
                      id="audiometria-explosion-otro"
                      type="text"
                      maxLength={500}
                      value={antecedentes.explosion_otro ?? ''}
                      onChange={e =>
                        setBoolAntecedente(
                          'explosion_otro',
                          e.target.value || undefined,
                        )
                      }
                      className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                )}
              </SubField>
            )}

            {/* Infecciones óticas */}
            <Field
              label="¿Infecciones óticas o meningitis?"
              error={fieldErrors['antecedentes.infecciones_oticas']?.[0]}
            >
              <YesNo
                value={antecedentes.infecciones_oticas}
                onChange={v => setSiNoAntecedente('infecciones_oticas', v)}
                idPrefix="audiometria-infecciones"
              />
            </Field>
            {antecedentes.infecciones_oticas === 'SI' && (
              <SubField
                label="Tipo de infección"
                error={fieldErrors['antecedentes.infecciones_tipos']?.[0]}
              >
                <CheckboxGroup
                  options={INFECCION_OTICA_VALUES.map(v => ({
                    value: v,
                    label: INFECCION_OTICA_LABEL[v],
                  }))}
                  selected={antecedentes.infecciones_tipos ?? []}
                  onToggle={v => toggleArrayValue('infecciones_tipos', v)}
                  idPrefix="audiometria-infecciones-tipo"
                />
                {(antecedentes.infecciones_tipos ?? []).includes('OTRO') && (
                  <div className="mt-2">
                    <label
                      htmlFor="audiometria-infecciones-otro"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Especifique (Otro)
                    </label>
                    <input
                      id="audiometria-infecciones-otro"
                      type="text"
                      maxLength={500}
                      value={antecedentes.infecciones_otro ?? ''}
                      onChange={e =>
                        setBoolAntecedente(
                          'infecciones_otro',
                          e.target.value || undefined,
                        )
                      }
                      className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                )}
              </SubField>
            )}

            {/* Tinnitus / mareos */}
            <Field
              label="¿Tinnitus o mareos?"
              error={fieldErrors['antecedentes.tinnitus_o_mareos']?.[0]}
            >
              <YesNo
                value={antecedentes.tinnitus_o_mareos}
                onChange={v => setSiNoAntecedente('tinnitus_o_mareos', v)}
                idPrefix="audiometria-tinnitus"
              />
            </Field>
            {antecedentes.tinnitus_o_mareos === 'SI' && (
              <SubField
                label="Oído afectado"
                error={fieldErrors['antecedentes.tinnitus_lado']?.[0]}
              >
                <SelectLado
                  value={antecedentes.tinnitus_lado}
                  onChange={v => setBoolAntecedente('tinnitus_lado', v)}
                  idPrefix="audiometria-tinnitus-lado"
                />
              </SubField>
            )}

            {/* Medicamentos ototóxicos */}
            <Field
              label="¿Medicamentos ototóxicos?"
              error={fieldErrors['antecedentes.medicamentos_otoxicos']?.[0]}
            >
              <YesNo
                value={antecedentes.medicamentos_otoxicos}
                onChange={v => setSiNoAntecedente('medicamentos_otoxicos', v)}
                idPrefix="audiometria-medicamentos"
              />
            </Field>
            {antecedentes.medicamentos_otoxicos === 'SI' && (
              <SubField
                label="Tipo de medicamento"
                error={fieldErrors['antecedentes.medicamentos_tipos']?.[0]}
              >
                <CheckboxGroup
                  options={MEDICAMENTO_OTOTOXICO_VALUES.map(v => ({
                    value: v,
                    label: MEDICAMENTO_OTOTOXICO_LABEL[v],
                  }))}
                  selected={antecedentes.medicamentos_tipos ?? []}
                  onToggle={v => toggleArrayValue('medicamentos_tipos', v)}
                  idPrefix="audiometria-medicamentos-tipo"
                />
                {(antecedentes.medicamentos_tipos ?? []).includes('OTRO') && (
                  <div className="mt-2">
                    <label
                      htmlFor="audiometria-medicamentos-otro"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Especifique (Otro)
                    </label>
                    <input
                      id="audiometria-medicamentos-otro"
                      type="text"
                      maxLength={500}
                      value={antecedentes.medicamentos_otro ?? ''}
                      onChange={e =>
                        setBoolAntecedente(
                          'medicamentos_otro',
                          e.target.value || undefined,
                        )
                      }
                      className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                )}
              </SubField>
            )}

            {/* Observaciones antecedentes */}
            <Field label="Observaciones de antecedentes (opcional)">
              <textarea
                maxLength={500}
                rows={2}
                value={antecedentes.observaciones ?? ''}
                onChange={e =>
                  setBoolAntecedente(
                    'observaciones',
                    e.target.value || undefined,
                  )
                }
                className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
              />
            </Field>
          </section>

          {/* ── EXPLORACIÓN FÍSICA ── */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              Exploración física
            </h3>
            <ExploracionField
              label="Faringe"
              fieldKey="faringe"
              value={exploracion.faringe}
              onChange={f =>
                setExploracion(prev => ({ ...prev, faringe: f }))
              }
              error={fieldErrors['exploracionFisica.faringe.estado']?.[0]}
              obsError={
                fieldErrors['exploracionFisica.faringe.observacion']?.[0]
              }
            />
            <ExploracionField
              label="CAD (Conducto Auditivo Derecho)"
              fieldKey="cad"
              value={exploracion.cad}
              onChange={f => setExploracion(prev => ({ ...prev, cad: f }))}
              error={fieldErrors['exploracionFisica.cad.estado']?.[0]}
              obsError={
                fieldErrors['exploracionFisica.cad.observacion']?.[0]
              }
            />
            <ExploracionField
              label="CAI (Conducto Auditivo Izquierdo)"
              fieldKey="cai"
              value={exploracion.cai}
              onChange={f => setExploracion(prev => ({ ...prev, cai: f }))}
              error={fieldErrors['exploracionFisica.cai.estado']?.[0]}
              obsError={
                fieldErrors['exploracionFisica.cai.observacion']?.[0]
              }
            />
            <ExploracionField
              label="MTD (Membrana Timpánica Derecha)"
              fieldKey="mtd"
              value={exploracion.mtd}
              onChange={f => setExploracion(prev => ({ ...prev, mtd: f }))}
              error={fieldErrors['exploracionFisica.mtd.estado']?.[0]}
              obsError={
                fieldErrors['exploracionFisica.mtd.observacion']?.[0]
              }
            />
            <ExploracionField
              label="MTI (Membrana Timpánica Izquierda)"
              fieldKey="mti"
              value={exploracion.mti}
              onChange={f => setExploracion(prev => ({ ...prev, mti: f }))}
              error={fieldErrors['exploracionFisica.mti.estado']?.[0]}
              obsError={
                fieldErrors['exploracionFisica.mti.observacion']?.[0]
              }
            />
          </section>

          {/* ── OBSERVACIONES GENERALES ── */}
          <section>
            <label
              htmlFor="audiometria-observaciones-generales"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Observaciones generales (opcional)
            </label>
            <textarea
              id="audiometria-observaciones-generales"
              rows={3}
              maxLength={500}
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
            />
          </section>

          {submitError && (
            <div
              role="alert"
              className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              data-testid="audiometria-questionnaire-error"
            >
              {submitError}
            </div>
          )}
        </div>

        <footer className="px-6 py-3 border-t border-slate-200 sticky bottom-0 bg-white flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-3 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-medium disabled:opacity-50"
            data-testid="audiometria-questionnaire-cancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
            data-testid="audiometria-questionnaire-save"
          >
            {isSaving
              ? 'Guardando…'
              : isEditing
                ? 'Guardar cambios'
                : 'Guardar cuestionario'}
          </button>
        </footer>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-componentes de UI (todos client-local; sin estado compartido).
// ──────────────────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <p className="text-xs font-bold text-slate-700 mb-1">{label}</p>
      {children}
      {error && (
        <p
          role="alert"
          className="mt-1 text-xs text-red-600"
          data-testid="audiometria-field-error"
        >
          {error}
        </p>
      )}
    </div>
  )
}

function SubField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="ml-3 pl-3 border-l-2 border-slate-200 mb-3">
      <p className="text-xs font-medium text-slate-600 mb-1">{label}</p>
      {children}
      {error && (
        <p
          role="alert"
          className="mt-1 text-xs text-red-600"
          data-testid="audiometria-subfield-error"
        >
          {error}
        </p>
      )}
    </div>
  )
}

function YesNo({
  value,
  onChange,
  idPrefix,
}: {
  value: 'SI' | 'NO' | undefined
  onChange: (v: 'SI' | 'NO' | undefined) => void
  idPrefix: string
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      data-testid={`${idPrefix}-group`}
    >
      {(['SI', 'NO'] as const).map(opt => {
        const selected = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={
              'px-3 py-1 rounded-lg text-xs font-bold border transition-colors ' +
              (selected
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-slate-700 border-slate-300 hover:border-teal-400')
            }
            aria-pressed={selected}
            data-testid={`${idPrefix}-${opt.toLowerCase()}`}
          >
            {opt === 'SI' ? 'Sí' : 'No'}
          </button>
        )
      })}
    </div>
  )
}

function SelectRangoTiempo({
  value,
  onChange,
  idPrefix,
}: {
  value: (typeof TIEMPO_RANGO_VALUES)[number] | undefined
  onChange: (
    v: (typeof TIEMPO_RANGO_VALUES)[number] | undefined,
  ) => void
  idPrefix: string
}) {
  return (
    <select
      id={idPrefix}
      value={value ?? ''}
      onChange={e =>
        onChange(
          e.target.value
            ? (e.target.value as (typeof TIEMPO_RANGO_VALUES)[number])
            : undefined,
        )
      }
      className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
      data-testid={idPrefix}
    >
      <option value="">Seleccione…</option>
      {TIEMPO_RANGO_VALUES.map(v => (
        <option key={v} value={v}>
          {TIEMPO_RANGO_LABEL[v]}
        </option>
      ))}
    </select>
  )
}

function SelectLado({
  value,
  onChange,
  idPrefix,
}: {
  value: 'OD' | 'OI' | 'BILATERAL' | 'NO_APLICA' | undefined
  onChange: (
    v: 'OD' | 'OI' | 'BILATERAL' | 'NO_APLICA' | undefined,
  ) => void
  idPrefix: string
}) {
  return (
    <select
      id={idPrefix}
      value={value ?? ''}
      onChange={e =>
        onChange(
          e.target.value
            ? (e.target.value as 'OD' | 'OI' | 'BILATERAL' | 'NO_APLICA')
            : undefined,
        )
      }
      className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
      data-testid={idPrefix}
    >
      <option value="">Seleccione…</option>
      {(['OD', 'OI', 'BILATERAL', 'NO_APLICA'] as const).map(v => (
        <option key={v} value={v}>
          {LADO_LABEL[v]}
        </option>
      ))}
    </select>
  )
}

function CheckboxGroup({
  options,
  selected,
  onToggle,
  idPrefix,
}: {
  options: Array<{ value: string; label: string }>
  selected: string[]
  onToggle: (value: string) => void
  idPrefix: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const isSel = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={
              'px-3 py-1 rounded-lg text-xs font-medium border transition-colors ' +
              (isSel
                ? 'bg-teal-100 text-teal-800 border-teal-300'
                : 'bg-white text-slate-700 border-slate-300 hover:border-teal-400')
            }
            aria-pressed={isSel}
            data-testid={`${idPrefix}-${opt.value}`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function ExploracionField({
  label,
  fieldKey,
  value,
  onChange,
  error,
  obsError,
}: {
  label: string
  fieldKey: 'faringe' | 'cad' | 'cai' | 'mtd' | 'mti'
  value: { estado: ExploracionEstado; observacion?: string }
  onChange: (v: { estado: ExploracionEstado; observacion?: string }) => void
  error?: string
  obsError?: string
}) {
  return (
    <div className="mb-3" data-testid={`audiometria-exploracion-${fieldKey}`}>
      <p className="text-xs font-bold text-slate-700 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {EXPLORACION_ESTADO_VALUES.map(opt => {
          const selected = value.estado === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange({
                  estado: opt,
                  // Limpiar observación si ya no aplica.
                  observacion:
                    opt === 'ALTERADO' ? value.observacion : undefined,
                })
              }
              className={
                'px-3 py-1 rounded-lg text-xs font-bold border transition-colors ' +
                (selected
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-teal-400')
              }
              aria-pressed={selected}
              data-testid={`audiometria-exploracion-${fieldKey}-${opt.toLowerCase()}`}
            >
              {EXPLORACION_LABEL[opt]}
            </button>
          )
        })}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-1 text-xs text-red-600"
          data-testid={`audiometria-exploracion-${fieldKey}-error`}
        >
          {error}
        </p>
      )}
      {value.estado === 'ALTERADO' && (
        <div className="mt-2">
          <label
            htmlFor={`audiometria-exploracion-${fieldKey}-observacion`}
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Observación
          </label>
          <input
            id={`audiometria-exploracion-${fieldKey}-observacion`}
            type="text"
            maxLength={500}
            value={value.observacion ?? ''}
            onChange={e =>
              onChange({
                estado: value.estado,
                observacion: e.target.value || undefined,
              })
            }
            className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
          />
          {obsError && (
            <p
              role="alert"
              className="mt-1 text-xs text-red-600"
              data-testid={`audiometria-exploracion-${fieldKey}-obs-error`}
            >
              {obsError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}