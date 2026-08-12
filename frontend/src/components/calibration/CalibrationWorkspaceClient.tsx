/**
 * @fileoverview CalibrationWorkspaceClient — layout desktop 2 columnas.
 *   Izquierda: tabs de calibración (Propuesta IA, Configuración, Historial, Snapshots, Pruebas).
 *   Derecha: CalibrationDocumentViewer sticky y dominante.
 *   Gestiona el snapshot seleccionado como estado compartido entre ambos paneles.
 * @id IMPL-20260327-19
 * @backup context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
 * @intervention IMPL-20260604-01
 * @backup context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md
 * @intervention IMPL-20260715-04
 * @backup context/SPECs/SPEC_ARCH-20260715-04-UPLOAD-PDFS-CALIBRACION.md
 */
"use client"

import { useState } from "react"
import type {
  CandidateField,
  AICalibrationV2,
  CalibrationTestResults as CalibrationTestResultsData,
  FieldDefinition,
} from "@/types/calibration"
import CandidateSchemaPanel from "@/components/calibration/CandidateSchemaPanel"
import CalibrationVersionHistory from "@/components/calibration/CalibrationVersionHistory"
import CalibrationAIAssistantRail from "@/components/calibration/CalibrationAIAssistantRail"
import CalibrationDocumentViewer, {
  type DocumentEntry,
} from "@/components/calibration/CalibrationDocumentViewer"
import AICalibrationEditor from "@/components/calibration/AICalibrationEditor"
import PresentationSchemaPanel from "@/components/calibration/PresentationSchemaPanel"
import CalibrationTestUpload from "@/components/calibration/CalibrationTestUpload"
import CalibrationTestResults from "@/components/calibration/CalibrationTestResults"

// ─────────────────────────────────────────────────────────────────────────────
// Tipos derivados de los datos Prisma (serializables — dates como string)
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractionSnapshotEntry {
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
  createdAt: Date | string
}

interface EventTestEntry {
  id: string
  status: string
  fileUrl: string | null
  resultNotes: string | null
  createdAt: Date | string
  extractionSnapshots: ExtractionSnapshotEntry[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Props del workspace
// ─────────────────────────────────────────────────────────────────────────────

interface CalibrationWorkspaceClientProps {
  testId: string
  aiCalibration: AICalibrationV2 | null
  initialRawCalibration: Record<string, unknown> | null
  eventTests: EventTestEntry[]
  candidateFields: CandidateField[]
  apiUrl: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de tab del panel izquierdo
// ─────────────────────────────────────────────────────────────────────────────

type LeftTab = "propuesta" | "presentacion" | "configuracion" | "historial" | "snapshots" | "pruebas"

const TAB_LABELS: Record<LeftTab, string> = {
  propuesta: "🤖 Propuesta IA",
  presentacion: "🧩 Presentación",
  configuracion: "⚙ Configuración",
  historial: "🕐 Historial",
  snapshots: "📋 Snapshots",
  // IMPL-20260715-04 — Upload de PDFs de prueba directo en calibración.
  pruebas: "📄 Pruebas",
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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

// ─────────────────────────────────────────────────────────────────────────────
// RawJsonBlock reutilizable
// ─────────────────────────────────────────────────────────────────────────────

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
// Tab: Snapshots (versión compacta del CalibrationTabs anterior)
// ─────────────────────────────────────────────────────────────────────────────

function SnapshotsTab({
  eventTests,
  apiUrl,
  selectedSnapshotId,
  onSelectSnapshot,
}: {
  eventTests: EventTestEntry[]
  apiUrl: string
  selectedSnapshotId: string | null
  onSelectSnapshot: (snapshotId: string, fileUrl: string | null) => void
}) {
  const allSnapshots = eventTests.flatMap((et) =>
    et.extractionSnapshots.map((snap) => ({ snap, et }))
  )

  if (allSnapshots.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 space-y-2">
        <p className="text-4xl">📭</p>
        <p className="text-sm font-medium">Sin snapshots de calibración.</p>
        <p className="text-xs">Se generan al procesar estudios de esta prueba médica.</p>
      </div>
    )
  }

  const selected = allSnapshots.find((s) => s.snap.id === selectedSnapshotId)
  const selectedSnap = selected?.snap ?? null
  const _selectedEt = selected?.et ?? null
  void _selectedEt

  const structured = selectedSnap?.structuredData as Record<string, unknown> | null
  // FIX-20260812-01: navegar la forma real del snapshot persistido
  const _extraction = structured?.extraction as Record<string, unknown> | undefined
  const extracted = _extraction?.structured_data ?? structured?.extracted_data
  const missing = (_extraction?.missing_fields as string[] | undefined) ?? structured?.missing_fields as string[] | undefined

  return (
    <div className="space-y-4">
      {/* Lista de snapshots */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Snapshots ({allSnapshots.length})
        </p>
        <div className="space-y-1.5">
          {allSnapshots.map(({ snap, et }) => {
            const rawUrl = snap.sourceFileUrl ?? et.fileUrl
            const fullUrl = rawUrl
              ? rawUrl.startsWith("http")
                ? rawUrl
                : `${apiUrl}${rawUrl}`
              : null
            return (
              <button
                key={snap.id}
                onClick={() => onSelectSnapshot(snap.id, fullUrl)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                  selectedSnapshotId === snap.id
                    ? "border-violet-400 bg-violet-50 text-violet-900"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-mono font-semibold">{snap.studyType}</span>
                  <span className="text-slate-400">v{snap.version}</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <BadgeStatus state={snap.clinicalState} />
                  {snap.isSuperseded && <span className="text-orange-500 font-mono">↯</span>}
                  {fullUrl && <span className="text-teal-600">📎</span>}
                </div>
                <p className="mt-1 text-slate-400">{formatDate(snap.createdAt)}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detalle del snapshot seleccionado */}
      {selectedSnap && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Snapshot seleccionado
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <BadgeStatus state={selectedSnap.clinicalState} />
            <span>v{selectedSnap.version}</span>
            <span>·</span>
            <span className="font-mono">{selectedSnap.studyType}</span>
            <span>·</span>
            <span>{selectedSnap.modelName} / {selectedSnap.promptVersion}</span>
          </div>
          {selectedSnap.sourceFileName && (
            <p className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">
              📄 {selectedSnap.sourceFileName}
            </p>
          )}
          {extracted !== undefined && extracted !== null ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Datos extraídos
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
                <pre className="text-xs text-slate-800 whitespace-pre-wrap break-all">
                  {JSON.stringify(extracted, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
          {Array.isArray(missing) && missing.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                Campos faltantes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missing.map((field, i) => (
                  <span
                    key={i}
                    className="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded text-xs font-mono"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}
          <RawJsonBlock label="structuredData (raw)" data={selectedSnap.structuredData} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function CalibrationWorkspaceClient({
  testId,
  aiCalibration,
  initialRawCalibration,
  eventTests,
  candidateFields,
  apiUrl,
}: CalibrationWorkspaceClientProps) {
  const [activeTab, setActiveTab] = useState<LeftTab>("propuesta")

  // Snapshot seleccionado (controla qué documento se muestra a la derecha)
  const allSnapshots = eventTests.flatMap((et) =>
    et.extractionSnapshots.map((snap) => ({ snap, et }))
  )

  const firstSnapshotUrl = (() => {
    for (const { snap, et } of allSnapshots) {
      const raw = snap.sourceFileUrl ?? et.fileUrl
      if (raw) return raw.startsWith("http") ? raw : `${apiUrl}${raw}`
    }
    return null
  })()

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    allSnapshots[0]?.snap.id ?? null
  )
  const [selectedDocumentUrl, setSelectedDocumentUrl] = useState<string | null>(firstSnapshotUrl)

  // IMPL-20260715-04 — Estado para resultados del último PDF de prueba subido.
  const [testResults, setTestResults] = useState<CalibrationTestResultsData | null>(null)

  const selectedSnapshotEntry =
    allSnapshots.find(({ snap }) => snap.id === selectedSnapshotId) ?? allSnapshots[0] ?? null
  // FIX-20260812-06: dos formas coexisten según la capa que armó el snapshot:
  //   (A) Server action `getCalibrationSnapshots` en @/actions/calibration pasa por
  //       `_flattenStructuredData()` y deja el shape legacy a raíz:
  //       { extracted_data: {...}, missing_fields: [...], _raw_extraction, ... }
  //   (B) Cuando el componente recibe `snap.structuredData` desde otra fuente
  //       sin flatten previo, llega crudo del backend con shape nuevo:
  //       { extraction: { structured_data: {...}, raw_payload: {...} }, prediagnosis: {...} }
  // Aceptamos ambas con fallback chain.
  const selectedExtractedData = (() => {
    const snap = selectedSnapshotEntry?.snap
    const sd = snap?.structuredData
    if (!sd || typeof sd !== "object" || Array.isArray(sd)) return null
    const obj = sd as Record<string, unknown>

    // Forma A (legacy/flattened): { extracted_data: {...} } a raíz
    const flatExtracted = obj.extracted_data
    if (
      flatExtracted &&
      typeof flatExtracted === "object" &&
      !Array.isArray(flatExtracted) &&
      Object.keys(flatExtracted).length > 0
    ) {
      return flatExtracted as Record<string, unknown>
    }

    // Forma B (raw desde backend): { extraction: { structured_data: {...} } }
    const extraction = obj.extraction
    if (extraction && typeof extraction === "object" && !Array.isArray(extraction)) {
      const inner = extraction as Record<string, unknown>
      const structured = inner.structured_data
      if (structured && typeof structured === "object" && !Array.isArray(structured)) {
        return structured as Record<string, unknown>
      }
      const rawPayload = inner.raw_payload
      if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
        return rawPayload as Record<string, unknown>
      }
    }

    return null
  })()

  // Construir lista de documentos para el visor
  const documents: DocumentEntry[] = []
  for (const { snap, et } of allSnapshots) {
    const rawUrl = snap.sourceFileUrl ?? et.fileUrl
    if (!rawUrl) continue
    const fullUrl = rawUrl.startsWith("http") ? rawUrl : `${apiUrl}${rawUrl}`
    if (!documents.find((d) => d.url === fullUrl)) {
      documents.push({
        id: snap.id,
        label: `v${snap.version} · ${snap.studyType}`,
        url: fullUrl,
        fileName: snap.sourceFileName ?? null,
      })
    }
  }

  const selectedDocIdx = documents.findIndex((d) => d.url === selectedDocumentUrl)

  function handleSnapshotSelect(snapshotId: string, fileUrl: string | null) {
    setSelectedSnapshotId(snapshotId)
    if (fileUrl) setSelectedDocumentUrl(fileUrl)
  }

  function handleDocumentSelect(idx: number) {
    const doc = documents[idx]
    if (doc) setSelectedDocumentUrl(doc.url)
  }

  const totalSnapshots = allSnapshots.length
  const currentFieldKeys = ((aiCalibration?.fieldDefinitions ?? []) as FieldDefinition[]).map(
    (f) => f.key
  )

  const tabCls = (tab: LeftTab) =>
    `px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
      activeTab === tab
        ? "border-violet-600 text-violet-700 bg-white"
        : "border-transparent text-slate-500 hover:text-slate-700 bg-slate-50"
    }`

  return (
    <div className="flex gap-0 min-h-0">
      {/* ── Panel izquierdo (40%) ─────────────────────────────────────────── */}
      <div className="w-[42%] shrink-0 flex flex-col min-h-0 border-r border-slate-200">
        {/* Tabs header */}
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50">
          {(["propuesta", "presentacion", "configuracion", "historial", "snapshots", "pruebas"] as LeftTab[]).map((tab) => (
            <button key={tab} className={tabCls(tab)} onClick={() => setActiveTab(tab)}>
              {TAB_LABELS[tab]}
              {tab === "propuesta" && candidateFields.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-xs">
                  {candidateFields.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Contenido del tab */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {/* ── Tab: Propuesta IA ── */}
          {activeTab === "propuesta" && (
            <div className="space-y-5">
              <CalibrationAIAssistantRail
                candidates={candidateFields}
                aiCalibration={aiCalibration}
                snapshotCount={totalSnapshots}
              />
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
                  Campos candidatos
                </p>
                <CandidateSchemaPanel
                  testId={testId}
                  candidates={candidateFields}
                  currentFieldKeys={currentFieldKeys}
                />
              </div>
            </div>
          )}

          {/* ── Tab: Presentación ── */}
          {activeTab === "presentacion" && (
            <PresentationSchemaPanel
              testId={testId}
              aiCalibration={aiCalibration}
              selectedSnapshot={
                selectedSnapshotEntry
                  ? {
                      id: selectedSnapshotEntry.snap.id,
                      studyType: selectedSnapshotEntry.snap.studyType,
                      extractedData: selectedExtractedData,
                    }
                  : null
              }
            />
          )}

          {/* ── Tab: Configuración (V1 legacy) ── */}
          {activeTab === "configuracion" && (
            <div className="space-y-4">
              {aiCalibration && (
                <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700">
                  <span className="font-bold">v{aiCalibration.currentVersion}</span>
                  <span>·</span>
                  <span className="font-mono">{aiCalibration.currentVersionLabel}</span>
                  <span className="ml-auto text-violet-500">Versión vigente</span>
                </div>
              )}
              <AICalibrationEditor testId={testId} initial={initialRawCalibration} />
            </div>
          )}

          {/* ── Tab: Historial ── */}
          {activeTab === "historial" && (
            <CalibrationVersionHistory aiCalibration={aiCalibration} />
          )}

          {/* ── Tab: Snapshots ── */}
          {activeTab === "snapshots" && (
            <SnapshotsTab
              eventTests={eventTests}
              apiUrl={apiUrl}
              selectedSnapshotId={selectedSnapshotId}
              onSelectSnapshot={handleSnapshotSelect}
            />
          )}

          {/* ── Tab: Pruebas (IMPL-20260715-04) ── */}
          {activeTab === "pruebas" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 space-y-1">
                <p className="font-semibold">Modo de prueba — FIX-20260810-08: persiste snapshots</p>
                <p>
                  Sube un PDF/XML para validar la calibración actual
                  (extracción + prediagnóstico). Cada corrida exitosa crea un
                  snapshot en la tabla <code className="font-mono">calibration_snapshots</code>{" "}
                  que aparece automáticamente en las tabs Presentación y Snapshots.
                  NO crea EventTest real (no hay paciente/trabajador asociado).
                </p>
              </div>
              <CalibrationTestUpload
                testId={testId}
                testType={aiCalibration?.canonicalStudyType ?? "Audiometria"}
                onResults={setTestResults}
                apiUrl={apiUrl}
              />
              {testResults && <CalibrationTestResults results={testResults} />}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel derecho (58%) — Documento sticky ────────────────────────── */}
      <div className="flex-1 min-w-0 sticky top-0 self-start h-screen">
        <div className="h-full border-l border-slate-200 flex flex-col bg-slate-900 rounded-br-xl overflow-hidden">
          {/* Barra superior del visor */}
          <div className="shrink-0 px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center gap-2">
            <span className="text-slate-300 text-xs font-semibold uppercase tracking-wide">
              Documento fuente
            </span>
            {documents.length > 0 && (
              <span className="ml-auto text-slate-400 text-xs">
                {documents.length} doc(s) disponible(s)
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <CalibrationDocumentViewer
              documents={documents}
              externalSelectedIdx={selectedDocIdx >= 0 ? selectedDocIdx : 0}
              onSelectDocument={handleDocumentSelect}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
