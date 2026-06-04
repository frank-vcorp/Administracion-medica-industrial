/**
 * @fileoverview Editor MVP de schema declarativo para aiCalibration.presentation.
 * @id IMPL-20260604-01
 * @backup context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md
 */
'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { proposePresentationSchema } from '@/actions/ai-presentation.actions'
import { saveAICalibrationV2 } from '@/actions/medical-profiles'
import type {
  AICalibrationV2,
  PresentationColumn,
  PresentationSection,
  PresentationSectionKind,
  StudyPresentationSchema,
} from '@/types/calibration'

interface SnapshotInput {
  id: string
  studyType: string
  extractedData: Record<string, unknown> | null
}

interface PresentationSchemaPanelProps {
  testId: string
  aiCalibration: AICalibrationV2 | null
  selectedSnapshot: SnapshotInput | null
}

function createEmptySection(kind: PresentationSectionKind): PresentationSection {
  if (kind === 'table') {
    return { kind, title: 'Nueva tabla', source: '', columns: [] }
  }
  if (kind === 'note') {
    return { kind, title: 'Nueva nota', source: '' }
  }
  if (kind === 'badges') {
    return { kind, title: 'Nuevos badges', sourceKey: '', fields: [] }
  }
  if (kind === 'bilateralFrequency') {
    return { kind, title: 'Nueva tabla bilateral', rightKey: '', leftKey: '', preferredOrder: [] }
  }
  return { kind, title: 'Nueva sección', sourceKey: '', fields: [] }
}

function normalizeSchema(
  schema: StudyPresentationSchema | null | undefined,
  fallbackStudyType: string
): StudyPresentationSchema {
  return {
    studyType: schema?.studyType || fallbackStudyType,
    sections: Array.isArray(schema?.sections) ? schema.sections : [],
  }
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseNumberList(value: string): number[] {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => !Number.isNaN(item))
}

function formatColumns(columns: PresentationColumn[]): string {
  return columns.map((col) => `${col.key}|${col.label}`).join('\n')
}

function parseColumns(value: string): PresentationColumn[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, label] = line.split('|').map((item) => item.trim())
      return {
        key: key || '',
        label: label || key || '',
      }
    })
    .filter((column) => column.key)
}

export default function PresentationSchemaPanel({
  testId,
  aiCalibration,
  selectedSnapshot,
}: PresentationSchemaPanelProps) {
  const router = useRouter()
  const [isSuggesting, startSuggesting] = useTransition()
  const [isSaving, startSaving] = useTransition()
  const initialPresentation = aiCalibration?.presentation
  const [schema, setSchema] = useState<StudyPresentationSchema>(() =>
    normalizeSchema(initialPresentation?.schema, selectedSnapshot?.studyType || '')
  )
  const [enabled, setEnabled] = useState<boolean>(initialPresentation?.enabled ?? true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSuggestedAt, setLastSuggestedAt] = useState<string | undefined>(
    initialPresentation?.lastSuggestedAt
  )
  const [lastSuggestionModel, setLastSuggestionModel] = useState<string | undefined>(
    initialPresentation?.lastSuggestionModel
  )
  const [lastSuggestionSummary, setLastSuggestionSummary] = useState<string | undefined>(
    initialPresentation?.lastSuggestionSummary
  )

  useEffect(() => {
    const fallbackStudyType = selectedSnapshot?.studyType || aiCalibration?.canonicalStudyType || ''
    setSchema(normalizeSchema(aiCalibration?.presentation?.schema, fallbackStudyType))
    setEnabled(aiCalibration?.presentation?.enabled ?? true)
    setLastSuggestedAt(aiCalibration?.presentation?.lastSuggestedAt)
    setLastSuggestionModel(aiCalibration?.presentation?.lastSuggestionModel)
    setLastSuggestionSummary(aiCalibration?.presentation?.lastSuggestionSummary)
  }, [aiCalibration?.currentVersion, aiCalibration?.presentation, aiCalibration?.canonicalStudyType, selectedSnapshot?.studyType])

  const selectedStudyType =
    selectedSnapshot?.studyType || schema.studyType || aiCalibration?.canonicalStudyType || ''

  const extractedDataPreview = useMemo(
    () => JSON.stringify(selectedSnapshot?.extractedData ?? {}, null, 2),
    [selectedSnapshot?.extractedData]
  )

  function updateSection(index: number, next: PresentationSection) {
    setSchema((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) =>
        sectionIndex === index ? next : section
      ),
    }))
  }

  function moveSection(index: number, direction: -1 | 1) {
    setSchema((current) => {
      const nextSections = [...current.sections]
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= nextSections.length) return current
      ;[nextSections[index], nextSections[targetIndex]] = [nextSections[targetIndex], nextSections[index]]
      return { ...current, sections: nextSections }
    })
  }

  function removeSection(index: number) {
    setSchema((current) => ({
      ...current,
      sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index),
    }))
  }

  function addSection(kind: PresentationSectionKind) {
    setSchema((current) => ({
      ...current,
      studyType: current.studyType || selectedStudyType,
      sections: [...current.sections, createEmptySection(kind)],
    }))
  }

  function changeSectionKind(index: number, kind: PresentationSectionKind) {
    updateSection(index, createEmptySection(kind))
  }

  function sanitizeForSave(currentSchema: StudyPresentationSchema): StudyPresentationSchema {
    return {
      studyType: currentSchema.studyType.trim() || selectedStudyType,
      sections: currentSchema.sections.map((section) => {
        if (section.kind === 'table') {
          return {
            ...section,
            title: section.title.trim(),
            source: section.source.trim(),
            columns: section.columns.filter((column) => column.key.trim()),
          }
        }
        if (section.kind === 'note') {
          return {
            ...section,
            title: section.title.trim(),
            source: section.source.trim(),
          }
        }
        if (section.kind === 'bilateralFrequency') {
          return {
            ...section,
            title: section.title.trim(),
            rightKey: section.rightKey.trim(),
            leftKey: section.leftKey.trim(),
            preferredOrder: (section.preferredOrder ?? []).filter((item) => Number.isFinite(item)),
          }
        }
        return {
          ...section,
          title: section.title.trim(),
          sourceKey: section.sourceKey?.trim(),
          fields: section.fields.filter((field) => field.trim()),
        }
      }),
    }
  }

  function handleSuggest() {
    const extractedData = selectedSnapshot?.extractedData
    if (!extractedData || !selectedStudyType) {
      setError('Selecciona un snapshot con extracted_data antes de generar la propuesta.')
      return
    }

    setError(null)
    setFeedback(null)

    startSuggesting(async () => {
      const result = await proposePresentationSchema({
        studyType: selectedStudyType,
        extractedData,
        aiCalibration: aiCalibration
          ? {
              canonicalStudyType: aiCalibration.canonicalStudyType,
            }
          : null,
      })

      if (!result.success || !result.schema) {
        setError(result.error || 'No fue posible generar la propuesta.')
        return
      }

      setSchema(result.schema)
      setLastSuggestedAt(new Date().toISOString())
      setLastSuggestionModel(result.audit?.model_name)
      setLastSuggestionSummary(result.summary)
      setFeedback(result.summary || 'Propuesta cargada correctamente.')
    })
  }

  function handleSave() {
    const sanitizedSchema = sanitizeForSave({
      studyType: schema.studyType || selectedStudyType,
      sections: schema.sections,
    })

    if (!sanitizedSchema.studyType) {
      setError('El schema necesita un studyType antes de guardarse.')
      return
    }

    setError(null)
    setFeedback(null)

    startSaving(async () => {
      const result = await saveAICalibrationV2(testId, {
        fieldDefinitions: aiCalibration?.fieldDefinitions ?? [],
        source: lastSuggestionSummary ? 'ai-assisted-review' : 'manual-review',
        summary: `Actualización de presentación con ${sanitizedSchema.sections.length} sección(es).`,
        presentation: {
          enabled,
          schema: sanitizedSchema,
          lastSuggestedAt,
          lastSuggestionModel,
          lastSuggestionSummary,
        },
        legacyFields: {
          enabled: aiCalibration?.enabled,
          canonicalStudyType: aiCalibration?.canonicalStudyType,
          extraction: aiCalibration?.extraction,
          diagnosis: aiCalibration?.diagnosis,
        },
      })

      if (!result.success) {
        setError(result.error || 'No se pudo guardar la presentación.')
        return
      }

      setFeedback('Schema de presentación guardado y versionado correctamente.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Presentación persistida
            </p>
            <h3 className="text-sm font-bold text-slate-800">Schema visual editable por calibración</h3>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Habilitado
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Study type</label>
            <input
              value={schema.studyType || selectedStudyType}
              onChange={(event) => setSchema((current) => ({ ...current, studyType: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Snapshot activo</label>
            <div className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              {selectedSnapshot ? `${selectedSnapshot.studyType} · ${selectedSnapshot.id}` : 'Sin snapshot seleccionado'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSuggest}
            disabled={isSuggesting || !selectedSnapshot?.extractedData}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSuggesting ? 'Generando propuesta...' : 'Generar propuesta desde extracción'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar presentación'}
          </button>
        </div>

        {lastSuggestionSummary && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <p className="font-semibold">Última propuesta</p>
            <p>{lastSuggestionSummary}</p>
            {(lastSuggestedAt || lastSuggestionModel) && (
              <p className="mt-1 font-mono text-[11px] text-emerald-600">
                {[lastSuggestedAt, lastSuggestionModel].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}

        {feedback && <p className="text-xs text-emerald-700">{feedback}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['keyValue', 'table', 'note', 'badges', 'bilateralFrequency'] as PresentationSectionKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => addSection(kind)}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              + {kind}
            </button>
          ))}
        </div>

        {schema.sections.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aún no hay secciones. Genera una propuesta o agrega bloques manualmente.
          </p>
        ) : (
          <div className="space-y-4">
            {schema.sections.map((section, index) => (
              <div key={`${section.kind}-${index}`} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      #{index + 1}
                    </span>
                    <select
                      value={section.kind}
                      onChange={(event) =>
                        changeSectionKind(index, event.target.value as PresentationSectionKind)
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="keyValue">keyValue</option>
                      <option value="table">table</option>
                      <option value="note">note</option>
                      <option value="badges">badges</option>
                      <option value="bilateralFrequency">bilateralFrequency</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => moveSection(index, -1)} className="text-xs text-slate-500">
                      Subir
                    </button>
                    <button type="button" onClick={() => moveSection(index, 1)} className="text-xs text-slate-500">
                      Bajar
                    </button>
                    <button type="button" onClick={() => removeSection(index)} className="text-xs text-red-600">
                      Eliminar
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">Título</label>
                  <input
                    value={section.title}
                    onChange={(event) => updateSection(index, { ...section, title: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                {(section.kind === 'keyValue' || section.kind === 'badges') && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">sourceKey</label>
                      <input
                        value={section.sourceKey ?? ''}
                        onChange={(event) =>
                          updateSection(index, { ...section, sourceKey: event.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">fields (CSV)</label>
                      <input
                        value={section.fields.join(', ')}
                        onChange={(event) =>
                          updateSection(index, { ...section, fields: parseCommaList(event.target.value) })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </>
                )}

                {section.kind === 'note' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600">source</label>
                    <input
                      value={section.source}
                      onChange={(event) => updateSection(index, { ...section, source: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {section.kind === 'table' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">source</label>
                      <input
                        value={section.source}
                        onChange={(event) => updateSection(index, { ...section, source: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">columns (una por línea: key|label)</label>
                      <textarea
                        value={formatColumns(section.columns)}
                        onChange={(event) =>
                          updateSection(index, { ...section, columns: parseColumns(event.target.value) })
                        }
                        rows={5}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </>
                )}

                {section.kind === 'bilateralFrequency' && (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">rightKey</label>
                      <input
                        value={section.rightKey}
                        onChange={(event) =>
                          updateSection(index, { ...section, rightKey: event.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">leftKey</label>
                      <input
                        value={section.leftKey}
                        onChange={(event) =>
                          updateSection(index, { ...section, leftKey: event.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">preferredOrder (CSV)</label>
                      <input
                        value={(section.preferredOrder ?? []).join(', ')}
                        onChange={(event) =>
                          updateSection(index, {
                            ...section,
                            preferredOrder: parseNumberList(event.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
          extracted_data del snapshot seleccionado
        </p>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs text-green-300">
          {extractedDataPreview}
        </pre>
      </div>
    </div>
  )
}
