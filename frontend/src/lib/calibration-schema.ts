/**
 * @fileoverview Derivación heurística de esquema candidato IA desde snapshots reales.
 *   Función pura — sin dependencias de servidor ni Prisma.
 *   Analiza extracted_data de los snapshots y produce CandidateField[].
 * @id IMPL-20260327-19
 * @backup context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
 */

import type { CandidateField, CandidateFieldType } from "@/types/calibration"

// ─────────────────────────────────────────────────────────────────────────────
// Clasificación de tipo de dato
// ─────────────────────────────────────────────────────────────────────────────

function categorizeType(value: unknown): CandidateFieldType {
  if (value === null || value === undefined) return "unknown"
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "number") return "number"
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return "date"
    return "text"
  }
  return "unknown"
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipo mínimo requerido para el análisis (subconjunto de ExtractionSnapshot)
// ─────────────────────────────────────────────────────────────────────────────

interface SnapshotInput {
  structuredData: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal — exportada y pura
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analiza los `extracted_data` de un conjunto de snapshots de extracción
 * y produce una lista ordenada de CandidateField por confianza descendente.
 * Solo usa heurísticas basadas en frecuencia y tipo de valor — no llama a backend.
 */
export function deriveSchemaFromSnapshots(snapshots: SnapshotInput[]): CandidateField[] {
  const totalSnapshots = snapshots.length
  if (totalSnapshots === 0) return []

  // Map: key → acumuladores de análisis
  const keyMap = new Map<
    string,
    {
      count: number
      types: Map<CandidateFieldType, number>
      exampleValues: Set<string>
    }
  >()

  for (const snap of snapshots) {
    const structured = snap.structuredData as Record<string, unknown> | null
    if (!structured || typeof structured !== "object") continue

    const extracted = structured.extracted_data
    if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) continue

    const extractedObj = extracted as Record<string, unknown>

    for (const [key, value] of Object.entries(extractedObj)) {
      if (!keyMap.has(key)) {
        keyMap.set(key, { count: 0, types: new Map(), exampleValues: new Set() })
      }
      const entry = keyMap.get(key)!
      entry.count++

      const detectedType = categorizeType(value)
      entry.types.set(detectedType, (entry.types.get(detectedType) ?? 0) + 1)

      if (entry.exampleValues.size < 3 && value !== null && value !== undefined) {
        const strVal = String(value).trim()
        if (strVal !== "" && strVal !== "null" && strVal !== "undefined") {
          entry.exampleValues.add(strVal)
        }
      }
    }
  }

  const fields: CandidateField[] = []

  for (const [key, data] of keyMap.entries()) {
    const frequency = data.count
    const confidence = Math.round((frequency / totalSnapshots) * 100)

    // Determinar tipo dominante
    let dominantType: CandidateFieldType = "unknown"
    let maxCount = 0
    for (const [type, count] of data.types.entries()) {
      if (count > maxCount) {
        maxCount = count
        dominantType = type
      }
    }

    // Recomendación basada en confianza
    let recommendation: CandidateField["recommendation"] = "review"
    if (confidence >= 70) recommendation = "accept"
    else if (confidence < 30) recommendation = "discard"

    // Etiqueta legible desde la clave snake_case
    const label = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())

    fields.push({
      key,
      label,
      type: dominantType,
      frequency,
      totalSnapshots,
      exampleValues: Array.from(data.exampleValues),
      confidence,
      aliases: [],
      recommendation,
    })
  }

  return fields.sort((a, b) => b.confidence - a.confidence)
}
