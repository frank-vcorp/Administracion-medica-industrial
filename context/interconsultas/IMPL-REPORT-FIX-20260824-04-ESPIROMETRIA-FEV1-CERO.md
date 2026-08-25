# IMPL-REPORT — IMPL-FIX-20260824-04 (Dictamen FIX-20260824-04 sobre regresión FEV1=0)

```
ID intervención: IMPL-FIX-20260824-04
ID tarea: FIX-20260824-04 (regresión FEV1=0)
Estado: READY_FOR_VERIFYING
SPEC activa: context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
             rev. 1.2 (sin cambios — corrección IMPLEMENTATION_DEFECT dentro
             de la misma SPEC, extendida a extracción + panel + integración)
Discovery refs: DEC-20260824-02, BR-20260824-01 (umbral AMI ≤ 150 ml),
                BR-20260824-02 (inferencia visual de gráficas)
Origen funcional: el extractor Sibelmed W20s está duplicando M2 como M1
                  en la fila FEV1 (m1=m2=2.11, %REF 76/76) en algunos
                  contextos, mientras "Mejor FEV1" conserva 2.15. La
                  fórmula `(m1 − m2) × 1000 = 0 ml` produce 0 ml en
                  lugar del 40 ml correcto.
```

## Síntoma

Con la última extracción de `context/RD2026/ESPIROMETRIA.pdf`, el panel
"Criterios clínicos de Espirometría" mostraba:

| Parámetro | Valor mostrado (defectuoso) | Valor esperado (canónico) |
|---|---|---|
| Repetibilidad FEV1 | **0 ml** (`(2.11 − 2.11) × 1000`) | **40 ml** (`(2.15 − 2.11) × 1000`) |
| Repetibilidad FVC | 30 ml (`(2.33 − 2.30) × 1000`) | 30 ml (no regresa) |

El backend ya marcó la fila como inconsistente con la anotación
`SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` y forzó `completitud_documental =
"no_concluyente"` (rev. 1.5 — defensa trazable, no corrección automática
silenciosa). El panel frontend (rev. 1.5) ya invalida el número y la
operación visible cuando detecta la anotación, mostrando "—" en lugar
del cálculo espurio. **El fix de normalización backend + panel frontend
ya estaba desplegado** (FEATURE-20260824-01 rev. 1.5 + IMPL-20260824-05
revisión posterior).

Este incremento:
1. Endurece la defensa existente consolidando los ACs del dictamen.
2. Promueve el prompt de extracción v5 → → **v6** con PROHIBICIONES
   ABSOLUTAS tempranas + VALIDACIÓN CRUZADA OBLIGATORIA explícitas.
3. Añade suite canónica de regresión: FEV1 40 ml canónico, FVC 30 ml
   no regresa, duplicación → marcado + invalidado.
4. Ejecuta script idempotente contra Railway para desplegar v6.

## Causa raíz

El LLM extractor (`MiniMax-M3` o `gemini-2.5-flash`) a veces emite
`m1=m2=2.11` (par absoluto) cuando la celda M1 está vacía en el PDF
vectorial Sibelmed. La fila "Mejor FEV1" del mismo reporte lleva
`m1=m2=m3=2.15`. La fórmula downstream `(m1 − m2) × 1000 = 0 ml` es un
**artefacto de la duplicación, no una repetibilidad real**.

Reglas que el extractor viola:
- **NO duplicar una celda en otra** (PROHIBICIÓN explícita).
- **NO usar la fila "Mejor X" como sustituto de la fila estándar X**
  (PROHIBICIÓN explícita).
- **Validación cruzada obligatoria** entre "Mejor X" y fila estándar X.

## Defensa existente (preservada)

### Backend — `_normalize_espirometria_result` (`backend/app/services/ai/extractor.py:602-702`)

Detección cruzada + anotación trazable SIN corrección automática:

```python
if mejor_max > std_max + 1e-9:
    # Síntoma de duplicación: m1==m2 (mismo par absoluto).
    token = f"SOSPECHA_INCONSISTENCIA_MEJOR_{display}"
    detail = (
        f"{token}: {display}: max(m1,m2,m3)={std_max} de la fila "
        f"estándar < Mejor {display}={mejor_max}. ..."
    )
    if duplicated:
        detail += " (m1==m2 detectado)."
    cross_warnings.append(detail)
```

Si la inconsistencia se detecta:
1. Anota `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`/`_FVC` en `notas_calidad`
   (raíz + bloque calidad).
2. Fuerza `completitud_documental = "no_concluyente"` (raíz + bloque
   calidad).
3. **NO rellena m1** (preserva el valor extraído, erróneo, sin
   corrección automática silenciosa — sólo anotación trazable).
4. El detalle incluye "(m1==m2 detectado)" como síntoma específico.

### Frontend — `EspirometriaClinicalCriteriaPanel` (`frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx:532-583`)

Rev. 1.5: cuando la anotación `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`/`_FVC`
está presente:

```typescript
const fvcMlFinal: number | null =
  fvcInconsistent && repetibilidadFvcSource === "computed"
    ? null
    : repetibilidadFvcMl
const fev1MlFinal: number | null =
  fev1Inconsistent && repetibilidadFev1Source === "computed"
    ? null
    : repetibilidadFev1Ml
const fvcTopTwoFinal: [number, number] | null =
  fvcInconsistent ? null : fvcCalc.topTwoNative
const fev1TopTwoFinal: [number, number] | null =
  fev1Inconsistent ? null : fev1Calc.topTwoNative
```

- `topTwoNative → null` → la línea de operación visible muestra "—"
  (NO `(2.11 − 2.11) × 1000 = 0 ml`).
- Si `repetibilidad*Source === "computed"` (sin valor extraído del texto
  nativo), invalida el número y el flag ≤150 → null. NO 0 ml.
- Si `repetibilidad*Source === "extracted"` (texto nativo del reporte),
  conserva el valor (fuente independiente) pero oculta la operación
  espuria.
- Inconsistencia selectiva: sólo el parámetro anotado se invalida
  (FEV1 afectado ⇒ FEV1 invalidado; FVC consistente ⇒ FVC intacto).

## Solución aplicada

### 1. Prompt de extracción v5 → v6

`frontend/scripts/update-espirometria-extraction-prompt.ts`:
- `EXTRACTION_VERSION`: `espirometria-sibelmed-v5` → → → **`espirometria-sibelmed-v6`**
- Apartado temprano "PROHIBICIONES ABSOLUTAS" (FIX-20260824-04) con
  reglas §8/§9 explícitas:
  - §8: NO duplicar celda (m1 ← m2/m3, m1_pct_ref ← m2_pct_ref/m3_pct_ref).
  - §9: NO usar "Mejor X" como fila estándar.
- Nuevo apartado "VALIDACIÓN CRUZADA OBLIGATORIA" (§10) con
  procedimiento paso a paso:
  - `mejor_fev1_max = mejor_fev1.m1`
  - `fev1_std_max = max(fev1.m1, fev1.m2, fev1.m3)`
  - Verifica `mejor_fev1_max <= fev1_std_max`; si NO, NO rellenar
    m1 desde "Mejor X" — transcribir literalmente. La normalización
    defensiva backend anotará `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` y
    forzará `completitud_documental = "no_concluyente"`.
- Ejemplo canónico explícito para que el LLM reconozca el patrón
  Sibelmed: FEV1 `m1=2.15, m1_pct_ref=77, m2=2.11, m2_pct_ref=76,
  m3=2.09, m3_pct_ref=75` y FVC `m1=2.30, m1_pct_ref=69, m2=2.33,
  m2_pct_ref=70, m3=2.26, m3_pct_ref=68`. Indica la operación esperada
  y el síntoma de duplicación: "(m1 − m2) × 1000 = 0 ml".
- Apartado tardío "PROHIBICIONES ABSOLUTAS" (1-10) preserva v5 +
  refuerza §9/§10 con la misma prohibición.

### 2. Suite canónica de regresión (FIX-20260824-04)

**Backend** — `backend/tests/test_ai_pipeline.py::TestFIX20260824_04RegresionFEV1_Cero`
(NUEVA, 6 tests):

- `test_ac1_canonical_fev1_repetibilidad_40ml`: FEV1 2.15/77, 2.11/76,
  2.09/75 → top-2 × 1000 = 40 ml. NO 0 ml. NO anotación de
  inconsistencia (layout coherente).
- `test_ac2_canonical_fvc_repetibilidad_30ml_no_regress`: FVC 2.30/69,
  2.33/70, 2.26/68 → 30 ml. NO regresa. NO anotación de FVC.
- `test_ac3_duplicacion_m1_eq_m2_marks_inconsistent`: FEV1 m1=m2=2.11,
  Mejor FEV1=2.15 → SOSPECHA_INCONSISTENCIA_MEJOR_FEV1 anotada,
  `completitud_documental = "no_concluyente"`, NO relleno de m1 (sigue
  2.11), detalle incluye "m1==m2 detectado".
- `test_ac4_guardrail_backend_declares_prohibiciones_y_consistencia`:
  guardrail cita "NO DUPLIQUES UNA CELDA", "NO uses la fila", y
  "CONSISTENCIA ENTRE".
- `test_ac5_frontend_pantalla_invalida_calculo_espurio`: anotación vive
  en ambos canales (raíz + calidad) — el panel frontend valida contra
  cualquiera.
- `test_ac6_backfill_feeds_root_but_row_stays_duplicated`: el backfill
  alimenta `fev1` raíz = 2.15 desde "Mejor FEV1" (correcto para
  gate/DR7), pero la fila FEV1 NO se corrige (m1 sigue 2.11 — valor
  extraído preservado). Defensa = anotación + no_concluyente.

**Frontend script v6** — `frontend/scripts/__tests__/update-espirometria-extraction-prompt.test.ts`
(56 tests, +18 nuevos para FIX-20260824-04):

- AC-1 a AC-8 (preservados de v5): visuales puros, null si curva no
  legible, etiquetado, repetibilidad numérica del panel, no inventar
  impresión/recomendaciones, aliases correctos, criterios explícitos,
  `repetibilidad_*_menor_150` siempre null.
- **AC-9** (NUEVO): apartado "PROHIBICIONES ABSOLUTAS" presente con
  FIX-20260824-04; prohíbe copiar m1 ← m2/m3; prohíbe copiar
  m1_pct_ref ← m2_pct_ref/m3_pct_ref; menciona síntoma "(m1 − m2)
  × 1000 = 0 ml".
- **AC-10** (NUEVO): prohíbe usar "Mejor FEV1"/"Mejor FVC" como fila
  estándar; explica "Mejor X" CONSOLIDA (m1=m2=m3); instruye null si
  fila estándar no visible.
- **AC-11** (NUEVO): apartado "VALIDACIÓN CRUZADA OBLIGATORIA"
  presente; define `mejor_fev1_max`, `fev1_std_max`, exige
  `mejor_fev1_max <= fev1_std_max`; instruye NO rellenar m1; referencia
  `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` y `completitud_documental =
  "no_concluyente"`.
- **AC-12** (NUEVO canónico): FEV1 m1=2.15/m1_pct_ref=77/m2=2.11/m2_pct_ref=76/m3=2.09/m3_pct_ref=75
  presente en el prompt; FVC m1=2.30/69/m2=2.33/70/m3=2.26/68 presente;
  %REF vive en columna inmediata a la derecha.

**Frontend panel** (rev. 1.5 ya existente, 5 tests):
- Caso canónico (sin anotación): FEV1 40 ml + operación visible
  `(2.15 − 2.11) × 1000`.
- Duplicación FEV1 (source=computed) → invalida número, operación y
  flag ≤150; FVC consistente intacto (30 ml).
- Duplicación FEV1 con `repetibilidad_fev1_ml` extraído del texto
  nativo → conserva 40, oculta operación espuria.
- Duplicación FVC → invalida selectivamente FVC; FEV1 intacto.
- Render: con duplicación FEV1, la operación FEV1 muestra "—"
  (NO `(2.11 − 2.11) × 1000 = 0 ml`).
- La anotación se busca en ambos canales (raíz + calidad).

## Validación ejecutada

### Typecheck

```
$ cd frontend && npx tsc --noEmit
exit=0

$ cd frontend && npx tsc -p scripts/tsconfig.json --noEmit
exit=0
```

### Vitest focal

```
$ cd frontend && npx vitest run scripts/__tests__ src/components/clinical/__tests__
Test Files  7 passed (7)
     Tests  177 passed (177)
   · scripts/__tests__/update-espirometria-prediagnosis-prompt.test.ts (24)
   · scripts/__tests__/update-espirometria-extraction-prompt.test.ts (56 — +18 nuevos FIX-20260824-04)
   · src/components/clinical/__tests__/ExamenMedicoEstudio.test.ts (7)
   · src/components/clinical/__tests__/ClinicalExtractionRenderer.fase5.test.ts (8)
   · src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts (65 — incluye rev. 1.5)
   · src/components/clinical/__tests__/StudyAIPrediagnosisPanel.open-details.test.ts (3)
   · src/components/clinical/__tests__/StudyAIPrediagnosisPanel.dec-20260824-02.test.ts (14)
```

### Pytest focal

```
$ cd backend && python3 -m pytest tests/test_ai_pipeline.py::TestFIX20260824_04RegresionFEV1_Cero -v
========================= 6 passed in 1.15s =========================
  ✓ test_ac1_canonical_fev1_repetibilidad_40ml
  ✓ test_ac2_canonical_fvc_repetibilidad_30ml_no_regress
  ✓ test_ac3_duplicacion_m1_eq_m2_marks_inconsistent
  ✓ test_ac4_guardrail_backend_declares_prohibiciones_y_consistencia
  ✓ test_ac5_frontend_pantalla_invalida_calculo_espurio
  ✓ test_ac6_backfill_feeds_root_but_row_stays_duplicated
```

Suite espirometría focal (64 pass, 4 pre-existing M3_CREDENTIALS_UNAVAILABLE
idénticos al baseline):

```
$ cd backend && python3 -m pytest tests/test_ai_pipeline.py -k "FIX20260824_04 or FEATURE20260824_01Rev14 or TestEspirometriaPrediagnostic or TestEspirometriaDiagnosis or TestIMPLFIX20260824_02 or Espirometria" --tb=no -q
4 failed, 64 passed
```

Las 4 fallas son pre-existentes `M3_CREDENTIALS_UNAVAILABLE` (sin
`M3_API_KEY` en test env) en `TestCalibrationV1AudioEspiro::test_espirometria_*`
y `TestEspirometriaExhaustiva_20260516_12_13::test_extraccion_espirometria_*`
— idénticas antes/después del incremento (verificado con `git stash`).

## Trazabilidad AC del dictamen → prueba/evidencia

| AC del dictamen FIX-20260824-04                              | Prueba focal V1                                      | Resultado |
|--------------------------------------------------------------|------------------------------------------------------|-----------|
| NO duplicar celda (m1 ← m2/m3)                               | pytest AC-3, AC-4, AC-6 + script AC-9               | PASS      |
| NO usar Mejor X como fila estándar                           | pytest AC-3, AC-4 + script AC-10                    | PASS      |
| Validación cruzada obligatoria                              | pytest AC-3, AC-6 + script AC-11                    | PASS      |
| Marcar SOSPECHA_INCONSISTENCIA_MEJOR_FEV1/_FVC               | pytest AC-3, AC-5, AC-6 + frontend rev. 1.5         | PASS      |
| calidad no_concluyente (forzado, no silencioso)              | pytest AC-3, AC-6 + frontend (rev. 1.5)             | PASS      |
| Frontend no muestra operación/resultado espurio              | pytest AC-5 + frontend rev. 1.5 (panel tests)       | PASS      |
| Conservar texto nativo si existe (`source=extracted`)        | frontend rev. 1.5 (panel test "extraído del texto") | PASS      |
| FEV1 canónico 2.15/77, 2.11/76, 2.09/75 → 40 ml              | pytest AC-1 + script AC-12                          | PASS      |
| FVC canónico 2.30/69, 2.33/70, 2.26/68 → 30 ml (no regresa)  | pytest AC-2 + script AC-12                          | PASS      |
| Duplicación m1=m2 → marcado + invalidado                     | pytest AC-3, AC-6 + frontend panel test             | PASS      |

## Versión remota

```
extraction.version = "espirometria-sibelmed-v6"   (FIX-20260824-04)
extraction.prompt  = (regenerado — PROHIBICIONES ABSOLUTAS + VALIDACIÓN CRUZADA)
diagnosis.version  = "espirometria-prediagnosis-v1"   (preservado, IMPL-20260824-06 rev. 1.1)
diagnosis.prompt   = (preservado, sin cambios)
```

## Comandos — ejecución contra Railway (ATLAS/Frank)

### 1. Pre-update — leer estado actual (read-only)

Si el operador tiene acceso a `psql`/`railway connect`:

```sql
SELECT
  options->'aiCalibration'->'extraction'->>'version' AS extraction_version,
  options->'aiCalibration'->'diagnosis'->>'version' AS diagnosis_version
FROM "MedicalTest"
WHERE name ILIKE 'ESPIROMETRIA'
LIMIT 1;
```

Salida esperada (pre-update):
```
extraction_version | diagnosis_version
-------------------+-------------------
espirometria-sibelmed-v5 | espirometria-prediagnosis-v1
```

### 2. Update — script idempotente

```bash
# Con DATABASE_URL de Railway (NO loguear ni commitear la URL):
cd frontend
DATABASE_URL='postgresql://<user>:<password>@<host>:<port>/<db>?sslmode=require' \
  npx tsx scripts/update-espirometria-extraction-prompt.ts
```

Salida esperada (primer run):

```
=== IMPL-FIX-20260824-04 (FIX-20260824-04 — Espirometría extraction prompt v6) ===

Encontrado: "ESPIROMETRIA" (ID: <uuid>)
ext> extraction.version preservado:               espirometria-sibelmed-v5 (cambia a v6)
ext> extraction.prompt chars preservado:          <chars>
...
✓ Prompt de extracción de Espirometría actualizado correctamente.
   → medical_test.id:        <uuid>
   → extraction.version:     espirometria-sibelmed-v6
   → extraction.prompt size: <chars>
```

Salida esperada (segundo run, idempotente):

```
=== IMPL-FIX-20260824-04 (FIX-20260824-04 — Espirometría extraction prompt v6) ===

Encontrado: "ESPIROMETRIA" (ID: <uuid>)
ℹ️  aiCalibration.extraction.version ya es espirometria-sibelmed-v6. No se realizan cambios (idempotente).
```

### 3. Post-update — verificar

Repetir el SELECT inicial; debe devolver:

```
extraction_version | diagnosis_version
-------------------+-------------------
espirometria-sibelmed-v6 | espirometria-prediagnosis-v1
```

### 4. Reprocesar el Event actual

Subir de nuevo `context/RD2026/ESPIROMETRIA.pdf` en Events para que el
nuevo snapshot se genere con el prompt v6. Verificar que el panel
"Criterios clínicos de Espirometría" muestre:

- **Repetibilidad FEV1**: 40 ml con operación `(2.15 − 2.11) × 1000 = 40 ml`.
- **Repetibilidad FVC**: 30 ml con operación `(2.33 − 2.30) × 1000 = 30 ml`.
- Si la extracción aún produce m1=m2 (prompt degradado por el LLM),
  `notas_calidad` debe contener `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` y
  `completitud_documental = "no_concluyente"`. El panel mostrará "—"
  en lugar de 0 ml.

## Archivos modificados / creados (sin commit/push)

```
frontend/scripts/update-espirometria-extraction-prompt.ts                              | M (v5 → v6 con PROHIBICIONES + VALIDACIÓN CRUZADA)
frontend/scripts/__tests__/update-espirometria-extraction-prompt.test.ts               | M (+18 tests AC-9/10/11/12)
backend/tests/test_ai_pipeline.py                                                      | M (+TestFIX20260824_04RegresionFEV1_Cero con 6 tests)
```

Sin cambios en:
- `backend/app/services/ai/extractor.py` (la defensa rev. 1.5 ya está
  implementada y validada — sin corrección nueva).
- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx`
  (la invalidación rev. 1.5 ya está implementada).
- `prisma/schema.prisma` / migraciones (0 cambios).
- `discovery/`, `SPEC/`, `ADR/`, `PROYECTO.md` (0 cambios — FIX-20260824-04
  es un dictamen interno sobre la regresión, no una nueva decisión).
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx` (sin cambios).

## Pendientes ATLAS / Frank

1. **Ejecutar el script contra Railway** con la DATABASE_URL vigente
   (paso 2). Reportar salida al equipo.
2. **Reprocesar el Event RD2026** (paso 4) y verificar que el panel
   muestre 40 ml / 30 ml correctos.
3. Decidir si GEMINI audita la promoción del prompt a v6 + ACs del
   dictamen (recomendable — cambio soft de contrato, prompt remoto
   desplegado en Railway).
4. CRONISTA aplica transición cuando ATLAS confirme verificación.
5. Autorización Frank para commit/push cuando ATLAS lo autorice.

## Reversibilidad

100% — el script es idempotente y reversible: `git checkout` de los 2
modificados + (sin nuevos archivos). Sin migración Prisma, sin cambios
en BD hasta que ATLAS ejecute el script contra Railway. El prompt v6
también es revertible vía re-run con `EXTRACTION_VERSION='espirometria-sibelmed-v5'`
(si se necesitara, aunque no aplica).

## Estado final

**READY_FOR_VERIFYING** — incremento único, presupuesto dentro del
objetivo (≤6 sesiones / ≤300 tool calls), V1 dirigida por corte, V2
focal completa al cierre, sin V3 independiente (no aplica GEMINI/Playwright
desde SOFIA — decisión de ATLAS).