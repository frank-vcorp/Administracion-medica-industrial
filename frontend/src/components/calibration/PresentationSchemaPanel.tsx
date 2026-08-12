/**
 * @fileoverview Visor puro key/value del snapshot seleccionado (tab Presentación).
 * Lee `selectedSnapshot` y muestra cada clave top-level del `extractedData` en una tabla.
 * Sin estado editable, sin IA, sin "Guardar schema".
 * @id FIX-20260812-07
 * @backup context/interconsultas/SPEC-IMPL-20260812-07-VISOR-PRESENTACION.md
 */
'use client'

interface SnapshotInput {
  id: string
  studyType: string
  extractedData: Record<string, unknown> | null
  sourceFileName?: string | null
  createdAt?: Date | string | null
}

interface PresentationSchemaPanelProps {
  selectedSnapshot: SnapshotInput | null
}

function summarizeValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) {
    return `[${value.length} elemento${value.length === 1 ? '' : 's'}]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>)
    return `{${keys.length} clave${keys.length === 1 ? '' : 's'}}`
  }
  if (typeof value === 'string') return value
  return String(value)
}

function isExpandable(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0
  }
  return false
}

function extractData(extractedData: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!extractedData || typeof extractedData !== 'object' || Array.isArray(extractedData)) {
    return null
  }
  // FIX-20260812-07: tolerar ambos shapes que pueden llegar desde el padre.
  // 1) { extracted_data: {...}, missing_fields: [...], _raw_*: ... }  (flat via _flattenStructuredData)
  // 2) { extraction: { structured_data: {...} }, prediagnosis: {...} }
  // 3) raíz ya plana
  const root = extractedData as Record<string, unknown>
  const direct = root.extracted_data
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>
  }
  const extraction = root.extraction as Record<string, unknown> | undefined
  const structured = extraction?.structured_data
  if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
    return structured as Record<string, unknown>
  }
  return root
}

export default function PresentationSchemaPanel({
  selectedSnapshot,
}: PresentationSchemaPanelProps) {
  if (!selectedSnapshot) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Selecciona un snapshot del panel derecho o sube un PDF.
      </div>
    )
  }

  const data = extractData(selectedSnapshot.extractedData)
  const entries: [string, unknown][] = data
    ? Object.entries(data)
    : []

  const shortId = selectedSnapshot.id.slice(0, 8)
  const createdAt = selectedSnapshot.createdAt
    ? new Date(selectedSnapshot.createdAt).toISOString()
    : null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Presentación</p>
        <h3 className="text-sm font-bold text-slate-800">
          {selectedSnapshot.studyType} (v{shortId})
        </h3>
        {selectedSnapshot.sourceFileName && (
          <p className="mt-1 font-mono text-xs text-slate-600">
            📄 {selectedSnapshot.sourceFileName}
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Sin datos extraídos. Sube un PDF y vuelve a este tab.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Campo
                </th>
                <th className="border-b border-slate-200 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key} className="border-b border-slate-100 align-top last:border-b-0">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">{key}</td>
                  <td className="px-4 py-2">
                    {isExpandable(value) ? (
                      <details className="group">
                        <summary className="cursor-pointer text-xs font-medium text-slate-700">
                          {summarizeValue(value)}
                        </summary>
                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-3 text-xs text-green-300">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800">
                        {summarizeValue(value)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        <span>
          Snapshot <span className="font-mono text-slate-700">{selectedSnapshot.id}</span>
        </span>
        {createdAt && <span className="font-mono">{createdAt}</span>}
      </div>
    </div>
  )
}