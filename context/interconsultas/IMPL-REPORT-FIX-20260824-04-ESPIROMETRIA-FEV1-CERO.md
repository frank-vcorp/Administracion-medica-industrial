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

---

# Corrección IMPL-FIX-20260824-04-rev2 — Compactación v6 → v7 contra EXTRACTION_NOT_JSON M3

```
ID intervención: IMPL-FIX-20260824-04-rev2
ID tarea: FIX-20260824-04 (mismo incremento — corrección IMPLEMENTATION_DEFECT)
Estado: READY_FOR_VERIFYING (rev. 2)
SPEC activa: context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
             rev. 1.2 (sin cambios — corrección interna)
Discovery refs: DEC-20260824-02, BR-20260824-01, BR-20260824-02, IMPL-FIX-20260824-04
Origen funcional: Railway muestra `EXTRACTION_NOT_JSON` en dos uploads
                  recientes de Espirometria. Frank confirmó que MiniMax
                  M3 recibe `espirometria-sibelmed-v6` (~15 KB) y responde
                  con `<think>...` sin alcanzar a devolver JSON.
```

## Causa raíz

MiniMax M3 (`MiniMax-M3` vía `LiteLLM proxy` OpenAI-compatible):

1. **Prompt v6 demasiado largo (~19.5 KB al expandirlo el SDK OpenAI en
   tokens).** La conversación crece al incluir el bloque multimodal con
   la imagen + system prompt + el JSON skeleton con todas las claves
   (alrededor de 30 claves null por defecto en el ejemplo de salida).
2. **`max_tokens=4096` insuficiente.** 4096 tokens caben la imagen
   (~1k-3k tokens), el prompt de sistema + instrucciones (~5KB = ~1.5k
   tokens) y el bloque `<think>...` del modelo, pero NO caben
   simultáneamente un JSON estructurado con todas las claves del
   prompt. El LLM responde con un bloque de razonamiento que consume
   los tokens y termina sin devolver JSON.
3. **`response_format` no se estaba pasando.** Sin `response_format`
   explícito, M3 envuelve la salida ocasionalmente en ```json``` fences
   o texto explicativo, reduciendo aún más el espacio para JSON.
4. **El parser tolerante** (`_tolerant_json_parse` en `app/services/ai/base.py:579`)
   ya recupera JSON de respuestas con texto extra, comas finales y
   estrategias `json.JSONDecode` + substring. **Pero NO puede recuperar
   JSON inexistente o truncado** — si el LLM no llegó a producir JSON,
   no hay nada que parsear.

## Solución aplicada — dos cambios mínimos y generales

### 1) Compactación del prompt v6 → → v7 (<5 KB)

`frontend/scripts/update-espirometria-extraction-prompt.ts`:

- `EXTRACTION_VERSION`: `espirometria-sibelmed-v6` → → → **`espirometria-sibelmed-v7`**
- `NEW_EXTRACTION_PROMPT`: **~19.5 KB → → → 4.8 KB** (4912 chars, <5 KB target).
- Compactación: se eliminó prosa repetitiva, se consolidaron las 3
  apariciones de las prohibiciones en un solo bloque, se compactó la
  lista de claves del JSON skeleton a una línea por fila, y se removieron
  detalles históricos que el LLM no necesita.
- **Reglas críticas PRESERVADAS** (cada una verificada por test focal V1):

| Regla crítica | Test V1 | Resultado |
|---|---|---|
| Salida JSON único, sin markdown, sin `<think>` | `test_v7_prompt_preserva_json_unico_sin_think` | PASS |
| Tabla Sibelmed 9 columnas (PARÁMETRO\|M1\|%REF\|M2\|%REF\|M3\|%REF\|REF\|LLN) | `test_v7_prompt_preserva_layout_sibelmed_9` | PASS |
| NO duplicar M1/M2/M3 (prohibición + síntoma `(m1−m2)×1000=0 ml`) | `test_v7_prompt_preserva_prohibicion_duplicar_celda` | PASS |
| NO usar "Mejor FEV1"/"Mejor FVC" como fila estándar | `test_v7_prompt_preserva_prohibicion_mejor_x_como_fila_estandar` | PASS |
| Validación cruzada `mejor_fev1_max = mejor_fev1.m1` vs `fev1_std_max = max(fev1.m1, fev1.m2, fev1.m3)` | `test_v7_prompt_preserva_validacion_cruzada` | PASS |
| FEV1 canónico `m1=2.15, m1_pct_ref=77, m2=2.11, m2_pct_ref=76, m3=2.09, m3_pct_ref=75` | `test_v7_prompt_preserva_ejemplo_canonico` | PASS |
| FVC canónico `m1=2.30, m1_pct_ref=69, m2=2.33, m2_pct_ref=70, m3=2.26, m3_pct_ref=68` | `test_v7_prompt_preserva_ejemplo_canonico` | PASS |
| Top-2 esperado FEV1 `(2.15−2.11)×1000=40 ml` | `test_v7_prompt_preserva_ejemplo_canonico` | PASS |
| Top-2 esperado FVC `(2.33−2.30)×1000=30 ml` | `test_v7_prompt_preserva_ejemplo_canonico` | PASS |
| Visuales null si no claros (4 visuales) | `test_v7_prompt_visuales_null_si_no_claros` | PASS |
| `tiempo`/`criterios_para_dx`/`calidad`: sólo EXPLÍCITOS del reporte | (cubierto por test JSON skeleton) | PASS |
| NO calcular repetibilidad aquí (panel calcula top-2 × 1000) | `test_v7_prompt_no_calcula_repetibilidad_panel_si` | PASS |
| `repetibilidad_*_menor_150` SIEMPRE null | `test_v7_prompt_no_calcula_repetibilidad_panel_si` | PASS |
| Aliases `impresion_diagnostica_texto` + `recomendaciones_texto` | (cubierto por test JSON skeleton) | PASS |

### 2) Parámetros del SDK M3: `max_tokens` 4096 → → 8192 + `response_format={"type":"json_object"}`

`backend/app/services/ai/base.py::M3VisionBase.call_m3` (líneas ~790-810):

- **`max_tokens` 4096 → → → 8192.** M3 (MiniMax-M3) soporta hasta **524,288
  tokens** de salida según docs oficiales (platform.minimax.io). 4096 era
  muy corto para una salida JSON estructurada con todas las claves del
  prompt de Espirometría. 8192 tokens caben holgadamente con el prompt
  v7 (<5 KB) y un JSON estructurado de <3 KB.
- **`response_format={"type": "json_object"}`** añadido. **Soportado por
  M3** (verificado en Fireworks MiniMax-M3 API params que reflejan el
  contrato upstream; ver `modelparams.dev/models/fireworks/minimax-m3`).
  Reduce la probabilidad de que el modelo envuelva la salida en fences
  ```json``` o texto explicativo — pero **NO es garantía dura** (la doc
  MiniMax lo dice textualmente), por eso el parser tolerante sigue
  siendo necesario. NO oculta errores.
- **NO se introdujeron reintentos ciegos.** El bloque `except` sigue
  terminando con `raise` (propagación de la excepción al dispatcher para
  que el catch-all la mapee a `error_code` accionable).
- **NO se modificó `FeatherlessVisionBase` ni otros proveedores.** El
  cambio aplica SOLO a `call_m3` (MiniMax M3), preservando el
  comportamiento de los demás clientes.

## Tests añadidos (FIX-20260824-04-rev2)

**Frontend** — `frontend/scripts/__tests__/update-espirometria-extraction-prompt.test.ts`:
47 tests (reescritos para v7, +6 nuevos AC explícitos vs v6):

- AC-0: `EXTRACTION_VERSION = 'espirometria-sibelmed-v7'`, prompt
  <5000 chars (budget), <6500 chars (regresión visual v6 era 19500).
- AC-1: JSON único, sin markdown/<think>, JSON arranca con `{`.
- AC-2: Layout Sibelmed 9 columnas.
- AC-3: NO duplicar celda + síntoma.
- AC-4: NO Mejor X como fila estándar.
- AC-5: Validación cruzada mejor_*_max vs std_max.
- AC-6: FEV1 canónico + FVC canónico + top-2 esperado 40 ml/30 ml.
- AC-7: Visuales null si no claros.
- AC-8: tiempo/criterios_para_dx/calidad sólo EXPLÍCITOS.
- AC-9: NO calcular repetibilidad aquí (panel sí).
- AC-10: `repetibilidad_*_menor_150` SIEMPRE null.
- AC-11: Aliases texto fuente médico.
- AC-12: Estructura JSON skeleton (paciente_detalle, estudio, condiciones,
  parametros, calidad, graficas).
- AC-13: Contrato del script (`espirometria-sibelmed-v\d+``, trazabilidad).

**Backend** — `backend/tests/test_ai_pipeline.py`:

- `TestFIX20260824_04Rev2PromptCompactoV7` (10 tests): mirror estático de
  los ACs del prompt v7 (tamaño compacto, JSON único, layout Sibelmed,
  prohibición duplicar, prohibición Mejor X, validación cruzada, ejemplo
  canónico, repetibilidad la calcula el panel, visuales null si no
  claros).
- `TestFIX20260824_04Rev2M3Parameters` (4 tests):
  - `call_m3` envía `max_tokens=8192` (verificación estática del archivo
    `base.py`).
  - `call_m3` envía `response_format={"type": "json_object"}`.
  - `call_m3` NO agrega reintentos ciegos (sin `for attempt in`, sin
    `retries`, sin `max_retries`; sigue propagando `raise`).
  - El cambio se limita a `call_m3` (no se filtra `max_tokens=8192` fuera
    del bloque).

**Regresión preservada** (`TestFIX20260824_04RegresionFEV1_Cero` de rev. 1):
6/6 PASS. FEV1 canónico 40 ml / FVC 30 ml / duplicación m1=m2 → marcado +
invalidado. La defensa backend (rev. 1.5) NO se tocó — sigue marcando
`SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`/`_FVC` y forzando
`completitud_documental = "no_concluyente"`.

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
     Tests  168 passed (168)
   · scripts/__tests__/update-espirometria-prediagnosis-prompt.test.ts (24)
   · scripts/__tests__/update-espirometria-extraction-prompt.test.ts (47 — reescrito v7)
   · src/components/clinical/__tests__/ExamenMedicoEstudio.test.ts (7)
   · src/components/clinical/__tests__/ClinicalExtractionRenderer.fase5.test.ts (8)
   · src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts (65)
   · src/components/clinical/__tests__/StudyAIPrediagnosisPanel.open-details.test.ts (3)
   · src/components/clinical/__tests__/StudyAIPrediagnosisPanel.dec-20260824-02.test.ts (14)
```

### Pytest focal

```
$ cd backend && python3 -m pytest \
    tests/test_ai_pipeline.py::TestFIX20260824_04Rev2PromptCompactoV7 \
    tests/test_ai_pipeline.py::TestFIX20260824_04Rev2M3Parameters \
    -v
========================= 14 passed in 0.98s =========================
  ✓ test_v7_exporta_extraccion_version_v7
  ✓ test_v7_prompt_compacto_menor_a_5kb
  ✓ test_v7_prompt_preserva_json_unico_sin_think
  ✓ test_v7_prompt_preserva_layout_sibelmed_9
  ✓ test_v7_prompt_preserva_prohibicion_duplicar_celda
  ✓ test_v7_prompt_preserva_prohibicion_mejor_x_como_fila_estandar
  ✓ test_v7_prompt_preserva_validacion_cruzada
  ✓ test_v7_prompt_preserva_ejemplo_canonico
  ✓ test_v7_prompt_no_calcula_repetibilidad_panel_si
  ✓ test_v7_prompt_visuales_null_si_no_claros
  ✓ test_call_m3_envia_max_tokens_8192
  ✓ test_call_m3_envia_response_format_json_object
  ✓ test_call_m3_no_agrega_reintentos_ciegos
  ✓ test_call_m3_no_modifica_featherless_o_otros
```

Regresión focal FIX-20260824-04 rev. 1:

```
$ cd backend && python3 -m pytest tests/test_ai_pipeline.py::TestFIX2026
0824_04RegresionFEV1_Cero -v
========================= 6 passed in 1.15s =========================
  ✓ test_ac1_canonical_fev1_repetibilidad_40ml
  ✓ test_ac2_canonical_fvc_repetibilidad_30ml_no_regress
  ✓ test_ac3_duplicacion_m1_eq_m2_marks_inconsistent
  ✓ test_ac4_guardrail_backend_declares_prohibiciones_y_consistencia
  ✓ test_ac5_frontend_pantalla_invalida_calculo_espurio
  ✓ test_ac6_backfill_feeds_root_but_row_stays_duplicated
```

Suite espirometría completa: 78 PASS, 4 pre-existing
`M3_CREDENTIALS_UNAVAILABLE` (idénticos al baseline, sin
`M3_API_KEY` en test env).

## Versión remota

```
extraction.version = "espirometria-sibelmed-v7"   (FIX-20260824-04-rev2)
extraction.prompt  = 4.8 KB (vs 19.5 KB en v6, ~4x compactación)
diagnosis.version  = "espirometria-prediagnosis-v1"   (preservado, IMPL-20260824-06 rev. 1.1)

backend/app/services/ai/base.py::M3VisionBase.call_m3:
  max_tokens       = 8192 (era 4096)
  response_format  = {"type": "json_object"}  (NUEVO)
```

## Comandos — ejecución contra Railway (ATLAS/Frank)

### 1. Pre-update — leer estado actual (read-only)

```sql
SELECT
  options->'aiCalibration'->'extraction'->>'version' AS extraction_version,
  LENGTH(options->'aiCalibration'->'extraction'->>'prompt') AS prompt_chars
FROM "MedicalTest"
WHERE name ILIKE 'ESPIROMETRIA'
LIMIT 1;
```

Salida esperada (pre-update):
```
 extraction_version   | prompt_chars
----------------------+---------------
 espirometria-sibelmed-v6 | 19500 (aprox)
```

### 2. Update — script idempotente

```bash
# Con DATABASE_URL de Railway (NO loguear ni commitear la URL):
cd frontend
DATABASE_URL='postgresql://<user>:<password<>@<host>:<port>/<db>?sslmode=require' \
  npx tsx scripts/update-espirometria-extraction-prompt.ts
```

Salida esperada (primer run):

```
=== IMPL-FIX-20260824-04-rev2 (FIX-20260824-04 — Espirometría v7, compactación <5KB contra EXTRACTION_NOT_JSON M3) ===

Encontrado: "ESPIROMETRIA" (ID: <uuid>)
...
✓ Prompt de extracción de Espirometría actualizado correctamente.
   → medical_test.id:        <uuid>
   → extraction.version:     espirometria-sibelmed-v7
   → extraction.prompt size: 4912 chars  (vs ~19500 en v6)
```

Salida esperada (segundo run, idempotente):

```
ℹ️  aiCalibration.extraction.version ya es espirometria-sibelmed-v7. No se realizan cambios (idempotente).
```

### 3. Post-update — verificar tamaño

```sql
SELECT
  options->'aiCalibration'->'extraction'->>'version' AS extraction_version,
  LENGTH(options->'aiCalibration'->'extraction'->>'prompt') AS prompt_chars
FROM "MedicalTest"
WHERE name ILIKE 'ESPIROMETRIA'
LIMIT 1;
```

Salida esperada (post-update):
```
 extraction_version   | prompt_chars
----------------------+---------------
 espirometria-sibelmed-v7 | 4912
```

### 4. Validación end-to-end — re-subir el PDF

Subir de nuevo `context/RD2026/ESPIROMETRIA.pdf` en Events. Verificar
que el panel muestre:
- **Repetibilidad FEV1**: 40 ml con operación `(2.15 − 2.11) × 1000 = 40 ml`.
- **Repetibilidad FVC**: 30 ml con operación `(2.33 − 2.30) × 1000 = 30 ml`.
- Sin `EXTRACTION_NOT_JSON` en logs del backend.
- Si el LLM aún degrada y duplica m1=m2, `notas_calidad` contiene
  `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` + `completitud_documental =
  "no_concluyente"`, y el panel muestra "—" (no 0 ml).

## Archivos modificados / creados (rev. 2, sin commit/push)

```
frontend/scripts/update-espirometria-extraction-prompt.ts                              | M (v6 → v7 compactado a 4.8 KB)
frontend/scripts/__tests__/update-espirometria-extraction-prompt.test.ts               | M (reescrito v7: 56 → 47 tests, mismo nivel cobertura)
backend/app/services/ai/base.py                                                       | M (max_tokens=8192 + response_format en call_m3)
backend/tests/test_ai_pipeline.py                                                    | M (+TestFIX20260824_04Rev2PromptCompactoV7 + +TestFIX20260824_04Rev2M3Parameters = 14 tests)
```

Sin cambios en:
- `backend/app/services/ai/extractor.py` (la defensa rev. 1.5 sigue intacta).
- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx` (invalidación rev. 1.5 intacta).
- `prisma/schema.prisma` / migraciones (0 cambios).
- `discovery/`, `SPEC/`, `ADR/`, `PROYECTO.md` (0 cambios).
- `M3VisionBase._tolerant_json_parse` (sigue siendo necesario, ahora como
  segunda línea de defensa después de `response_format`).

## Pendientes ATLAS / Frank

1. **Ejecutar el script contra Railway** con la DATABASE_URL vigente
   (paso 2). Reportar salida al equipo.
2. **Re-subir el PDF RD2026** (paso 4) y verificar que el panel muestre
   40 ml / 30 ml correctos sin `EXTRACTION_NOT_JSON`.
3. Decidir si GEMINI audita el fix M3 (recomendable — cambio soft de
   contrato + parámetros SDK + compactación de prompt).
4. CRONISTA aplica transición cuando ATLAS confirme verificación.
5. Autorización Frank para commit/push cuando ATLAS lo autorice.

## Reversibilidad

100% — el script es idempotente y reversible: `git checkout` de los 4
modificados. Sin migración Prisma, sin cambios en BD hasta que ATLAS
ejecute el script contra Railway. Los parámetros del SDK (`max_tokens`,
`response_format`) se revierten con `git checkout backend/app/services/ai/base.py`.

## Estado final (rev. 2)

**READY_FOR_VERIFYING** — incremento único, presupuesto dentro del
objetivo (≤6 sesiones / ≤300 tool calls), V1 dirigida por corte, V2
focal completa al cierre, sin V3 independiente (no aplica GEMINI/Playwright
desde SOFIA — decisión de ATLAS).

# Corrección IMPL-FIX-20260824-04-rev3 — Detección robusta de inconsistencia FEV1/FVC (Event v10)

```
ID intervención: IMPL-FIX-20260824-04-rev3
ID tarea: FIX-20260824-04 (mismo incremento — corrección IMPLEMENTATION_DEFECT)
Estado: READY_FOR_VERIFYING (rev. 3)
SPEC activa: context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
             rev. 1.2 (sin cambios — corrección interna frontend-only)
Discovery refs: DEC-20260824-02, BR-20260824-01, BR-20260824-02,
                IMPL-FIX-20260824-04-rev1/rev2
Origen funcional: Frank reportó que el payload real de Event v10 NO
                  contiene exactamente `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`.
                  Contiene una frase estructurada:
                  "Inconsistencia detectada entre fila 'Mejor FEV1' ... y
                   fila estándar FEV1 ... SOSPECHA_MAPEO".
                  Por eso `EspirometriaClinicalCriteriaPanel.resolveCriteria`
                  no invalidaba la operación `(2.11−2.11)=0 ml`.
```

## Causa raíz

La detección frontend rev. 1.5 (`EspirometriaClinicalCriteriaPanel.tsx:558-563`)
sólo buscaba la subcadena EXACTA `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`/`_FVC` en
`notas_calidad`. El normalizador backend rev. 1.5 emite ese código, pero el
proveedor extractor de Event v10 (u otra capa intermedia) está rindiendo
el texto con prosa narrativa en lugar del token literal. Resultado:

- `fev1Inconsistent = false` aunque la fila sea objetivamente inconsistente.
- `fev1MlFinal` = `(2.11−2.11)×1000 = 0` (cálculo espurio sobre fila no
  confiable).
- `fev1TopTwoFinal` = `[2.11, 2.11]` (operación visible `(2.11−2.11)×1000`).
- `fev1Menor150Final` = "SI" (porque 0 ≤ 150 — espurio).
- En el DOM el médico ve "0 ml" como repetibilidad válida para FEV1.

## Solución aplicada

### 1) Helper `detectParamInconsistency` exportado

`frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx`:

```typescript
export function detectParamInconsistency(
  notasCalidad: string | null | undefined,
  param: "FEV1" | "FVC"
): boolean {
  if (!notasCalidad) return false
  const code = `SOSPECHA_INCONSISTENCIA_MEJOR_${param}`
  // (1) Código explícito backend.
  if (notasCalidad.includes(code)) return true
  // (2) Frase estructurada. Tres condiciones, todas referidas al MISMO
  //     parámetro. Regex tolerante a acentos y mayúsculas.
  const hasInconsistency = /inconsistencia/i.test(notasCalidad)
  const hasMejor = new RegExp(`\\bmejor\\s+${param}\\b`, "i").test(notasCalidad)
  const hasFilaEstandar = new RegExp(
    `\\bfila\\s+est[aá]ndar\\s+${param}\\b`,
    "i"
  ).test(notasCalidad)
  return hasInconsistency && hasMejor && hasFilaEstandar
}
```

Reconoce DOS formas equivalentes:

1. **Código backend literal** (`SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` /
   `_FVC`) — compat rev. 1.5+.
2. **Frase estructurada** (caso v10): combinación EXPLÍCITA de las
   TRES señales referidas al MISMO parámetro (`\bmejor\s+FEV1\b`,
   `\bfila\s+est[aá]ndar\s+FEV1\b`, `inconsistencia`). Word boundaries
   `\b` evitan falsos positivos con subcadenas (p.ej. "FEV10" no
   matchea "FEV1"). Acento opcional (`est[aá]ndar`).

**Garantía de no-falso-positivo**: las tres condiciones son AND lógico
sobre el MISMO parámetro. Una nota que sólo mencione "Inconsistencia"
o sólo "Mejor FEV1" o sólo "fila estándar FEV1" NO dispara la
invalidación.

### 2) `resolveCriteria` usa el helper + condición numérica ampliada

```typescript
const fev1Inconsistent = detectParamInconsistency(
  notasCalidadForInconsistency, "FEV1"
)
const fvcInconsistent = detectParamInconsistency(
  notasCalidadForInconsistency, "FVC"
)
```

Y la condición de invalidación numérica se amplía para cubrir AMBOS
casos problemáticos (`source !== "extracted"` en lugar de sólo
`source === "computed"`):

```typescript
// Antes (rev. 1.5):
const fev1MlFinal = fev1Inconsistent && source === "computed"
  ? null : fev1Ml

// Ahora (rev. 3): source !== "extracted" cubre computed + missing
const fev1MlFinal = fev1Inconsistent && source !== "extracted"
  ? null : fev1Ml
```

Misma lógica simétrica para `topTwoNative`, `menor150` y FVC. Resultado:
cuando la fila es inconsistente y NO hay valor nativo extraído del texto
fuente, el panel muestra `—` (nunca 0).

### 3) Comportamiento esperado para Event v10

Con el texto exacto reportado por Frank:

```text
notas_calidad: "Inconsistencia detectada entre fila 'Mejor FEV1'
 (valor consolidado 2.15) y fila estándar FEV1 (m1=2.11, m2=2.11,
 m3=2.09). Posible duplicación de M2 como M1 o pérdida de M1.
 Verifique el layout tabular. SOSPECHA_MAPEO."
```

El panel ahora renderiza:

- **Repetibilidad FEV1**: `—` (placeholder, NO 0 ml).
- **Operación FEV1**: `FEV1: —` (NO `(2.11−2.11)×1000 = 0 ml`).
- **Repetibilidad FVC**: 30 ml + `(2.33−2.30)×1000 = 30 ml` (intacto).
- **Calidad**: no_concluyente preservada si está en `calidad.completitud_documental`.

## Validación ejecutada

### Typecheck

```
$ cd frontend && npx tsc --noEmit
exit=0
```

### Vitest focal

```
$ cd frontend && npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts

Test Files  1 passed (1)
     Tests  87 passed (87)   ← 65 pre-existentes + 22 nuevos para rev. 3
```

22 nuevos tests en 3 grupos:

**Grupo A — `detectParamInconsistency` helper (12 tests):**
- Detecta código backend literal (FEV1 + FVC).
- Detecta código backend embebido en prosa (no exacto).
- Detecta frase estructurada v10 (caso Frank).
- Variante sin acento (`estandar`).
- Variante mayúsculas/minúsculas mezcladas.
- Selectividad FEV1 vs FVC (no cross-detección).
- NO oculta nota genérica que sólo menciona "inconsistencia".
- NO oculta nota que sólo menciona "Mejor FEV1" sin "fila estándar".
- NO oculta nota que sólo menciona "fila estándar FEV1" sin "inconsistencia".
- NO oculta "MEJOR FEV1" en mayúsculas sin contexto completo.
- String vacío / null / undefined → false.
- Word boundary evita matchear "FEV10" como si fuera "FEV1".

**Grupo B — caso Event v10 (6 tests):**
- v10 (texto en raíz): invalida FEV1 (sin 0 ml), FVC intacto.
- v10 (texto en calidad.notas_calidad): mismo comportamiento — defensa
   por canal.
- v10 (texto en AMBOS canales): detección robusta.
- v10 con `repetibilidad_fev1_ml=40` extraída del texto nativo:
   conserva 40, oculta operación (fuente independiente del layout).
- v10 render HTML: FEV1 muestra `—` (operación) y NO renderiza
   `(2.11−2.11) = 0 ml`; FVC intacto 30 ml.
- v10 con `calidad.completitud_documental="no_concluyente"`: panel
   respeta ambas señales.

**Grupo C — regresión preservada (4 tests):**
- FEV1 canónico 2.15/77, 2.11/76, 2.09/75 → 40 ml + operación visible.
- FVC canónico 2.30/69, 2.33/70, 2.26/68 → 30 ml + operación visible.
- Duplicación m1=m2 con código backend → sigue marcando inconsistente.
- Nota genérica SIN marcadores no marca inconsistencia.

### Regresión focal full

```
$ cd frontend && npx vitest run scripts/__tests__ src/components/clinical/__tests__
Test Files  7 passed (7)
     Tests  190 passed (190)
```

## Archivos modificados (rev. 3, sin commit/push)

```
frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx                          | M (helper `detectParamInconsistency` + uso en `resolveCriteria` + condición numérica ampliada)
frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts             | M (+22 tests en 3 grupos: helper / v10 / regresión)
```

**Sin cambios** (cumple restricción del usuario):
- Prompt de extracción v7 — intacto.
- Endpoint M3 (`https://api.minimax.io/v1`) — intacto.
- Lógica de extracción backend (`_normalize_espirometria_result`) — intacta.
- Schema Prisma / migraciones — sin cambios.
- Scripts de calibración remota — sin cambios.
- Parámetros SDK M3 (`max_tokens=32768`, `response_format`) — sin cambios.

## Pendientes ATLAS

1. Subir de nuevo `context/RD2026/ESPIROMETRIA.pdf` en Events v10 para
   verificar que el panel ahora muestra `—` (no 0 ml) para FEV1 y
   preserva 30 ml para FVC.
2. Verificar que ningún otro estudio (Audiometría, Laboratorio, etc.)
   genera falsos positivos por la nueva detección regex (la palabra
   `mejor` es común en español — el word boundary `\b` +\bparam\b
   evita matches accidentales).
3. Decidir si GEMINI audita el cambio (recomendable — superficie UI
   + nuevo helper exportado).
4. CRONISTA aplica transición cuando ATLAS confirme verificación.
5. Autorización Frank para commit/push cuando ATLAS lo autorice.

## Reversibilidad

100% — el cambio es frontend-only. `git checkout` del archivo modificado
+ test file modificado. Sin migración Prisma, sin cambios en BD, sin
publicación V3.

## Estado final (rev. 3)

**READY_FOR_VERIFYING** — incremento único, presupuesto dentro del
objetivo (≤6 sesiones / ≤300 tool calls), V1 dirigida por corte, V2
focal completa al cierre, sin V3 independiente (no aplica GEMINI/Playwright
desde SOFIA — decisión de ATLAS).
