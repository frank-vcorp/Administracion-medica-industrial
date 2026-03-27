/**
 * @fileoverview Tabs interactivos de la plataforma de calibración IA por prueba.
 *   - Tab Extracción: snapshots, documento fuente, raw, extracted_data, missing_fields.
 *   - Tab Diagnóstico: prediagnóstico IA y revisión médica.
 * @id ARCH-20260327-15
 * @backup context/SPECs/SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md
 */
"use client"

import { useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos derivados de los modelos Prisma (sin importar el cliente)
// ─────────────────────────────────────────────────────────────────────────────

interface DoctorReview {
  id: string
  doctorStatus: string
  doctorDiagnosis: string | null
  doctorNotes: string | null
  aiAgreementScore: number | null
  aiUsefulnessScore: number | null
  differenceType: string | null
  errorSeverity: string
  errorCategory: string | null
  doctorFeedbackNote: string | null
  createdAt: Date
}

interface AIPrediagnosis {
  id: string
  version: number
  prediagnosisData: unknown
  clinicalState: string
  modelName: string
  promptVersion: string
  isSuperseded: boolean
  createdAt: Date
  doctorReviews: DoctorReview[]
}

interface ExtractionSnapshot {
  id: string
  version: number
  studyType: string
  sourceFileName: string | null
  sourceFileUrl: string | null
  structuredData: unknown
  clinicalState: string
  modelName: string
  promptVersion: string
  isSuperseded: boolean
  createdAt: Date
  aiPrediagnoses: AIPrediagnosis[]
}

interface EventTestEntry {
  id: string
  status: string
  fileUrl: string | null
  resultNotes: string | null
  createdAt: Date
  extractionSnapshots: ExtractionSnapshot[]
}

interface CalibrationTabsProps {
  eventTests: EventTestEntry[]
  apiUrl: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de visualización
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function BadgeStatus({ state }: { state: string }) {
  const map: Record<string, string> = {
    DRAFT_EXTRACTED: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    AI_PENDING_REVIEW: "bg-blue-100 text-blue-700",
    REVIEWED_ACCEPTED: "bg-green-100 text-green-700",
    REVIEWED_EDITED: "bg-violet-100 text-violet-700",
    REVIEWED_REJECTED: "bg-red-100 text-red-700",
  }
  const cls = map[state] ?? "bg-slate-100 text-slate-600"
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${cls}`}>
      {state}
    </span>
  )
}

function RawJsonBlock({ label, data }: { label: string; data: unknown }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <pre className="bg-slate-950 text-green-300 text-xs p-4 overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-panel: Tab Extracción — contenido de un snapshot seleccionado
// ─────────────────────────────────────────────────────────────────────────────

function ExtractionSnapshotDetail({
  snapshot,
  eventFileUrl,
  apiUrl,
}: {
  snapshot: ExtractionSnapshot
  eventFileUrl: string | null
  apiUrl: string
}) {
  const structured = snapshot.structuredData as Record<string, unknown> | null
  const extracted = structured?.extracted_data
  const missing = structured?.missing_fields as string[] | undefined
  const qualityNotes = structured?.quality_notes

  // Documento fuente: preferir sourceFileUrl del snapshot; fallback al fileUrl del EventTest
  const rawFileUrl = snapshot.sourceFileUrl ?? eventFileUrl
  const fullFileUrl = rawFileUrl
    ? rawFileUrl.startsWith("http")
      ? rawFileUrl
      : `${apiUrl}${rawFileUrl}`
    : null
  const fileName = snapshot.sourceFileName ?? "Documento fuente"

  return (
    <div className="space-y-4">
      {/* Encabezado del snapshot */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <BadgeStatus state={snapshot.clinicalState} />
        <span>v{snapshot.version}</span>
        <span>·</span>
        <span className="font-mono">{snapshot.studyType}</span>
        <span>·</span>
        <span>{snapshot.modelName} / {snapshot.promptVersion}</span>
        <span>·</span>
        <span>{formatDate(snapshot.createdAt)}</span>
        {snapshot.isSuperseded && (
          <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded text-xs font-semibold">superseded</span>
        )}
      </div>

      {/* Documento fuente */}
      {fullFileUrl ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Documento fuente</p>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400">📎</span>
            <span className="text-xs font-mono text-slate-700 truncate flex-1">{fileName}</span>
            <a
              href={fullFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-teal-700 hover:text-teal-900 whitespace-nowrap"
            >
              ↗ Abrir
            </a>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
          Sin documento fuente registrado en este snapshot.
        </div>
      )}

      {/* Raw structuredData */}
      <RawJsonBlock label="structuredData (raw completo)" data={structured} />

      {/* extracted_data */}
      {extracted !== undefined && extracted !== null ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Datos extraídos (extracted_data)</p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
            <pre className="text-xs text-slate-800 whitespace-pre-wrap break-all">
              {JSON.stringify(extracted, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
          Sin extracted_data en este snapshot.
        </div>
      )}

      {/* missing_fields */}
      {Array.isArray(missing) && missing.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Campos faltantes (missing_fields)</p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((field, i) => (
              <span key={i} className="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded text-xs font-mono">
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* quality_notes */}
      {qualityNotes !== undefined && qualityNotes !== null && (
        <RawJsonBlock label="quality_notes" data={qualityNotes} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-panel: Tab Diagnóstico — prediagnóstico y revisión médica
// ─────────────────────────────────────────────────────────────────────────────

function DiagnosisSnapshotDetail({ prediagnosis }: { prediagnosis: AIPrediagnosis }) {
  const data = prediagnosis.prediagnosisData as Record<string, unknown> | null
  const review = prediagnosis.doctorReviews[0] ?? null

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <BadgeStatus state={prediagnosis.clinicalState} />
        <span>v{prediagnosis.version}</span>
        <span>·</span>
        <span className="font-mono">{prediagnosis.modelName} / {prediagnosis.promptVersion}</span>
        <span>·</span>
        <span>{formatDate(prediagnosis.createdAt)}</span>
        {prediagnosis.isSuperseded && (
          <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded text-xs font-semibold">superseded</span>
        )}
      </div>

      {data ? (
        <div className="space-y-3">
          {/* Resumen IA */}
          {data.summary && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">Resumen IA</p>
              <p className="text-sm text-slate-800">{String(data.summary)}</p>
            </div>
          )}

          {/* Estado clínico + confianza */}
          <div className="flex flex-wrap gap-3">
            {data.clinical_state && (
              <div className="flex-1 min-w-[140px] p-3 bg-white border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Estado clínico IA</p>
                <p className="text-sm font-semibold text-slate-800">{String(data.clinical_state)}</p>
              </div>
            )}
            {data.confidence !== undefined && (
              <div className="flex-1 min-w-[120px] p-3 bg-white border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Confianza</p>
                <p className="text-sm font-semibold text-slate-800">{Number(data.confidence)}%</p>
              </div>
            )}
          </div>

          {/* Justificación */}
          {Array.isArray(data.justification) && data.justification.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Justificación</p>
              <ul className="space-y-1">
                {(data.justification as string[]).map((j, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-slate-400 shrink-0">•</span>
                    <span>{j}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Limitaciones */}
          {Array.isArray(data.limitations) && data.limitations.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Limitaciones</p>
              <ul className="space-y-1">
                {(data.limitations as string[]).map((l, i) => (
                  <li key={i} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">{l}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Red flags */}
          {Array.isArray(data.red_flags) && data.red_flags.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Red Flags</p>
              <ul className="space-y-1">
                {(data.red_flags as string[]).map((f, i) => (
                  <li key={i} className="text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1 font-medium">{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw completo */}
          <RawJsonBlock label="prediagnosisData (raw completo)" data={data} />
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
          Sin datos de prediagnóstico disponibles.
        </div>
      )}

      {/* Revisión médica */}
      <div className="border-t border-slate-200 pt-4 space-y-2">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Revisión médica</p>
        {review ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] p-3 bg-white border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Estado médico</p>
                <BadgeStatus state={review.doctorStatus} />
              </div>
              {review.differenceType && (
                <div className="flex-1 min-w-[160px] p-3 bg-white border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Tipo de diferencia</p>
                  <p className="text-xs font-mono text-slate-800">{review.differenceType}</p>
                </div>
              )}
              {review.errorSeverity && review.errorSeverity !== "none" && (
                <div className="flex-1 min-w-[120px] p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-600 mb-1">Severidad error</p>
                  <p className="text-xs font-mono font-semibold text-red-800">{review.errorSeverity}</p>
                </div>
              )}
            </div>
            {review.aiAgreementScore !== null && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500">Concordancia IA:</span>
                <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${review.aiAgreementScore}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700">{review.aiAgreementScore}/100</span>
              </div>
            )}
            {review.doctorDiagnosis && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs font-semibold text-green-700 mb-1">Diagnóstico médico</p>
                <p className="text-sm text-slate-800">{review.doctorDiagnosis}</p>
              </div>
            )}
            {review.doctorFeedbackNote && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <p className="text-xs font-semibold text-slate-600 mb-1">Nota de feedback</p>
                <p className="text-sm text-slate-700">{review.doctorFeedbackNote}</p>
              </div>
            )}
            <p className="text-xs text-slate-400 text-right">{formatDate(review.createdAt)}</p>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
            Sin revisión médica registrada para este prediagnóstico.
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal de tabs
// ─────────────────────────────────────────────────────────────────────────────

export default function CalibrationTabs({ eventTests, apiUrl }: CalibrationTabsProps) {
  const [activeTab, setActiveTab] = useState<"extraccion" | "diagnostico">("extraccion")

  // Aplanar todos los snapshots de extracción disponibles
  const allExtractionSnapshots: Array<{ snapshot: ExtractionSnapshot; eventTest: EventTestEntry }> =
    eventTests.flatMap((et) =>
      et.extractionSnapshots.map((snap) => ({ snapshot: snap, eventTest: et }))
    )

  const [selectedExtractionIdx, setSelectedExtractionIdx] = useState(0)

  const selectedEntry = allExtractionSnapshots[selectedExtractionIdx] ?? null
  const selectedSnapshot = selectedEntry?.snapshot ?? null
  const selectedEventTest = selectedEntry?.eventTest ?? null

  // Prediagnósticos del snapshot seleccionado
  const prediagnoses = selectedSnapshot?.aiPrediagnoses ?? []
  const [selectedPredxIdx, setSelectedPredxIdx] = useState(0)
  const selectedPredx = prediagnoses[selectedPredxIdx] ?? null

  const tabCls = (tab: "extraccion" | "diagnostico") =>
    `px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
      activeTab === tab
        ? "border-violet-600 text-violet-700 bg-white"
        : "border-transparent text-slate-500 hover:text-slate-700 bg-slate-50"
    }`

  return (
    <div className="space-y-0">
      {/* Tabs header */}
      <div className="flex border-b border-slate-200">
        <button className={tabCls("extraccion")} onClick={() => setActiveTab("extraccion")}>
          📋 Extracción
        </button>
        <button className={tabCls("diagnostico")} onClick={() => setActiveTab("diagnostico")}>
          🧠 Diagnóstico
        </button>
      </div>

      {/* Tab body */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
        {allExtractionSnapshots.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <p className="text-4xl">📭</p>
            <p className="text-sm font-medium">Sin snapshots de calibración registrados para esta prueba.</p>
            <p className="text-xs">Los snapshots se generan automáticamente al procesar estudios de esta prueba médica.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
            {/* Sidebar: listado de snapshots */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">
                Snapshots disponibles ({allExtractionSnapshots.length})
              </p>
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                {allExtractionSnapshots.map(({ snapshot, eventTest }, idx) => (
                  <button
                    key={snapshot.id}
                    onClick={() => {
                      setSelectedExtractionIdx(idx)
                      setSelectedPredxIdx(0)
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                      selectedExtractionIdx === idx
                        ? "border-violet-400 bg-violet-50 text-violet-900"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold font-mono">{snapshot.studyType}</span>
                      <span className="text-slate-400">v{snapshot.version}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <BadgeStatus state={snapshot.clinicalState} />
                      {snapshot.isSuperseded && (
                        <span className="text-orange-500 font-mono">↯</span>
                      )}
                    </div>
                    <p className="mt-1 text-slate-400 truncate">
                      {formatDate(snapshot.createdAt)}
                    </p>
                    {snapshot.aiPrediagnoses.length > 0 && (
                      <p className="mt-0.5 text-violet-500 text-xs">
                        {snapshot.aiPrediagnoses.length} prediagnóstico(s)
                      </p>
                    )}
                    {eventTest.fileUrl && (
                      <p className="mt-0.5 text-teal-600 text-xs">📎 doc. adjunto</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Contenido del tab seleccionado */}
            <div className="min-w-0">
              {activeTab === "extraccion" && selectedSnapshot && selectedEventTest && (
                <ExtractionSnapshotDetail
                  snapshot={selectedSnapshot}
                  eventFileUrl={selectedEventTest.fileUrl}
                  apiUrl={apiUrl}
                />
              )}

              {activeTab === "diagnostico" && selectedSnapshot && (
                <div className="space-y-4">
                  {prediagnoses.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 space-y-1">
                      <p className="text-3xl">🤖</p>
                      <p className="text-sm">Sin prediagnósticos IA para este snapshot de extracción.</p>
                    </div>
                  ) : (
                    <>
                      {/* Selector de prediagnóstico si hay varios */}
                      {prediagnoses.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          {prediagnoses.map((p, i) => (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPredxIdx(i)}
                              className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                                selectedPredxIdx === i
                                  ? "bg-violet-600 text-white border-violet-600"
                                  : "bg-white text-slate-600 border-slate-300 hover:border-violet-400"
                              }`}
                            >
                              Prediagnóstico v{p.version}
                              {p.isSuperseded ? " ↯" : ""}
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedPredx && (
                        <DiagnosisSnapshotDetail prediagnosis={selectedPredx} />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
