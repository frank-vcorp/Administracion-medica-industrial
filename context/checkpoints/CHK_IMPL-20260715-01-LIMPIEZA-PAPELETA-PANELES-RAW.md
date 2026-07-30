# Checkpoint IMPL-20260715-01 — Limpieza de Paneles Raw en Papeleta

**ID tarea:** IMPL-20260715-01
**SPEC de referencia:** `context/SPECs/SPEC_ARCH-20260715-01-LIMPIEZA-PAPELETA-PANELES-RAW.md`
**Implementa:** SOFIA (Constructora Principal)
**Fecha:** 2026-07-15
**Branch:** main (working tree, sin commit)

---

## Resumen ejecutivo

Se quitaron de la papeleta (`PapeletaWorkspace.tsx`) los dos paneles de debug técnico que mostraban JSON crudo:
- `StudyExtractionRawPanel` (raw de extracción)
- `StudyPrediagnosisRawPanel` (raw de entrada clínica al prediagnóstico)

Los archivos de los componentes **se conservan intactos** porque siguen siendo usados por el panel de calibración administrativo (`/admin/services/[id]/calibration`).

La papeleta ahora muestra solo:
1. La presentación clínica estructurada (`ClinicalExtractionRenderer`)
2. El panel de revisión médica con botones de aceptar / editar / rechazar (`StudyAIPrediagnosisPanel`)

---

## Archivos modificados

| Archivo | Líneas eliminadas | Diff |
|---|---|---|
| `frontend/src/components/clinical/PapeletaWorkspace.tsx` | 14 | -1 import + 13 del bloque render |
| `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx` | 7 | -2 imports + -2 (campo `input_debug` + comentario) + -3 (render block + comentario + blank line) |

```
$ git diff --stat HEAD
 frontend/src/components/clinical/PapeletaWorkspace.tsx       | 14 --------------
 frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx |  7 -------
 2 files changed, 21 deletions(-)
```

---

## Cambios puntuales

### `PapeletaWorkspace.tsx`

**Eliminado (línea 41 — import):**
```tsx
import StudyExtractionRawPanel from "@/components/clinical/StudyExtractionRawPanel"
```

**Eliminado (líneas 1377-1388 — bloque de render):**
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

### `StudyAIPrediagnosisPanel.tsx`

**Eliminado (líneas 15-16 — imports):**
```tsx
import StudyPrediagnosisRawPanel from "@/components/clinical/StudyPrediagnosisRawPanel"
import type { PrediagnosisInputDebug } from "@/components/clinical/StudyPrediagnosisRawPanel"
```

**Eliminado (líneas 51-52 — campo en tipo):**
```tsx
// IMPL-20260516-08: RAW de entrada clínica (ARCH-20260516-08). Optional para compat. con snapshots viejos.
input_debug?: PrediagnosisInputDebug | null
```

**Eliminado (líneas 527-528 — bloque de render):**
```tsx
{/* IMPL-20260516-08: Panel RAW de entrada clínica (ARCH-20260516-08) */}
<StudyPrediagnosisRawPanel inputDebug={predxData.input_debug} />
```

---

## Validaciones (4 Gates)

### Gate 1 — Compilación
- ✅ `tsc --noEmit` (en `frontend/`): **0 errores en archivos tocados**
  - Los 29 errores de typecheck que reporta `tsc --noEmit` son **todos pre-existentes** en archivos de tests (`__tests__/**`) por issues de configuración de Vitest (imports `vi`, `beforeEach`, `expect.toBeNull`, etc.) — **NO relacionados con esta tarea**.
- ✅ `next build` (Turbopack): **`✓ Compiled successfully in 20.2s`** — la fase de compilación de TypeScript y bundling pasa sin issues.
  - El exit code != 0 viene de la fase de **prerender estático** que requiere `DATABASE_URL` y `NEXTAUTH_SECRET` (variables de entorno que **no están configuradas en este entorno de build**). Verificado con `git stash` que el mismo error ocurre en `main` sin mis cambios → **pre-existente, fuera del alcance de esta SPEC**.

### Gate 2 — Testing
- ✅ Suite vitest no se modificó; no hay tests nuevos para esta limpieza (es puramente remoción de UI).
- ⚠️ Nota: las Suites existentes tienen errores de tipos pre-existentes (vitest config), no generados por esta tarea.

### Gate 3 — Revisión
- ✅ `eslint src/components/clinical/PapeletaWorkspace.tsx StudyAIPrediagnosisPanel.tsx StudyExtractionRawPanel.tsx StudyPrediagnosisRawPanel.tsx`:
  - 1 error + 2 warnings, **todos pre-existentes** en líneas no tocadas por esta tarea (`workerInfo` unused @293, `setState in effect` @341, `CapturedValuesPanel` unused @753).
  - Verificado con `git stash` que esos 3 problemas existen idénticos en `main` sin mis cambios.
  - **0 issues nuevos** introducidos por esta implementación.

### Gate 4 — Documentación
- ✅ Este checkpoint (`CHK_IMPL-20260715-01-LIMPIEZA-PAPELETA-PANELES-RAW.md`).
- ✅ Comentarios `@intervention` y `@id` de los archivos modificados se mantienen intactos.
- ✅ Comentarios históricos (`IMPL-20260516-08`, `ARCH-20260516-08`) referenciados solo en archivos que se conservan (los raw panels).

---

## Criterios de aceptación (SPEC §93-102)

| # | Criterio | Estado |
|---|---|---|
| 1 | La papeleta NO muestra paneles raw de debug (JSON crudo) | ✅ |
| 2 | La papeleta SÍ muestra la presentación clínica estructurada (`ClinicalExtractionRenderer`) | ✅ (no se tocó; sigue en línea 1276) |
| 3 | La papeleta SÍ muestra el panel de revisión médica con botones de aceptar/editar/rechazar | ✅ (no se tocó el `<form>` de review) |
| 4 | El panel de calibración (`/admin/services/[id]/calibration`) sigue mostrando snapshots y raw JSON | ✅ (no se tocó) |
| 5 | Los archivos `StudyExtractionRawPanel.tsx` y `StudyPrediagnosisRawPanel.tsx` siguen existiendo | ✅ (verificado con `ls`) |
| 6 | TypeScript compila sin errores en los archivos modificados | ✅ |
| 7 | No hay imports huérfanos ni warnings de ESLint nuevos | ✅ |

---

## Self-Review Manual (5 puntos solicitados)

### 1. ¿El código refleja la SPEC?
**Sí.** Se ejecutaron exactamente los 5 cambios puntuales listados en SPEC §46-92:
- PapeletaWorkspace.tsx: import + bloque render eliminados.
- StudyAIPrediagnosisPanel.tsx: 2 imports + campo `input_debug` + bloque render eliminados.

### 2. ¿Hay code smells evidentes?
**No.** Cambios son remociones puras (deletion-only); no introducen nueva lógica. La forma del JSX queda balanceada (sin tags huérfanos), los paréntesis del ternario eliminado se removieron completos con el bloque. El render de `ClinicalExtractionRenderer` y el bloque de revisión médica quedan intactos visualmente.

### 3. ¿Los imports huérfanos fueron eliminados?
**Sí.** Grep confirma:
- `StudyExtractionRawPanel`: solo referenciado dentro del propio archivo `StudyExtractionRawPanel.tsx` (declaración del export default) y en un comentario de paridad visual dentro de `StudyPrediagnosisRawPanel.tsx`. **No quedan consumidores en el resto del código.**
- `StudyPrediagnosisRawPanel` y `PrediagnosisInputDebug`: solo referenciados dentro de su propio archivo.
- `input_debug`: solo referenciado dentro de `StudyPrediagnosisRawPanel.tsx`.

Ningún consumidor huérfano en `frontend/src/**`.

### 4. ¿Algún riesgo de regresión en la papeleta?
**Riesgo bajo.** Lo único que cambió visiblemente para el usuario final:
- Desaparece el bloque "Panel raw de extracción" debajo del `StudyDocumentViewer`. Este panel solo aparecía cuando `test.extractionSnapshot` existía (no es la presentación clínica estructurada — eso está separado, en el bloque `<ClinicalExtractionRenderer>` más arriba en el árbol).
- Desaparece el `<StudyPrediagnosisRawPanel>` dentro del panel de prediagnóstico.

**Conservado íntegro:**
- `ClinicalExtractionRenderer` (presentación clínica con tablas, frecuencias, PTA, etc.).
- El `<form>` con botones Aceptar / Editar / Rechazar.
- El flujo de subida de archivos.
- El estado de tests, snapshots y reseñas.

**Datos intactos en backend:** El campo `rawPayload` del snapshot y `input_debug` en el JSON de prediagnóstico siguen siendo **producidos y almacenados** — solo dejan de **mostrarse** en la papeleta. La calibración los sigue mostrando. Si en el futuro queremos revertir, basta volver a importar los paneles.

### 5. ¿TypeScript compila sin errores?
**Sí** en los archivos modificados (0 errores). Errores pre-existentes en tests de Vitest no son bloqueantes para esta tarea.

---

## Riesgos y desviaciones

- **Ninguno material.** Los cambios son 100% aditivos en negativo (remociones puras).
- **Riesgo conocido:** El `next build` falla en fase de prerender por `DATABASE_URL` y `NEXTAUTH_SECRET` ausentes. Esto es **pre-existente en `main`** y **fuera del alcance** de esta SPEC (es config de entorno, no de código). El paso de TypeScript y Turbopack compilan limpios.
- **Decisión deliberada:** No se removieron los archivos `.tsx` de los raw panels (la SPEC explícitamente lo prohíbe). El campo `extractionSnapshot.rawPayload` en el tipo de `StudyTest` se mantiene (la SPEC tampoco lo pide eliminar; y la data sigue siendo serializada desde `page.tsx`).

---

## Capturas / evidencia

- `git diff --stat HEAD` mostrado arriba.
- Grep de imports huérfanos: 0 hits fuera de los propios archivos preservados.
- Lint diff: stash confirma mismas 3 issues pre-existentes en main.
- Build diff: stash confirma mismo error de prerender pre-existente en main.

---

## Próximo paso recomendado

Invocar a **GEMINI** (`subagent_type='gemini'`) como segunda mano de validación antes de commitear, dado que Qodo está sunset (regla global INTEGRA).

Tareas pendientes post-commit:
- Revisar PDF real de Audiometría
- Calibrar prompts de extracción y prediagnóstico en `/admin/services/[id]/calibration`
- Sincronizar prompt clínico de Audiometría al fallback backend (`prediagnostic.py`)

---

**ID intervención:** IMPL-20260715-01
**Firma SOFIA:** implementación completa, 4 Gates validados, esperando OK de INTEGRA para commit.
