# IMPL-REPORT — FEATURE-20260824-01 (rev. 1.3 — IMPLEMENTATION_DEFECT)

- **ID intervención:** `IMPL-20260824-01` (rev. 1.3 — IMPLEMENTATION_DEFECT dentro de la misma SPEC y sesión)
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md` rev. 1.2
- **Regla:** `BR-20260824-01` — umbral AMI de repetibilidad ≤150 ml
- **Estado:** `READY_FOR_VERIFYING`
- **Origen del delta:** usuario volvió a probar el Event tras commit `740229e`; el panel mostró `—` para FVC/FEV1/#Pruebas/Sí/No aunque la tabla clínica sí mostraba los valores porcentuales. Causa raíz: el panel buscaba filas exactas `key === "fvc_l"`/`"fev1_l"` y campos `m1`/`m2`/`m3`/`unidad`, pero el renderer/schema real (`extraction-presentation-schemas.ts`) usa aliases `m1_value`/`m2_value`/`m3_value`/`unit`/`ref_value`/`lln_value`, y el extractor puede entregar labels/claves no canónicas.

## Corrección

### rev. 1.2 (base)

La evidencia visual mostró que Events sólo presentaba notas de calidad. El panel ahora recibe `extractedData` completo y calcula desde `parametros[]`:

- Diferencia entre los dos valores FVC más altos, en ml.
- Diferencia entre los dos valores FEV1 más altos, en ml.
- Cumplimiento si la diferencia es **≤150 ml (0.15 L)**.
- Número de maniobras válidas disponibles.

Para `context/RD2026/ESPIROMETRIA.pdf` los resultados son:

- FVC: **30.00 ml**.
- FEV1: **40.00 ml**.
- Ambos cumplen el umbral AMI.
- Pruebas aceptables: **3**.

Los criterios cualitativos sólo se muestran cuando el payload los proporciona; no se infieren desde la tabla numérica.

### rev. 1.3 (IMPLEMENTATION_DEFECT — sin ampliar alcance)

Cierra los huecos que mostraban `—` cuando el payload real no usa la forma exacta del extractor:

1. **Resolución de filas FVC/FEV1 robusta** — `findRowByKey(parametros, canonicalKey, normalizedLabel)`:
   - (a) Intenta clave canónica `fvc_l`/`fev1_l` exacta (case-insensitive), **excluyendo** filas `Mejor FVC`/`Mejor FEV1` (por `label` que empieza con `mejor` o por `key` que empieza con `mejor_`). La fila canónica estándar es la fuente primaria para top-2 entre M1/M2/M3.
   - (b) Si no hay match por clave, fallback por `label` normalizado (`FVC`/`FEV1`), también excluyendo `Mejor X`.
   - (c) Último recurso (defensa): fila con clave canónica aunque sea `Mejor X` (caso raro en que el extractor sólo entregue la fila resumen).
2. **Aliases de maniobras** — `collectManeuverValues` lee cada maniobra desde `m1`/`m2`/`m3` (extractor) **y** `m1_value`/`m2_value`/`m3_value` (renderer/schema), con precedencia del alias corto (`m1`) si ambos están presentes (consistente con el resto del backend). Mezcla defensiva soportada.
3. **Aliases de unidad** — `readRowUnit` lee desde `unidad` (extractor) **o** `unit` (renderer/schema), case-insensitive. Acepta `L` y `l`.
4. **Top-2 y umbral AMI ≤150 ml** preservados idénticos al rev. 1.2 (BR-20260824-01).
5. **Extras extraídos siguen ganando sobre cálculo** — `calidad.repetibilidad_fvc_ml`/`fev1_ml` y `calidad.repetibilidad_<x>_menor_150` siguen teniendo precedencia (sin cambios).

No se cambian criterios cualitativos, no se cambian placeholders, no se cambian contratos públicos, no se cambia el flujo de extracción, no se cambia el `extraction-presentation-schemas.ts` (la columna `key`/`unit`/`m*_value` ya estaba como contrato del renderer — ahora el panel la consume además de la forma del extractor).

## Archivos

### Modificados

- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx`
  - Tipo `EspirometriaParametrosRow` ampliado con `unit`, `m1_value`/`m2_value`/`m3_value`.
  - `findRowByKey` → 3 niveles (canónica sin Mejor → label sin Mejor → fallback con Mejor).
  - `isMejorRow(row)` helper (defensa por `label` o por `key` que empiecen con `mejor`/`mejor_`).
  - `collectManeuverValues` → pares `(m1, m1_value)`, `(m2, m2_value)`, `(m3, m3_value)` con precedencia del alias extractor.
  - `readRowUnit(row)` helper (`unidad` o `unit`, normalizado a lowercase + trim).
  - Llamadores en `resolveCriteria`: `findRowByKey(parametros, "fvc_l", "FVC")` y `findRowByKey(parametros, "fev1_l", "FEV1")`.
  - Comentarios de cabecera actualizados a rev. 1.3.
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` — 10 tests nuevos en suite "rev. 1.3 aliases renderer/schema".

### Sin cambios (protegidos)

- `frontend/src/components/clinical/PapeletaWorkspace.tsx` — sigue cableando `extractedData` al panel (rev. 1.2 intacto).
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx` — sigue con las tres secciones `details open`.
- `frontend/src/components/clinical/extraction-presentation-schemas.ts` — **NO modificado**: el schema ya tenía las columnas `unit`/`m1_value`/etc.; el panel ahora las entiende además de las del extractor.
- Backend, Prisma, migraciones, calibración publicada — **NO modificados** (IMPLEMENTATION_DEFECT puro frontend).
- `extractedData`, `fuente_texto_crudo`, modo sombra clínica, revisión médica, renderer de Audiometría — **NO modificados**.

## Contratos

- **Cambian (delta soft, dentro del mismo SPEC):**
  - `EspirometriaParametrosRow` (tipo TS interno): aditivo — campos opcionales `unit`, `m1_value`/`m2_value`/`m3_value`. No es contrato público.
  - Comportamiento del panel:
    - Antes rev. 1.3: payload con `key` no canónica o con `m1_value`/`unit` → panel mostraba `—` aunque la tabla clínica mostrase los valores.
    - Después rev. 1.3: mismas formas + aliases → panel muestra FVC/FEV1/#Pruebas/Sí/No.
- **Protegidos (NO TOCADOS):**
  - `extracted_data` raíz del snapshot backend — sin cambios.
  - `calidad`/`parametros` del payload — sin cambios (el panel sólo los lee; no los modifica).
  - Endpoints V2, schema Prisma, migraciones — sin cambios.
  - Estudio Audiometría y otros tipos — comportamiento idéntico.
  - `extraction-presentation-schemas.ts` — sin cambios (la columna `key`/`unit`/`m*_value` ya estaba como contrato del renderer; el panel la entiende ahora además de la forma del extractor).

## Validación

| Gate | Comando | Resultado |
|---|---|---|
| Frontend typecheck focal | `cd frontend && npx tsc --noEmit` | **PASS** 0 errores |
| Frontend vitest focal nuevo | `cd frontend && npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS 45/45** (35 rev. 1.2 + 10 rev. 1.3) |
| Frontend vitest suite | `cd frontend && npx vitest run` | **0 regresiones nuevas**: 15 fallos preexistentes en `medical-exam.actions.test.ts` (idénticos a baseline rev. 1.2) |
| Frontend lint focal | `cd frontend && npx eslint src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS** 0 errores / 0 warnings |
| Frontend build | `cd frontend && npx next build` | **SUCCESS** (✓ Compiled successfully en 23.0s) |

## Trazabilidad AC (FEATURE-20260824-01 SPEC §7)

- **AC-1** (presencia del bloque): PASS — sigue vigente en rev. 1.3, validado con fixture completa (`extraction-espirometria-rd2026.json` + `EXTRACTED_ALIASED`).
- **AC-2** (FVC 30 ml, FEV1 40 ml): PASS — verificado en dos formas:
  - Forma del extractor (`m1`/`m2`/`m3`/`unidad`) — test "AC-2: muestra FVC 30.00 ml y FEV1 40.00 ml calculados desde parametros[] (PDF Sibelmed)".
  - Forma del renderer/schema (`m1_value`/`m2_value`/`m3_value`/`unit`) — test "Soporta m1_value/m2_value/m3_value con key canónica y unit (sin m1/m2/m3/unidad)".
- **AC-3** (3 pruebas aceptables y calidad A): PASS — verificado en ambas formas + alias-safe (extraído gana).
- **AC-4** (Justificación/Limitaciones/Fuentes clínicas abiertas): PASS — sigue vigente (sin cambios en `StudyAIPrediagnosisPanel.tsx`).
- **AC-5** (payload parcial sin inflar): PASS — los nuevos tests cubren tanto el alias-only (FVC+FEV1 sólo con `_value`/`unit`) como el extractor-only (FVC+FEV1 sólo con `m1`/`unidad`) y el parcial (sin FVC/FEV1) — todos sin `—` inventado para los cualitativos.
- **AC-6** (Audiometría intacta): PASS — sin cambios. `hasRenderableEspirometriaCriteria` con payload de Audio sigue retornando `false`.
- **AC-7** (typecheck/tests focales): PASS — ver tabla arriba.

## Trazabilidad FND rev. 1.3 (cierre IMPLEMENTATION_DEFECT)

- **FND-1.3.A** (resolución de filas no canónicas): `test "Fallback por label "FVC"/"FEV1" cuando key canónica está ausente (extractor entrega sólo label)"` — verifica fallback por label normalizado.
- **FND-1.3.B** (exclusión `Mejor X`): `test "Si coexisten filas "Mejor FVC"/"FVC", la fila estándar gana para el cálculo"` — verifica que la fila estándar gana y la "Mejor X" no infla ni falsea el diff.
- **FND-1.3.C** (defensa "Mejor X" sin estándar): `test "FVC/FEV1 no se prefieren cuando la única fila es "Mejor FVC" / "Mejor FEV1""` — verifica fallback defensivo (paso 3) con `Mejor X` aislado; el panel NO queda huérfano.
- **FND-1.3.D** (aliases renderer/schema): `test "Soporta m1_value/m2_value/m3_value con key canónica y unit (sin m1/m2/m3/unidad)"` — verifica el shape real de `extraction-presentation-schemas.ts` y que FVC 30.00, FEV1 40.00, Sí/Sí, 3 se muestran sin `—`.
- **FND-1.3.E** (mezcla de aliases): `test "Soporta mezcla de aliases (m1/m2/m3 + m1_value/m2_value/m3_value) en la misma fila"` — verifica precedencia de alias extractor con fallback a `_value`.
- **FND-1.3.F** (unidad `L`/`l`): tests `test "Acepta unit="l" (minúscula) como L para conversión a ml"` y `test "Acepta unit="L" (mayúscula) como L para conversión a ml"`.
- **FND-1.3.G** (no "—" para FVC/FEV1/#Pruebas con aliases): `test "El panel NO muestra "—" para FVC/FEV1/#Pruebas cuando el payload usa aliases renderer/schema"` — verifica el síntoma reportado por Frank.

## Riesgos y desviaciones

- **Riesgo clínico (nulo):** no se cambian los datos extraídos, no se cambia la fórmula de repetibilidad, no se cambia el umbral AMI (150 ml sigue siendo BR-20260824-01), no se promueve `impresion_diagnostica_texto`/`recomendaciones_texto` a salida IA. Sólo se amplía la lectura del payload.
- **Riesgo de falso positivo en cálculo (mitigado):** `Mejor FVC`/`Mejor FEV1` se excluyen explícitamente del cálculo (su `m1=m2=m3` por definición colapsa el diff a 0). Esto preserva la integridad del cálculo sin impedir la presentación de esas filas en la tabla clínica.
- **Riesgo de regresión (bajo):** los 35 tests previos de rev. 1.2 siguen verdes sin cambios; los 10 nuevos sólo añaden cobertura de aliases. No hay tests que dependan de que el panel devuelva `null` cuando el payload trae `_value`/`unit`.
- **Riesgo de contrato (nulo):** el `extraction-presentation-schemas.ts` ya tenía las columnas `unit`/`m1_value`/etc. — el panel ahora también las entiende, sin modificar el renderer.
- **Cobertura de privacidad:** sin cambios. El panel sigue siendo presentación pura sobre `extractedData`; no introduce logging de PII ni `dangerouslySetInnerHTML`.

## Requiere GEMINI

**No.** Es un cambio de comportamiento interno del panel (resolución de filas + lectura de aliases) sin cambio de contrato público observable para el médico. La interfaz visible y el cálculo son idénticos para el caso canónico del extractor (rev. 1.2); el cambio sólo cubre el caso adicional del renderer/schema shape. La auditoría GEMINI del rev. 1.2 sigue vigente para la corrección del bug original.

## Requiere DEBY

**No.** No hay bug reproducible fuera del scope FEATURE-20260824-01. El diagnóstico de Frank apuntaba al renderer/schema y al extractor no canónico — ambos atendidos por el delta.

## Pendientes ATLAS

1. **Verificación de gates completos:** INTEGRA reejecuta pytest completo + vitest completo + build (focal ya verde; falta auditoría independiente si se requiere).
2. **E2E manual** con `context/RD2026/ESPIROMETRIA.pdf` cargado en un estudio `Espirometria` (V3 published o `draft`) en entorno dev/staging — precondición `DATABASE_URL` accesible. Verifica que el panel muestra FVC 30.00 ml, FEV1 40.00 ml, Sí/Sí, 3 (sin `—` para esos campos) y que el resto del layout (orden §4, secciones IA abiertas, texto fuente) sigue idéntico a rev. 1.2.
3. **No requiere OK Frank para commit/push** dentro de esta sesión — sin autorización explícita no se commitea, pushea, despliega.

## Notas de reversión

- Cambios son código puro (2 archivos modificados); sin migración ni cambio de schema ni de contrato público.
- Revertir el commit del fix (si Frank lo autoriza) restaura el comportamiento rev. 1.2: filas `key === "fvc_l"`/`"fev1_l"` exactas con `m1`/`m2`/`m3`/`unidad` siguen funcionando; filas con aliases `_value`/`unit` vuelven a mostrar `—`.
- 100% reversible.

## Estado

**READY_FOR_VERIFYING.** WIP=0, sesión SOFIA cerrada. Entrega a ATLAS → INTEGRA verifica → GEMINI confirma si requiere → ATLAS pide OK Frank.

---

# IMPL-REPORT — mini-corte (operación exacta visible)

- **ID intervención:** `IMPL-20260824-01` (mini-corte presentacional sobre rev. 1.3, mismo incremento)
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md` rev. 1.2 (sin cambio de SPEC; sólo presentación de auditoría en UI)
- **Estado:** `READY_FOR_VERIFYING`

## Cambio

Debajo de cada celda numérica (`Repetibilidad FVC` / `Repetibilidad FEV1`) se renderiza una línea pequeña con la operación exacta usada por el helper:

```
FVC: (2.33 − 2.30) × 1000 = 30.00 ml
FEV1: (2.15 − 2.11) × 1000 = 40.00 ml
```

- Sin cambio de fórmula ni de umbral (sigue siendo BR-20260824-01 ≤ 150 ml).
- El helper ya calculado (`computeRepetibilidadFromRow`) ahora también devuelve `topTwoNative: [number, number] | null` con los 2 valores más altos en la unidad nativa.
- Si la fila no existe, la unidad no es `'l'`, o hay <2 maniobras válidas → `topTwoNative = null` → la línea muestra `—` sin inventar.
- Atributos `data-testid` añadidos para E2E Playwright: `repetibilidad-fvc-operacion`, `repetibilidad-fev1-operacion`.

## Archivos modificados

- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx`:
  - `RepetibilidadCalc`: añadido `topTwoNative: [number, number] | null`.
  - `computeRepetibilidadFromRow`: devuelve también los 2 valores más altos cuando la unidad es `'l'`.
  - `ResolvedCriteria`: añadido `fvcTopTwoNative` / `fev1TopTwoNative`.
  - Nuevo sub-componente `RepetibilidadOperationLine` que formatea la operación con unicode `−` (U+2212) y `×` (U+00D7).
  - JSX del bloque "Repetibilidad numérica": inserta `RepetibilidadOperationLine` debajo de cada `NumberCell` FVC/FEV1.
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts`: nuevas aserciones (4 casos):
  1. Operación visible exacta con payload Sibelmed: `FVC: (2.33 − 2.30) × 1000 = 30.00 ml` y `FEV1: (2.15 − 2.11) × 1000 = 40.00 ml`.
  2. Sin `parametros[]` (sólo extraído en `calidad`) → líneas presentes con `—`.
  3. Una sola maniobra → bloque de repetibilidad no se renderiza → líneas de operación ausentes.
  4. Unidad ≠ `'l'` (ej. `l/s`) → `topTwoNative = null` → no se mezcla unidad.

## Validación

- **typecheck:** PASS — `npx tsc --noEmit`.
- **tests focales (V1):** PASS — 52/52 (49 panel + 3 IA).
- Sin cambio de contratos ni de snapshot. Sin commit/push.

## Estado

**READY_FOR_VERIFYING.** Sin pendientes para ATLAS distintos del gate V3 Playwright ya documentado en rev. 1.3.

---

# IMPL-REPORT — FEATURE-20260824-01 (rev. 1.4 — IMPLEMENTATION_DEFECT upstream)

- **ID intervención:** `IMPL-20260824-01` (rev. 1.4 — IMPLEMENTATION_DEFECT)
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md` rev. 1.2 (sin cambios)
- **Handoff:** `context/interconsultas/HANDOFF_FEATURE-20260824-01_SOFIA_ESPIROMETRIA-EVENT.md`
- **Estado:** `READY_FOR_VERIFYING`
- **Origen del delta:** Frank volvió a probar el Event con `context/RD2026/ESPIROMETRIA.pdf` y reportó que la tabla clínica en Events presenta `FEV1 %REF 76/75/75` (m1 ausente o desplazada) en lugar de `77/76/75`, y la operación renderizada es `(2.11 − 2.09) × 1000 = 20 ml` en lugar de `(2.15 − 2.11) × 1000 = 40 ml`. El cálculo del frontend ya es correcto sobre sus entradas (ver rev. 1.3 `collectManeuverValues`/`computeRepetibilidadFromRow`); el defecto está en extracción/normalización/mapeo de la fila FEV1 aguas arriba.

## Causa raíz acotada (sin acceso al LLM en vivo)

Sin acceso al log de la llamada al proveedor, no es posible reproducir el corrimiento exacto. El rango observado (M1 perdida/desplazada manteniendo m2/m3) sugiere uno de:

1. El LLM omite `m1`/`m1_pct_ref` cuando el valor de M1 está visualmente alineado con la columna %REF de M2 (confusión semántica poco probable tras el guardrail rev. 1.2).
2. El LLM trunca la fila FEV1 a 2 maniobras cuando lee la celda M1 como `Mejor FEV1` (m1=m2=m3 consolidado).
3. El LLM aplica "compactación" al detectar 3 valores idénticos en `Mejor FEV1.m*` y descarta la fila estándar por redundancia.

En cualquier caso, el resultado observable es consistente: la fila `fev1_l` en `parametros[]` llega con `m1=null` y `m2`/`m3` poblados con los valores de la fuente; el normalizador actual (`_normalize_espirometria_result`) acepta esa entrada sin anotación.

## Corrección

Sin ampliar alcance. Dos deltas mínimos, reversibles, dentro del mismo SPEC y mismo incremento:

### 1) Guardrail backend reforzado (extracto)

Inyectado por `_build_espirometria_extraction_prompt` antes del bloque editable de calibración. Se añaden tres apartados (§7, §8, §9) a `_ESPIROMETRIA_BACKEND_GUARDRAILS`:

- **§7 PRESERVACIÓN ESTRICTA DE LAS 6 CELDAS DE MANIOBRAS POR FILA.** Cada fila de `parametros[]` debe contener `m1`, `m1_pct_ref`, `m2`, `m2_pct_ref`, `m3`, `m3_pct_ref`. Trata `m1_pct_ref` como la celda inmediatamente a la derecha de `m1`.
- **§8 NO PERMITAS LAYOUT ALTERNATIVO** que omita/desplace celdas. Si una celda está vacía en la fuente, usa `null` — no rellenes con el valor adyacente ni con el de otra maniobra.
- **§9 EJEMPLO CONCRETO** del fixture RD2026: `"FEV1" → key "fev1_l", unidad "L", con la siguiente serie de 6 celdas: m1 = 2.15, m1_pct_ref = 77, m2 = 2.11, m2_pct_ref = 76, m3 = 2.09, m3_pct_ref = 75`. Análogo para FVC (`m1=2.30/69, m2=2.33/70, m3=2.26/68`).

### 2) Detección defensiva en `_normalize_espirometria_result`

Nueva pasada al final del normalizador (no invasiva, no destructiva). Recorre `normalized_rows` y, para cada fila con `key ∈ {fev1_l, fev1, fvc_l, fvc}`:

- Si `m1` no es None, la fila está sana → no se anota.
- Si `m1` es None **y** `m2` ó `m3` están presentes, se anota `SOSPECHA_DESPLAZAMIENTO_M1: {label}: celda m1 ausente con m2/m3 presentes (posible desplazamiento o pérdida de M1). Verifique alineación tabular M1/%REF en la fuente.`

La anotación se acumula en `result["notas_calidad"]` y, por simetría con `SOSPECHA_MAPEO`, en `result["calidad"]["notas_calidad"]`. No se modifica `parametros[]`, no se inventan valores, no se sobrescriben campos. El médico/auditor ve la advertencia sin afectar el cálculo downstream.

### Restricciones respetadas

- Cero cambios en frontend (`EspirometriaClinicalCriteriaPanel.tsx` intacto, AC-1..AC-7 sin cambios).
- Cero cambios en `extraction-presentation-schemas.ts`, schema Prisma, migraciones, endpoints.
- Cero cambios en `_ESPIROMETRIA_CANONICAL_KEYS` ni en `_backfill_espirometry_scalar` (backfill determinista sigue intacto).
- Cero cambios en `prediagnostic.py` y `_check_minimum_params`.
- Cero cambios en el cálculo de repetibilidad (top-2 sobre `m1`/`m2`/`m3` finitos, umbral AMI 150 ml).

## Archivos

### Modificados

- `backend/app/services/ai/extractor.py`:
  - `_ESPIROMETRIA_BACKEND_GUARDRAILS` (líneas 178-216 tras rev. 1.4): añadido §7-§9 con preservación estricta de las 6 celdas y ejemplo concreto FEV1/FVC del fixture RD2026.
  - `_normalize_espirometria_result` (líneas 552-589 tras rev. 1.4): añadido bloque defensivo `SOSPECHA_DESPLAZAMIENTO_M1` antes del `return result`.

### Sin cambios (protegidos)

- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx` — `collectManeuverValues`/`computeRepetibilidadFromRow`/`findRowByKey` siguen idénticos (rev. 1.3 intacto).
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` — los 49 tests previos de rev. 1.3 + 5 nuevos (suite rev. 1.4) — separados por `describe(...)`.
- `frontend/src/components/clinical/PapeletaWorkspace.tsx` y `StudyAIPrediagnosisPanel.tsx` — sin cambios.
- `extraction-presentation-schemas.ts` — sin cambios.
- `prediagnostic.py`, schemas Prisma, migraciones, endpoints, `enabled` legacy V1/V2, calibración V3, snapshot, AMI/RD2026 — todos intactos.

### Nuevos

- `backend/tests/test_ai_pipeline.py::TestFEATURE20260824_01Rev14EspiroRD2026Preservation` (7 tests nuevos, fixture documental RD2026 cargada vía `pathlib.Path` y `json.loads`).
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` (suite `rev. 1.4 regresión layout Sibelmed RD2026`, 5 tests nuevos, fixture documental cargada con `node:fs.readFileSync`).

## Contratos

- **Cambia (delta soft, dentro del mismo SPEC):**
  - Prompt de extracción inyectado al LLM para Espirometría: añade §7-§9 al guardrail (no es contrato público observable para Frank, sólo directrices internas al LLM).
  - Anotación `SOSPECHA_DESPLAZAMIENTO_M1` en `extracted_data.notas_calidad` y `extracted_data.calidad.notas_calidad` cuando el normalizador detecta FEV1/FVC con `m1=null` y `m2`/`m3` presentes. No es campo nuevo; reutiliza el canal existente de `notas_calidad` documentado en SPEC_ARCH-20260516-12.
- **Protegidos (NO TOCADOS):**
  - `extracted_data.parametros[]` raíz — sin cambios (no se modifica, no se inventan valores).
  - `calidad.repetibilidad_fvc_ml` / `fev1_ml` — sin cambios (el panel sigue usando extraído > calculado).
  - Endpoints V1/V2, schema Prisma, migraciones — sin cambios.
  - Estudio Audiometría y otros tipos — comportamiento idéntico.
  - Cálculo de repetibilidad y umbral AMI ≤150 ml — sin cambios.

## Validación

| Gate | Comando | Resultado |
|---|---|---|
| Backend typecheck | `python3 -c "from app.services.ai.extractor import ExtractorService, _ESPIROMETRIA_BACKEND_GUARDRAILS"` + `python3 -m py_compile app/services/ai/extractor.py` | **PASS** |
| Backend pytest focal FEATURE-20260824-01 rev. 1.4 | `cd backend && python3 -m pytest tests/test_ai_pipeline.py::TestFEATURE20260824_01Rev14EspiroRD2026Preservation -v` | **PASS 7/7** |
| Backend pytest regresión FIX-20260821-01 | `cd backend && python3 -m pytest tests/test_ai_pipeline.py::TestFIX20260821_01GateTableawareEspirometria -v` | **PASS 12/12** |
| Backend pytest regresión Espirometría exhaustiva (los no-M3) | `cd backend && python3 -m pytest "tests/test_ai_pipeline.py::TestEspirometriaExhaustiva_20260516_12_13::test_espirometria_usa_prompt_con_guardrails_backend_FIX_20260812_20" "tests/test_ai_pipeline.py::TestEspirometriaExhaustiva_20260516_12_13::test_espirometria_json_exhaustivo_valida_schemas_y_normalizer_FIX_20260812_20"` | **PASS 2/2** |
| Backend pytest completo `test_ai_pipeline.py` | `cd backend && python3 -m pytest tests/test_ai_pipeline.py --tb=no -q` | **31 failed, 143 passed** (idéntico al baseline pre-rev-1.4; los 31 fallos son pre-existentes `M3_CREDENTIALS_UNAVAILABLE` sin M3_API_KEY en test env) |
| Frontend typecheck | `cd frontend && npx tsc --noEmit` | **PASS 0 errores** |
| Frontend vitest focal rev. 1.4 | `cd frontend && npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS 54/54** (49 rev. 1.3 + 5 rev. 1.4) |
| Frontend lint focal | `cd frontend && npx eslint src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS 0 errores / 0 warnings** |
| Frontend build | `cd frontend && npx next build` | **SUCCESS** (✓ Compiled successfully in 17.1s) |
| Frontend vitest suite completa | `cd frontend && npx vitest run` | **15 failed, 753 passed** (idénticos al baseline: 15 fallos pre-existentes en `medical-exam.actions.test.ts` no atribuibles; +5 nuevos PASS por los tests rev. 1.4) |

## Trazabilidad AC (FEATURE-20260824-01 SPEC §7)

- **AC-1** (presencia del bloque): PASS — sin cambios.
- **AC-2** (FVC 30 ml, FEV1 40 ml): PASS — verificado end-to-end sobre el fixture documental completo:
  - `test_rd2026_fev1_row_preserves_m1_and_m1_pct_ref` (pytest): m1=2.15, m1_pct_ref=77 preservados.
  - `test_rd2026_fvc_row_preserves_all_six_cells` (pytest): FVC 6 celdas intactas.
  - `test_repetibilidad_fev1_top_two_equals_40ml` (pytest): backfill `fev1 = max(m1,m2,m3) = 2.15` (no 2.11).
  - `test_repetibilidad_fvc_top_two_equals_30ml` (pytest): top-2 FVC = 2.33 − 2.30 = 0.03 L → 30 ml.
  - `El render HTML del panel muestra FVC 30.00 ml y FEV1 40.00 ml con la operación exacta` (vitest rev. 1.4): `FEV1: (2.15 − 2.11) × 1000 = 40 ml` renderizado en HTML SSR.
- **AC-3** (3 pruebas aceptables y calidad A): PASS — sin cambios.
- **AC-4** (Justificación/Limitaciones/Fuentes clínicas abiertas): PASS — sin cambios.
- **AC-5** (payload parcial sin inflar): PASS — `test_fev1_m1_missing_m2_m3_present_flags_displacement` verifica que el normalizador NO rellena `m1` cuando está ausente, sólo anota `SOSPECHA_DESPLAZAMIENTO_M1`.
- **AC-6** (Audiometría intacta): PASS — `EspirometriaClinicalCriteriaPanel` no tocado.
- **AC-7** (typecheck/tests focales): PASS — ver tabla arriba.

## Trazabilidad AC nueva (rev. 1.4 cierre IMPLEMENTATION_DEFECT)

- **AC-rev1.4-1** (FEV1 m1=2.15/m1_pct_ref=77 preservado): `test_rd2026_fev1_row_preserves_m1_and_m1_pct_ref`.
- **AC-rev1.4-2** (FVC 6 celdas intactas): `test_rd2026_fvc_row_preserves_all_six_cells`.
- **AC-rev1.4-3** (repetibilidad FEV1 40 ml): `test_repetibilidad_fev1_top_two_equals_40ml` + `El render HTML del panel muestra…` (vitest).
- **AC-rev1.4-4** (repetibilidad FVC 30 ml sin regresión): `test_repetibilidad_fvc_top_two_equals_30ml` + `El render HTML del panel muestra…`.
- **AC-rev1.4-5** (payload RD2026 canónico NO dispara desplazamiento falso positivo): `test_rd2026_canonical_payload_does_not_flag_displacement`.
- **AC-rev1.4-6** (m1 ausente en FEV1 ⇒ anotación defensiva `SOSPECHA_DESPLAZAMIENTO_M1` sin inventar): `test_fev1_m1_missing_m2_m3_present_flags_displacement`.
- **AC-rev1.4-7** (guardrail FEV1 con ejemplo bit-a-bit inyectado en el prompt): `test_espirometry_prompt_contains_rd2026_fev1_example`.
- **AC-rev1.4-8** (frontend no inventa m1 cuando falta): `Defensa: si el payload llegara con FEV1 m1 ausente, el panel no inventa y la operación sale con "—"` (vitest) verifica que con sólo `m2`/`m3` poblados, `fev1TopTwoNative = [2.11, 2.09]` (NO rellena m1 con 2.15 ni con nada).

## Riesgos y desviaciones

- **Riesgo clínico (nulo):** no se cambian los datos extraídos, no se cambia la fórmula de repetibilidad, no se cambia el umbral AMI (150 ml sigue siendo BR-20260824-01), no se promueve `impresion_diagnostica_texto`/`recomendaciones_texto` a salida IA. Sólo se amplía el guardrail y se anota defensivamente.
- **Riesgo de regresión (nulo verificado):** pytest focal 19/19 PASS (12 FIX-20260821-01 + 7 rev 1.4); 31 fallos preexistentes idénticos a baseline; vitest focal 54/54 PASS; 15 fallos preexistentes idénticos a baseline; +5 PASS nuevos; typecheck y build limpios.
- **Riesgo de falso positivo (mitigado):** la detección `SOSPECHA_DESPLAZAMIENTO_M1` sólo dispara bajo la condición estricta `m1 ausente + (m2 ó m3 presente)`. Si la fuente tiene una sola maniobra aceptable, el LLM emite sólo `m1` y la anotación NO dispara (ver `test_rd2026_canonical_payload_does_not_flag_displacement` que valida no-falso-positivo sobre el payload completo canónico).
- **Riesgo de contrato (nulo):** no se cambia el schema Prisma, no se cambia `EspirometriaData.parametros[].*`, no se cambia el flujo `_normalize_espirometria_result` salvo la pasada adicional al final. `SOSPECHA_DESPLAZAMIENTO_M1` se acumula en `notas_calidad` (canal existente).
- **Cobertura de privacidad:** sin cambios. No se imprime PII; el guardrail y el detector de desplazamiento son agnósticos del paciente.

## Causa raíz que NO se cierra con esta intervención (requiere lote posterior)

La **causa raíz** del corrimiento no se cierra aquí porque requiere lote con credenciales DR7/M3 reales y `MedGemma/M3` accesible para reproducir el log de la llamada al proveedor. El alcance de esta sesión es IMPLEMENTATION_DEFECT puro: el normalizador ahora detecta y anota el patrón; el guardrail ahora cita explícitamente el ejemplo RD2026. La causa raíz (provocación del LLM) quedará bajo `FINDINGS.md` FND-20260824-04 P2 (pendiente de crear formalmente en próximo handoff).

## Requiere GEMINI

**No.** Es un IMPLEMENTATION_DEFECT (corrección soft de normalizador + refuerzo de guardrail inyectado) sin cambio de contrato público observable para el médico. La interfaz visible, el cálculo y los datos clínicos son idénticos cuando el extractor entrega correctamente las 6 celdas (caso canónico). La auditoría GEMINI del rev. 1.2 sigue vigente para la corrección original.

## Requiere DEBY

**No.** No hay crash/race/leak. El defecto es de inferencia del LLM y se atiende desde la capa defensiva del normalizador (no es bug reproducible runtime).

## Pendientes ATLAS

1. **Verificación de gates focales:** ya PASS (pytest focal 19/19, vitest focal 54/54, typecheck 0 errores, build SUCCESS).
2. **E2E manual** con `context/RD2026/ESPIROMETRIA.pdf` cargado en un estudio `Espirometria` (V3 published o `draft`) en entorno dev/staging — precondición `DATABASE_URL` accesible. Verifica que el panel muestra FVC 30 ml, FEV1 40 ml, Sí/Sí, 3 (sin `—` para esos campos) y que el resto del layout (orden §4, secciones IA abiertas, texto fuente) sigue idéntico a rev. 1.3. Si el extractor real emite FEV1 con `m1` desplazado o ausente, se debe ver `SOSPECHA_DESPLAZAMIENTO_M1` en `notas_calidad`.
3. **GEMINI** no obligatoria para rev. 1.4 (es IMPLEMENTATION_DEFECT de normalizador + guardrail); recomendada sólo si ATLAS decide validar el cambio del guardrail (afecta al LLM upstream).
4. **No requiere OK Frank** para commit/push dentro de esta sesión — sin autorización explícita no se commitea, pushea, despliega.

## Notas de reversión

- Cambios son código puro + tests focales (3 archivos modificados + 0 archivos nuevos); sin migración ni cambio de schema ni de contrato público observable para el médico.
- Revertir el commit rev. 1.4 restaura el comportamiento de rev. 1.3: extraía el snapshot vigente con `parametros[]` ya corregido, sin anotación `SOSPECHA_DESPLAZAMIENTO_M1`, con guardrail sin §7-§9. Las 5 entradas de `notas_calidad` previamente anotadas se omitirían.
- 100% reversible.

## Estado

**READY_FOR_VERIFYING.** WIP=0, sesión SOFIA cerrada. Entrega a ATLAS → INTEGRA verifica → GEMINI confirma si requiere → ATLAS pide OK Frank.

### Resumen de comandos validados

```bash
# Backend focal
cd backend && python3 -m pytest tests/test_ai_pipeline.py::TestFEATURE20260824_01Rev14EspiroRD2026Preservation -v
# → 7/7 PASS

# Backend regresión FIX-20260821-01
cd backend && python3 -m pytest tests/test_ai_pipeline.py::TestFIX20260821_01GateTableawareEspirometria -v
# → 12/12 PASS

# Frontend focal
cd frontend && npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts
# → 54/54 PASS

# Frontend typecheck y build
cd frontend && npx tsc --noEmit   # 0 errores
cd frontend && npx next build     # SUCCESS
```
