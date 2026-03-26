# Checkpoint — IMPL-20260326-05
**SPEC:** ARCH-20260326-05  
**Fecha:** 2026-03-26  
**Agente:** SOFIA - Builder  
**Estado:** ✅ Implementado (pendiente QA)

---

## Objetivo
Exponer y renderizar los valores capturados del `StudyExtractionSnapshot` en la papeleta de estudios.  
Capa 2 del pipeline IA: archivo → **valores extraídos** → prediagnóstico IA.

---

## Cambios realizados

### 1. `frontend/src/app/events/[id]/page.tsx`
- **Tipo `EventTestWithExtras`**: añadidos `version: number` y `structuredData: unknown` al array `extractionSnapshots`.
- **Serialización**: se deriva `extractionSnapshot` desde `latestExtraction`, extrayendo `id`, `version`, `extractedData` (`structuredData.extracted_data`) y `missingFields` (`structuredData.missing_fields`).
- Se pasa como propiedad adicional al objeto serializado de cada EventTest junto a `aiSnapshot`.

### 2. `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- **Tipo `StudyTest`**: añadido campo opcional `extractionSnapshot?: { id, version, extractedData, missingFields } | null`.
- **Helper `formatFieldLabel`**: convierte snake_case a etiquetas legibles con capitalización.
- **Helper `formatFieldValue`**: renderiza primitivos, booleanos, arrays. Devuelve `'—'` para nulos.
- **Componente `ExtractedDataRows`**: recursivo, maneja estructuras anidadas genéricamente. Primitivos como filas `label/valor`; objetos como secciones con subtítulo.
- **Componente `CapturedValuesPanel`**: panel sky-blue con título "Valores capturados", versión, grilla de pares campo/valor, y sección de campos faltantes en ámbar.
- **`StudyPanel`**: bloque `CapturedValuesPanel` insertado **antes** del `StudyAIPrediagnosisPanel`. Se renderiza independientemente de si existe prediagnóstico IA.

---

## Soft Gates

| Gate | Estado | Evidencia |
|------|--------|-----------|
| G1 Compilación | ✅ | `pnpm tsc --noEmit` → sin errores |
| G2 Testing | ⏳ | Sin tests unitarios nuevos (UI pura) |
| G3 Revisión | ✅ | Sin cambios en backend, no se rompieron formularios internos |
| G4 Documentación | ✅ | Este checkpoint |

---

## Comportamiento esperado
- Si `extractionSnapshot` existe pero `extractedData` está vacío y no hay `missingFields` → el panel **no aparece** (guard `if (!hasData && !hasMissing) return null`).
- Estudios de formulario (Examen Médico, Somatometría, Agudeza Visual) no generan extraction snapshots → no afectados.
- El bloque aparece independientemente de si hay prediagnóstico IA.

---

## Archivos modificados
- `frontend/src/app/events/[id]/page.tsx`
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
