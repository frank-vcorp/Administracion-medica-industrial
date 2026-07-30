# SPEC ARCH-20260715-01 — Limpieza de Paneles Raw de Debug en Papeleta

## Contexto

Actualmente la papeleta (`PapeletaWorkspace.tsx`) contiene dos paneles de debug técnico que muestran JSON crudo:

1. **`StudyExtractionRawPanel`** — muestra el JSON crudo de lo que la IA extrajo del PDF
2. **`StudyPrediagnosisRawPanel`** — muestra el payload de entrada clínica que se mandó a MedGemma

Estos paneles son herramientas de **calibración y debug**, no de operación clínica. Su lugar correcto es el panel administrativo de calibración (`/admin/services/[id]/calibration`), donde ya existen equivalentes funcionales:

| Lo que hay en la papeleta (debug) | Equivalente en calibración (admin) |
|---|---|
| `StudyExtractionRawPanel` (raw JSON) | Tab "📋 Snapshots" → datos extraídos + raw |
| `StudyPrediagnosisRawPanel` (payload clínico) | Tab "📋 Snapshots" → prediagnóstico + raw |
| — | Tab "🧩 Presentación" → extracted_data + schema visual |

## Objetivo

**Quitar de la papeleta** los paneles raw de debug para que el médico vea solo:
- La presentación clínica estructurada (tablas de frecuencias, PTA, resumen bilateral, etc.)
- El panel de revisión médica (aceptar/editar/rechazar prediagnóstico IA)

**Mantener en el panel de calibración** todo lo relacionado con debug, snapshots, raw JSON y edición de prompts.

## Alcance

### ✅ INCLUYE

1. Eliminar importación y uso de `StudyExtractionRawPanel` en `PapeletaWorkspace.tsx`
2. Eliminar importación y uso de `StudyPrediagnosisRawPanel` en `StudyAIPrediagnosisPanel.tsx`
3. Conservar la presentación clínica estructurada (`ClinicalExtractionRenderer`)
4. Conservar el panel de revisión médica con botones de aceptar/editar/rechazar
5. Conservar los componentes raw en el código (no borrar archivos), solo quitarlos de la papeleta
6. Validar que la papeleta siga funcionando correctamente sin los paneles raw

### ❌ NO INCLUYE

- Borrar los archivos `StudyExtractionRawPanel.tsx` ni `StudyPrediagnosisRawPanel.tsx`
- Modificar el panel de calibración (`/admin/services/[id]/calibration`)
- Cambiar la lógica de extracción ni prediagnóstico en backend
- Modificar el `ClinicalExtractionRenderer` ni `StudyAIPrediagnosisPanel` (excepto quitar el raw panel)

## Especificación Técnica

### Archivo 1: `frontend/src/components/clinical/PapeletaWorkspace.tsx`

**Cambios:**

1. Eliminar línea 41:
```tsx
import StudyExtractionRawPanel from "@/components/clinical/StudyExtractionRawPanel"
```

2. Eliminar líneas 1378-1388 (bloque completo del panel raw de extracción):
```tsx
{/* Panel raw de extracción — separado del prediagnóstico */}
{test.extractionSnapshot ? (
  <StudyExtractionRawPanel
    rawPayload={test.extractionSnapshot.rawPayload}
    snapshotId={test.extractionSnapshot.id}
    version={test.extractionSnapshot.version}
  />
) : (
  <div className="bg-slate-900 rounded-xl px-4 py-3">
    <p className="text-xs font-mono text-slate-500">🔩 Sin snapshot de extracción disponible.</p>
  </div>
)}
```

### Archivo 2: `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx`

**Cambios:**

1. Eliminar líneas 15-16:
```tsx
import StudyPrediagnosisRawPanel from "@/components/clinical/StudyPrediagnosisRawPanel"
import type { PrediagnosisInputDebug } from "@/components/clinical/StudyPrediagnosisRawPanel"
```

2. Eliminar líneas 51-52 (tipo `PrediagnosisInputDebug` en `AIPrediagnosisData`):
```tsx
// IMPL-20260516-08: RAW de entrada clínica (ARCH-20260516-08). Optional para compat. con snapshots viejos.
input_debug?: PrediagnosisInputDebug | null
```

3. Eliminar líneas 527-528 (renderizado del panel raw):
```tsx
{/* IMPL-20260516-11: RAW de entrada clínica — separado del output visible */}
<StudyPrediagnosisRawPanel inputDebug={predxData.input_debug} />
```

## Criterios de Aceptación

1. ✅ La papeleta NO muestra paneles raw de debug (JSON crudo)
2. ✅ La papeleta SÍ muestra la presentación clínica estructurada (`ClinicalExtractionRenderer`)
3. ✅ La papeleta SÍ muestra el panel de revisión médica con botones de aceptar/editar/rechazar
4. ✅ El panel de calibración (`/admin/services/[id]/calibration`) sigue mostrando snapshots y raw JSON
5. ✅ Los archivos `StudyExtractionRawPanel.tsx` y `StudyPrediagnosisRawPanel.tsx` siguen existiendo (no se borran)
6. ✅ TypeScript compila sin errores (`pnpm typecheck`)
7. ✅ No hay imports huérfanos ni warnings de ESLint

## Validaciones Obligatorias

```bash
# 1. Typecheck
pnpm typecheck

# 2. Lint (si existe script)
pnpm lint

# 3. Build de frontend
pnpm build --filter frontend
```

## Notas para Sofia

- **NO borres los archivos** `StudyExtractionRawPanel.tsx` ni `StudyPrediagnosisRawPanel.tsx`. Solo quítalos de la papeleta.
- El panel de calibración ya tiene su propia UI para ver snapshots y raw JSON. No lo toques.
- Si después de quitar los imports hay tipos huérfanos (como `PrediagnosisInputDebug`), elimínalos también.
- Conserva todos los comentarios y documentación relevante en los archivos que NO se modifican.

## Archivos Afectados

1. `frontend/src/components/clinical/PapeletaWorkspace.tsx` — quitar import y uso de `StudyExtractionRawPanel`
2. `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx` — quitar import y uso de `StudyPrediagnosisRawPanel`

## Archivos NO Afectados (se conservan)

- `frontend/src/components/clinical/StudyExtractionRawPanel.tsx` — componente se conserva
- `frontend/src/components/clinical/StudyPrediagnosisRawPanel.tsx` — componente se conserva
- `frontend/src/components/calibration/*` — panel de calibración no se modifica
- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` — presentación estructurada se conserva
- `backend/app/services/ai/*` — backend no se modifica

## Siguiente Paso (Post-Implementación)

Después de completar esta limpieza, el siguiente paso será:
- Revisar PDF real de Audiometría
- Calibrar prompts de extracción y prediagnóstico en el panel de calibración
- Sincronizar prompt clínico de Audiometría al fallback backend (`prediagnostic.py`)

## Metadata

- **ID:** ARCH-20260715-01
- **Fecha:** 2026-07-15
- **Autor:** INTEGRA (Arquitecto de Soluciones)
- **Implementa:** SOFIA (Constructora Principal)
- **Prioridad:** Alta
- **Estimación:** 1-2 horas
