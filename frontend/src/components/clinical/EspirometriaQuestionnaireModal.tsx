/**
 * @fileoverview Modal emergente del cuestionario de Espirometría
 *   (FEATURE-20260824-02).
 *
 * - Disparado desde el Event de Espirometría con `Completar cuestionario`
 *   (no hay contexto) o `Editar cuestionario` (ya hay contexto).
 * - Predominantemente seleccionable: Sí/No, No aplica, rangos y catálogos.
 * - Campos condicionales: cada campo `_otro` / rango / duración sólo aparece
 *   cuando la respuesta padre lo habilita.
 * - Cancelar no guarda; guardar crea/reemplaza el snapshot atómicamente.
 * - Errores visibles por campo (rechazo server-side se renderiza desde el
 *   resultado del server action).
 *
 * El componente NO emite diagnóstico ni aptitud y NO duplica PII del
 * encabezado de la papeleta (FEATURE-20260824-02 §Prohibido).
 *
 * @id IMPL-FEATURE-20260824-02
 * @backup context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EspirometriaQuestionnairePayloadSchema,
  ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  EXPOSICION_TIPO_VALUES,
  ANTECEDENTE_MEDICO_TIPO_VALUES,
  INHALADOR_TIPO_VALUES,
  CIRUGIA_TIPO_VALUES,
  TIEMPO_RANGO_VALUES,
  CIGARRILLOS_RANGO_VALUES,
  EXPLORACION_ESTADO_VALUES,
  type EspirometriaQuestionnairePayload,
  type AntecedentesEspirometria,
  type ExploracionFisicaEspirometria,
  type ExploracionEstado,
} from '@/schemas/clinical/espirometria-questionnaire.schema'
import { saveEspirometriaQuestionnaire } from '@/actions/espirometria-questionnaire.actions'

// ──────────────────────────────────────────────────────────────────────────
// Etiquetas legibles (FEATURE-20260824-02 §UI: predominantemente seleccionable)
// ──────────────────────────────────────────────────────────────────────────

const TIEMPO_RANGO_LABEL: Record<(typeof TIEMPO_RANGO_VALUES)[number], string> = {
  MENOS_1_ANIO: 'Menos de 1 año',
  '1_A_3_ANIOS': '1 a 3 años',
  '3_A_5_ANIOS': '3 a 5 años',
  MAS_5_ANIOS: 'Más de 5 años',
}

const CIGARRILLOS_RANGO_LABEL: Record<
  (typeof CIGARRILLOS_RANGO_VALUES)[number],
  string
> = {
  MENOS_5: 'Menos de 5',
  '5_A_10': '5 a 10',
  '11_A_20': '11 a 20',
  MAS_20: 'Más de 20',
}

const EXPLORACION_LABEL: Record<ExploracionEstado, string> = {
  NORMAL: 'Normal',
  ALTERADO: 'Alterado',
  NO_REALIZADO: 'No realizado',
}

const EXPOSICION_LABEL: Record<
  (typeof EXPOSICION_TIPO_VALUES)[number],
  string
> = {
  HUMOS: 'Humos',
  VAPORES: 'Vapores',
  GASES: 'Gases',
  SUSTANCIAS_QUIMICAS: 'Sustancias químicas',
  POLVOS: 'Polvos',
  SOLVENTES: 'Solventes',
}

const ANTECEDENTE_MEDICO_LABEL: Record<
  (typeof ANTECEDENTE_MEDICO_TIPO_VALUES)[number],
  string
> = {
  EPILEPSIA: 'Epilepsia',
  CARDIACA: 'Enfermedad cardiaca',
  PULMONAR: 'Enfermedad pulmonar',
}

const INHALADOR_LABEL: Record<
  (typeof INHALADOR_TIPO_VALUES)[number],
  string
> = {
  BRONCODILATADOR: 'Broncodilatador',
  CORTICOIDE_INHALADO: 'Corticoide inhalado',
  OTRO: 'Otro',
}

const CIRUGIA_LABEL: Record<(typeof CIRUGIA_TIPO_VALUES)[number], string> = {
  TORAXICA: 'Torácica',
  ABDOMINAL: 'Abdominal',
  OTORRINOLARINGOLOGIA: 'Otorrinolaringología',
  CARDIACA: 'Cardiaca',
  OTRO: 'Otro',
}

// ──────────────────────────────────────────────────────────────────────────
// Tipos auxiliares
// ──────────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string[]>

export type EspirometriaQuestionnaireModalProps = {
  eventTestId: string
  eventId: string
  initialContext: EspirometriaQuestionnairePayload | null
  onClose: () => void
  /**
   * Notifica a la página padre para refrescar el `clinicalContext` desde el
   * servidor (revalidatePath ya lo hace, pero este callback permite
   * actualizar el estado local del summary sin esperar al re-fetch).
   */
  onSaved: (payload: EspirometriaQuestionnairePayload) => void
}

// Estado vacío de antecedentes / exploración (todos los campos `undefined`).
function emptyAntecedentes(): AntecedentesEspirometria {
  return {
    espirometria_previa: undefined,
    espirometria_previa_rango: undefined,
    dificultad_respirar: undefined,
    exposicion_ocupacional: undefined,
    exposicion_tipos: undefined,
    exposicion_otro: undefined,
    exposicion_duracion_rango: undefined,
    fuma_o_fumo: undefined,
    cigarrillos_por_dia_rango: undefined,
    fuma_desde_rango: undefined,
    dejo_de_fumar_rango: undefined,
    antecedente_cardiopulmonar_o_epilepsia: undefined,
    antecedente_medico_tipos: undefined,
    antecedente_medico_otro: undefined,
    embarazo: undefined,
    usa_inhalador: undefined,
    inhalador_tipos: undefined,
    inhalador_otro: undefined,
    cirugia_reciente: undefined,
    cirugia_tipos: undefined,
    cirugia_otro: undefined,
    observaciones: undefined,
  }
}

function emptyExploracion(): ExploracionFisicaEspirometria {
  return {
    vias_respiratorias_superiores: { estado: 'NORMAL', observacion: undefined },
    torax: { estado: 'NORMAL', observacion: undefined },
    pulmones: { estado: 'NORMAL', observacion: undefined },
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────────

export default function EspirometriaQuestionnaireModal({
  eventTestId,
  eventId,
  initialContext,
  onClose,
  onSaved,
}: EspirometriaQuestionnaireModalProps) {
  const isEditing = !!initialContext

  const [antecedentes, setAntecedentes] =
    useState<AntecedentesEspirometria>(() => {
      if (!initialContext) return emptyAntecedentes()
      // Reconstruimos para evitar arrastrar referencias mutables.
      return { ...emptyAntecedentes(), ...initialContext.antecedentes }
    })
  const [exploracion, setExploracion] =
    useState<ExploracionFisicaEspirometria>(() => {
      if (!initialContext) return emptyExploracion()
      return {
        vias_respiratorias_superiores: {
          ...initialContext.exploracionFisica.vias_respiratorias_superiores,
        },
        torax: { ...initialContext.exploracionFisica.torax },
        pulmones: { ...initialContext.exploracionFisica.pulmones },
      }
    })
  const [observaciones, setObservaciones] = useState<string>(
    initialContext?.observaciones ?? '',
  )

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

  // ─── Helpers de actualización de antecedentes ──────────────────────────
  function setBoolAntecedente<K extends keyof AntecedentesEspirometria>(
    key: K,
    value: AntecedentesEspirometria[K],
  ) {
    setAntecedentes(prev => ({ ...prev, [key]: value }))
  }

  // Cuando cambia un Sí/No a "No" o undefined, limpiamos los sub-campos
  // condicionales para que la UI muestre sólo lo aplicable y el payload
  // guardado no contenga valores colgados.
  function setSiNoAntecedente(
    key:
      | 'espirometria_previa'
      | 'exposicion_ocupacional'
      | 'fuma_o_fumo'
      | 'antecedente_cardiopulmonar_o_epilepsia'
      | 'usa_inhalador'
      | 'cirugia_reciente',
    value: 'SI' | 'NO' | undefined,
  ) {
    setAntecedentes(prev => {
      const next: AntecedentesEspirometria = { ...prev, [key]: value }
      if (value !== 'SI') {
        if (key === 'espirometria_previa') {
          next.espirometria_previa_rango = undefined
        }
        if (key === 'exposicion_ocupacional') {
          next.exposicion_tipos = undefined
          next.exposicion_otro = undefined
          next.exposicion_duracion_rango = undefined
        }
        if (key === 'fuma_o_fumo') {
          next.cigarrillos_por_dia_rango = undefined
          next.fuma_desde_rango = undefined
          next.dejo_de_fumar_rango = undefined
        }
        if (key === 'antecedente_cardiopulmonar_o_epilepsia') {
          next.antecedente_medico_tipos = undefined
          next.antecedente_medico_otro = undefined
        }
        if (key === 'usa_inhalador') {
          next.inhalador_tipos = undefined
          next.inhalador_otro = undefined
        }
        if (key === 'cirugia_reciente') {
          next.cirugia_tipos = undefined
          next.cirugia_otro = undefined
        }
      }
      return next
    })
  }

  function toggleArrayValue<K extends keyof AntecedentesEspirometria>(
    key: K,
    value: string,
  ) {
    setAntecedentes(prev => {
      const arr = (prev[key] as unknown as string[] | undefined) ?? []
      const next = arr.includes(value)
        ? arr.filter(v => v !== value)
        : [...arr, value]
      // Narrowing: sólo permitimos arrays en claves de array.
      return { ...prev, [key]: next as unknown as AntecedentesEspirometria[K] }
    })
  }

  // ─── Submit ────────────────────────────────────────────────────────────
  const isComplete = useMemo(() => {
    // El botón "Guardar" se habilita siempre; la validación corre server-side.
    // El estado disabled solo evita dobles submits mientras `isSaving`.
    return true
  }, [])

  async function handleSubmit() {
    setIsSaving(true)
    setFieldErrors({})
    setSubmitError(null)

    const payload = {
      schemaVersion: ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
      capturedAt: new Date().toISOString(),
      antecedentes,
      exploracionFisica: exploracion,
      observaciones: observaciones.trim() ? observaciones.trim() : undefined,
    }

    // Validación cliente-side con el mismo schema (defensa en profundidad).
    const clientParsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
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

    const result = await saveEspirometriaQuestionnaire(
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

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="espirometria-questionnaire-title"
      onClick={e => {
        // Click fuera del cuadro cierra (excepto durante guardado).
        if (e.target === e.currentTarget && !isSaving) onClose()
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto outline-none"
        data-testid="espirometria-questionnaire-modal"
      >
        <header className="px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2
            id="espirometria-questionnaire-title"
            className="text-base font-bold text-slate-800"
          >
            {isEditing
              ? 'Editar cuestionario de Espirometría'
              : 'Cuestionario de Espirometría'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Antecedentes respiratorios y exploración física. Los datos
            personales y laborales del encabezado ya se obtienen de la
            papeleta — no se duplican aquí.
          </p>
        </header>

        <div className="px-6 py-4 space-y-6">
          {/* ── ANTECEDENTES ── */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              Antecedentes
            </h3>

            {/* Espirometría previa */}
            <Field label="¿Espirometría previa?" error={fieldErrors['antecedentes.espirometria_previa']?.[0]}>
              <YesNo
                value={antecedentes.espirometria_previa}
                onChange={v => setSiNoAntecedente('espirometria_previa', v)}
                idPrefix="espirometria-previa"
              />
            </Field>
            {antecedentes.espirometria_previa === 'SI' && (
              <SubField label="¿Hace cuánto?" error={fieldErrors['antecedentes.espirometria_previa_rango']?.[0]}>
                <SelectRangoTiempo
                  value={antecedentes.espirometria_previa_rango}
                  onChange={v => setBoolAntecedente('espirometria_previa_rango', v)}
                  idPrefix="espirometria-previa-rango"
                />
              </SubField>
            )}

            {/* Dificultad para respirar */}
            <Field label="¿Dificultad para respirar?" error={fieldErrors['antecedentes.dificultad_respirar']?.[0]}>
              <YesNo
                value={antecedentes.dificultad_respirar}
                onChange={v => setBoolAntecedente('dificultad_respirar', v)}
                idPrefix="dificultad-respirar"
              />
            </Field>

            {/* Exposición */}
            <Field
              label="¿Exposición a humos, vapores, gases, sustancias químicas, polvos o solventes?"
              error={fieldErrors['antecedentes.exposicion_ocupacional']?.[0]}
            >
              <YesNo
                value={antecedentes.exposicion_ocupacional}
                onChange={v => setSiNoAntecedente('exposicion_ocupacional', v)}
                idPrefix="exposicion"
              />
            </Field>
            {antecedentes.exposicion_ocupacional === 'SI' && (
              <SubField
                label="Tipos de exposición"
                error={fieldErrors['antecedentes.exposicion_tipos']?.[0]}
              >
                <CheckboxGroup
                  options={EXPOSICION_TIPO_VALUES.map(v => ({
                    value: v,
                    label: EXPOSICION_LABEL[v],
                  }))}
                  selected={antecedentes.exposicion_tipos ?? []}
                  onToggle={v => toggleArrayValue('exposicion_tipos', v)}
                  idPrefix="exposicion-tipo"
                />
                <div className="mt-2">
                  <label
                    htmlFor="exposicion-otro"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Otro (opcional)
                  </label>
                  <input
                    id="exposicion-otro"
                    type="text"
                    maxLength={500}
                    value={antecedentes.exposicion_otro ?? ''}
                    onChange={e =>
                      setBoolAntecedente('exposicion_otro', e.target.value || undefined)
                    }
                    className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
                  />
                </div>
                <SubField
                  label="Duración de la exposición"
                  error={fieldErrors['antecedentes.exposicion_duracion_rango']?.[0]}
                >
                  <SelectRangoTiempo
                    value={antecedentes.exposicion_duracion_rango}
                    onChange={v =>
                      setBoolAntecedente('exposicion_duracion_rango', v)
                    }
                    idPrefix="exposicion-duracion"
                  />
                </SubField>
              </SubField>
            )}

            {/* Tabaquismo */}
            <Field label="¿Fuma o fumó?" error={fieldErrors['antecedentes.fuma_o_fumo']?.[0]}>
              <YesNo
                value={antecedentes.fuma_o_fumo}
                onChange={v => setSiNoAntecedente('fuma_o_fumo', v)}
                idPrefix="fuma"
              />
            </Field>
            {antecedentes.fuma_o_fumo === 'SI' && (
              <>
                <SubField
                  label="Cigarrillos por día"
                  error={fieldErrors['antecedentes.cigarrillos_por_dia_rango']?.[0]}
                >
                  <SelectCigarrillos
                    value={antecedentes.cigarrillos_por_dia_rango}
                    onChange={v =>
                      setBoolAntecedente('cigarrillos_por_dia_rango', v)
                    }
                    idPrefix="cigarrillos"
                  />
                </SubField>
                <SubField
                  label="¿Desde cuándo?"
                  error={fieldErrors['antecedentes.fuma_desde_rango']?.[0]}
                >
                  <SelectRangoTiempo
                    value={antecedentes.fuma_desde_rango}
                    onChange={v => setBoolAntecedente('fuma_desde_rango', v)}
                    idPrefix="fuma-desde"
                  />
                </SubField>
                <SubField
                  label="Si dejó de fumar, ¿hace cuánto?"
                  error={fieldErrors['antecedentes.dejo_de_fumar_rango']?.[0]}
                >
                  <SelectRangoTiempo
                    value={antecedentes.dejo_de_fumar_rango}
                    onChange={v => setBoolAntecedente('dejo_de_fumar_rango', v)}
                    idPrefix="dejo-fumar"
                    required={false}
                  />
                </SubField>
              </>
            )}

            {/* Antecedente médico */}
            <Field
              label="¿Epilepsia o enfermedad cardiaca/pulmonar?"
              error={fieldErrors['antecedentes.antecedente_cardiopulmonar_o_epilepsia']?.[0]}
            >
              <YesNo
                value={antecedentes.antecedente_cardiopulmonar_o_epilepsia}
                onChange={v =>
                  setSiNoAntecedente(
                    'antecedente_cardiopulmonar_o_epilepsia',
                    v,
                  )
                }
                idPrefix="antecedente-medico"
              />
            </Field>
            {antecedentes.antecedente_cardiopulmonar_o_epilepsia === 'SI' && (
              <SubField
                label="Seleccione el antecedente"
                error={fieldErrors['antecedentes.antecedente_medico_tipos']?.[0]}
              >
                <CheckboxGroup
                  options={ANTECEDENTE_MEDICO_TIPO_VALUES.map(v => ({
                    value: v,
                    label: ANTECEDENTE_MEDICO_LABEL[v],
                  }))}
                  selected={antecedentes.antecedente_medico_tipos ?? []}
                  onToggle={v =>
                    toggleArrayValue('antecedente_medico_tipos', v)
                  }
                  idPrefix="antecedente-medico-tipo"
                />
              </SubField>
            )}

            {/* Embarazo */}
            <Field
              label="Embarazo"
              error={fieldErrors['antecedentes.embarazo']?.[0]}
            >
              <SelectEmbarazo
                value={antecedentes.embarazo}
                onChange={v => setBoolAntecedente('embarazo', v)}
                idPrefix="embarazo"
              />
            </Field>

            {/* Inhalador */}
            <Field
              label="¿Usa medicamento inhalador/bronco­dilatador?"
              error={fieldErrors['antecedentes.usa_inhalador']?.[0]}
            >
              <YesNo
                value={antecedentes.usa_inhalador}
                onChange={v => setSiNoAntecedente('usa_inhalador', v)}
                idPrefix="inhalador"
              />
            </Field>
            {antecedentes.usa_inhalador === 'SI' && (
              <SubField
                label="Tipo de inhalador"
                error={fieldErrors['antecedentes.inhalador_tipos']?.[0]}
              >
                <CheckboxGroup
                  options={INHALADOR_TIPO_VALUES.map(v => ({
                    value: v,
                    label: INHALADOR_LABEL[v],
                  }))}
                  selected={antecedentes.inhalador_tipos ?? []}
                  onToggle={v => toggleArrayValue('inhalador_tipos', v)}
                  idPrefix="inhalador-tipo"
                />
                {(antecedentes.inhalador_tipos ?? []).includes('OTRO') && (
                  <div className="mt-2">
                    <label
                      htmlFor="inhalador-otro"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Especifique (Otro)
                    </label>
                    <input
                      id="inhalador-otro"
                      type="text"
                      maxLength={500}
                      value={antecedentes.inhalador_otro ?? ''}
                      onChange={e =>
                        setBoolAntecedente(
                          'inhalador_otro',
                          e.target.value || undefined,
                        )
                      }
                      className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  </div>
                )}
              </SubField>
            )}

            {/* Cirugía reciente */}
            <Field
              label="¿Procedimiento quirúrgico en los últimos tres meses?"
              error={fieldErrors['antecedentes.cirugia_reciente']?.[0]}
            >
              <YesNo
                value={antecedentes.cirugia_reciente}
                onChange={v => setSiNoAntecedente('cirugia_reciente', v)}
                idPrefix="cirugia"
              />
            </Field>
            {antecedentes.cirugia_reciente === 'SI' && (
              <SubField
                label="Tipo de cirugía"
                error={fieldErrors['antecedentes.cirugia_tipos']?.[0]}
              >
                <CheckboxGroup
                  options={CIRUGIA_TIPO_VALUES.map(v => ({
                    value: v,
                    label: CIRUGIA_LABEL[v],
                  }))}
                  selected={antecedentes.cirugia_tipos ?? []}
                  onToggle={v => toggleArrayValue('cirugia_tipos', v)}
                  idPrefix="cirugia-tipo"
                />
                {(antecedentes.cirugia_tipos ?? []).includes('OTRO') && (
                  <div className="mt-2">
                    <label
                      htmlFor="cirugia-otro"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Especifique (Otro)
                    </label>
                    <input
                      id="cirugia-otro"
                      type="text"
                      maxLength={500}
                      value={antecedentes.cirugia_otro ?? ''}
                      onChange={e =>
                        setBoolAntecedente(
                          'cirugia_otro',
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
                  setBoolAntecedente('observaciones', e.target.value || undefined)
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
              label="Vías respiratorias superiores"
              fieldKey="vias_respiratorias_superiores"
              value={exploracion.vias_respiratorias_superiores}
              onChange={f =>
                setExploracion(prev => ({
                  ...prev,
                  vias_respiratorias_superiores: f,
                }))
              }
              error={fieldErrors['exploracionFisica.vias_respiratorias_superiores.estado']?.[0]}
              obsError={fieldErrors['exploracionFisica.vias_respiratorias_superiores.observacion']?.[0]}
            />
            <ExploracionField
              label="Tórax"
              fieldKey="torax"
              value={exploracion.torax}
              onChange={f => setExploracion(prev => ({ ...prev, torax: f }))}
              error={fieldErrors['exploracionFisica.torax.estado']?.[0]}
              obsError={fieldErrors['exploracionFisica.torax.observacion']?.[0]}
            />
            <ExploracionField
              label="Pulmones"
              fieldKey="pulmones"
              value={exploracion.pulmones}
              onChange={f => setExploracion(prev => ({ ...prev, pulmones: f }))}
              error={fieldErrors['exploracionFisica.pulmones.estado']?.[0]}
              obsError={fieldErrors['exploracionFisica.pulmones.observacion']?.[0]}
            />
          </section>

          {/* ── OBSERVACIONES GENERALES ── */}
          <section>
            <label
              htmlFor="observaciones-generales"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Observaciones generales (opcional)
            </label>
            <textarea
              id="observaciones-generales"
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
              data-testid="espirometria-questionnaire-error"
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
            data-testid="espirometria-questionnaire-cancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isComplete || isSaving}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
            data-testid="espirometria-questionnaire-save"
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
          data-testid={`field-error`}
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
          data-testid={`subfield-error`}
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
    <div className="flex flex-wrap gap-1.5" data-testid={`${idPrefix}-group`}>
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
  required,
}: {
  value: (typeof TIEMPO_RANGO_VALUES)[number] | undefined
  onChange: (
    v: (typeof TIEMPO_RANGO_VALUES)[number] | undefined,
  ) => void
  idPrefix: string
  required?: boolean
}) {
  return (
    <select
      id={idPrefix}
      value={value ?? ''}
      required={required ?? false}
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

function SelectCigarrillos({
  value,
  onChange,
  idPrefix,
}: {
  value: (typeof CIGARRILLOS_RANGO_VALUES)[number] | undefined
  onChange: (
    v: (typeof CIGARRILLOS_RANGO_VALUES)[number] | undefined,
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
            ? (e.target.value as (typeof CIGARRILLOS_RANGO_VALUES)[number])
            : undefined,
        )
      }
      className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
      data-testid={idPrefix}
    >
      <option value="">Seleccione…</option>
      {CIGARRILLOS_RANGO_VALUES.map(v => (
        <option key={v} value={v}>
          {CIGARRILLOS_RANGO_LABEL[v]}
        </option>
      ))}
    </select>
  )
}

function SelectEmbarazo({
  value,
  onChange,
  idPrefix,
}: {
  value: 'NO_APLICA' | 'NO' | 'SI' | undefined
  onChange: (v: 'NO_APLICA' | 'NO' | 'SI' | undefined) => void
  idPrefix: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={`${idPrefix}-group`}>
      {(
        [
          { v: 'NO_APLICA', label: 'No aplica' },
          { v: 'NO', label: 'No' },
          { v: 'SI', label: 'Sí' },
        ] as const
      ).map(opt => {
        const selected = value === opt.v
        return (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={
              'px-3 py-1 rounded-lg text-xs font-bold border transition-colors ' +
              (selected
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-slate-700 border-slate-300 hover:border-teal-400')
            }
            aria-pressed={selected}
            data-testid={`${idPrefix}-${opt.v.toLowerCase()}`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
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
  fieldKey: 'vias_respiratorias_superiores' | 'torax' | 'pulmones'
  value: { estado: ExploracionEstado; observacion?: string }
  onChange: (v: { estado: ExploracionEstado; observacion?: string }) => void
  error?: string
  obsError?: string
}) {
  return (
    <div className="mb-3" data-testid={`exploracion-${fieldKey}`}>
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
              data-testid={`exploracion-${fieldKey}-${opt.toLowerCase()}`}
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
          data-testid={`exploracion-${fieldKey}-error`}
        >
          {error}
        </p>
      )}
      {value.estado === 'ALTERADO' && (
        <div className="mt-2">
          <label
            htmlFor={`exploracion-${fieldKey}-observacion`}
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Observación
          </label>
          <input
            id={`exploracion-${fieldKey}-observacion`}
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
              data-testid={`exploracion-${fieldKey}-obs-error`}
            >
              {obsError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
