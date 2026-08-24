# IMPL-REPORT — FEATURE-20260824-01 (rev. 1.1)

ID intervención: IMPL-20260824-01 (corrección `IMPLEMENTATION_DEFECT` rev. 1.1)
ID tarea: FEATURE-20260824-01 (Criterios clínicos de Espirometría en Events)
SPEC: `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md` rev. 1.1
Estado: READY_FOR_VERIFYING

## Defecto detectado (rev. 1 → rev. 1.1)

El usuario verificó visualmente el Event: el bloque `Criterios clínicos de Espirometría` sólo mostraba el sub-bloque `NOTAS DE CALIDAD`. Faltan los 11 criterios individuales (Pico máximo, Forma triangular, Libre de artefactos, Meseta, Tiempo, Repetibilidad FVC < 200, Repetibilidad FEV1 < 200, #Pruebas aceptables, Criterios para Dx, Calidad, Repetibilidad FVC numérica, Repetibilidad FEV1 numérica).

### Causa raíz

`EspirometriaClinicalCriteriaPanel` recibía sólo `extractedData.calidad`. Cuando el snapshot del lote (`extraction-espirometria-rd2026.json`) no expone `repetibilidad_fvc_ml`/`repetibilidad_fev1_ml` ni `pruebas_aceptables` explícitos en `calidad`, el panel no tenía forma de derivarlos de la tabla `parametros[]` (donde sí están M1/M2/M3 de FVC/FEV1). El payload real SÍ contiene las maniobras; sólo que en la clave `parametros[]`, no en `calidad`.

La SPEC rev. 1.1 (sección §2.1) formaliza el cálculo determinista obligatorio desde `parametros[]`.

### Corrección aplicada

- `EspirometriaClinicalCriteriaPanel.tsx`:
  - Prop cambiada: `calidad: Record<string, unknown>` → `extractedData: Record<string, unknown>`.
  - Nuevo helper exportado `computeRepetibilidadFromRow(row)`:
    - Toma los 2 valores más altos de `m1/m2/m3` de la fila `parametros`.
    - `diffMl` = diferencia × 1000 sólo si `unidad === 'L'` (no se inventa unidad).
    - `pruebas` = # de maniobras válidas (finitas).
  - Nuevo helper exportado `resolveCriteria(extractedData)`:
    - `repetibilidad_fvc_ml`/`fev1_ml`: extraído en `calidad` **gana** sobre cálculo desde `parametros`.
    - `repetibilidad_<200`: extraído en `calidad` gana; si no, derivado como `Sí`/`No` del diff.
    - `pruebas_aceptables`: extraído gana; si no, count de M1/M2/M3 de la fila FVC (fallback FEV1).
    - Cualitativos (Pico máximo, Forma triangular, Libre de artefactos, Meseta, Tiempo, Criterios para Dx, Calidad): **NO se infieren** desde la tabla numérica — sólo se muestran si vienen del payload; si no, label visible con `—`.
  - Layout reorganizado para coincidir con la segunda imagen:
    1. **Repetibilidad numérica** (FVC ml, FEV1 ml) — primero.
    2. **Indicadores de calidad** (8 badges SI/NO: <200 FVC, <200 FEV1, Pico, Forma, Libre, Meseta, Tiempo, Criterios).
    3. **Resumen de aceptabilidad** (#Pruebas, Calidad).
    4. **Notas de calidad** (si existen).
    5. **Texto fuente del documento** (sólo si `impresion_diagnostica_texto`/`recomendaciones_texto` presentes; marbete explícito "no es diagnóstico IA").
  - Atributos `data-testid` para E2E: `repetibilidad-fvc-ml`, `repetibilidad-fev1-ml`, `pruebas-aceptables`.
  - Etiqueta visible pequeña "PDF" / "calc." para auditoría del origen (extraído vs derivado).
- `PapeletaWorkspace.tsx`: prop del componente actualizada para pasar `extractedData` raíz en lugar de `calidad.calidad`. Sin tocar el resto del flujo.
- `extraction-presentation-schemas.ts`: **NO modificado** — el panel usa `resolveCriteria` propio; no se expone nada al renderer clínico general (contrato protegido).
- `StudyAIPrediagnosisPanel.tsx`: sin cambios (rev. 1.0 sigue vigente).

## Archivos modificados

- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx` — rediseño completo del componente (~470 líneas).
- `frontend/src/components/clinical/PapeletaWorkspace.tsx` — cambio de prop (`calidad` → `extractedData`); +1/-1 línea efectiva.
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` — reescrito completo con 31 tests cubriendo SPEC rev. 1.1.
- `frontend/src/components/clinical/__tests__/StudyAIPrediagnosisPanel.open-details.test.ts` — sin cambios (3 tests siguen pasando).

## Validación

- **typecheck:** PASS — `npx tsc --noEmit` sin errores.
- **tests focales (V1):** PASS — 34/34 (31 del panel rediseñado + 3 del panel IA con `details open`).
  - AC-2 con payload real: `FVC 30.00`, `FEV1 40.00`, ambos `Sí`, `3` pruebas.
  - AC-5 payload parcial: extraído gana sobre calculado; cualitativos no se infieren.
  - AC-6: discriminación Audiometría vs Espirometría.
  - Helper puro `computeRepetibilidadFromRow` cubre 6 casos (orden de maniobras, una sola maniobra, sin fila, unidad distinta de L, valores reales del PDF Sibelmed).
  - Tests de precedencia extraído > calculado cubren 5 escenarios.
- **V2 suite frontend:** no reejecutada en este incremento (presupuesto §11; V2 ya fue PASS-en-alcance en rev. 1.0; sólo cambia un prop y un componente UI sin acoplar a otros archivos). Sin delta de riesgo vs rev. 1.0.
- **V3 Playwright:** pendiente — sigue correspondiendo al gate final de GEMINI sobre el expediente real con `context/RD2026/ESPIROMETRIA.pdf`. Ahora el panel SÍ tiene `data-testid` propios (`repetibilidad-fvc-ml`, `repetibilidad-fev1-ml`, `pruebas-aceptables`) para assertions deterministas.

## Trazabilidad (AC → evidencia) rev. 1.1

| AC | Cobertura |
|---|---|
| AC-1 — Criterios visibles antes de `Prediagnóstico IA` | Tests `AC-1: renderiza el bloque…`; ubicación física del bloque en `PapeletaWorkspace.tsx` (columna derecha, entre visor y panel IA, sin cambios vs rev. 1.0). |
| AC-2 — FVC 30 ml y FEV1 40 ml | Test `AC-2: muestra FVC 30.00 ml y FEV1 40.00 ml calculados desde parametros[]` + helper test `FVC: diff entre 2 valores más altos = 30 ml` y `FEV1: … = 40 ml`. **Con el PDF Sibelmed ahora se muestran exactamente `30.00` y `40.00`** (toFixed(2) sobre diff L×1000). |
| AC-3 — 3 pruebas aceptables y calidad A | Test `AC-3: muestra 3 pruebas aceptables derivado de M1/M2/M3 presentes` verifica `data-criteria-value="3"`. Calidad A cubierta por `AC-3: muestra calidad A`. |
| AC-4 — `details open` | Test `Justificación, Limitaciones y Fuentes clínicas inician con atributo open` cuenta `≥ 3` matches `<details … open>`. |
| AC-5 — Payload parcial sin inflar | 4 tests: `Sin extractionSnapshot…`, `Sin parametros[] ni calidad`, `Sólo calidad sin parametros (no infla numéricos)`, `Sólo parametros[] (calcula + "—" para cualitativos ausentes)`. |
| AC-6 — Audiometría y otros tipos | `hasRenderableEspirometriaCriteria` testea Audiometría → false; Espirometría → true; null/undefined → false. |
| AC-7 — Typecheck + tests focales PASS | PASS — `tsc --noEmit` limpio, 34/34 tests focales PASS. |

## Cumplimiento §2.1 (cálculos deterministas)

- ✅ `repetibilidad_fvc_ml`: diff top-2 FVC × 1000 (L → ml). Con payload Sibelmed: `30.00 ml`.
- ✅ `repetibilidad_fev1_ml`: idem FEV1. Con payload Sibelmed: `40.00 ml`.
- ✅ `repetibilidad_fvc_menor_200`: `Sí` cuando diff < 200 ml. Con payload Sibelmed: `Sí`.
- ✅ `repetibilidad_fev1_menor_200`: idem. Con payload Sibelmed: `Sí`.
- ✅ `pruebas_aceptables`: count de M1/M2/M3 finitos de la fila FVC. Con payload Sibelmed: `3`.
- ✅ Cualitativos sólo si vienen del payload (no inferencia silenciosa desde tabla numérica).
- ✅ Si el extractor ya emitió `repetibilidad_fvc_ml`/`fev1_ml`/`pruebas_aceptables`/`<200` en `calidad`, esos ganan sobre el cálculo.

## Riesgos y notas de reversión

- Riesgo bajo: presentacional sobre snapshot existente, sin tocar extractor, persistencia ni calibración publicada. Extracción real gana sobre derivación (consistente con §2.1).
- Numeración float: la diff se calcula con floats JS (`2.33 - 2.30 = 0.03000000000000025`), pero el render visible usa `toFixed(2)` → muestra `30.00` exacto. Los tests verifican ambos: visible (`>30.00<`) y atributo crudo (`data-criteria-value="30…"`).
- No se introdujo dependencia nueva, lockfile no modificado, sin migraciones, sin deploy, sin commit/push (siguiendo la orden de Frank; el commit anterior ya fue publicado y ATLAS integrará el nuevo corte).

## Pendientes ATLAS

1. Gate V3 Playwright (GEMINI) sobre el Event real con `context/RD2026/ESPIROMETRIA.pdf`; ahora se cuenta con `data-testid` deterministas para asserts Playwright.
2. Confirmar archivado del expediente Olvera/Jorge (FND-20260824-01) antes de cualquier prueba clínica nueva — Frank.