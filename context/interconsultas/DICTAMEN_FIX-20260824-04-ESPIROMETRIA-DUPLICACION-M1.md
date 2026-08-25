# FIX-DICTAMEN — FIX-20260824-04: Espirometría — duplicación M2→M1 (regla general de validación cruzada Mejor X vs fila estándar X)

- **ID:** FIX-20260824-04
- **Fecha:** 2026-08-24
- **Solicitante:** Frank (vía sesión DEBY)
- **Tarea/SPEC:** FEATURE-20260824-01 (Espirometría Event) rev. 1.5 — IMPLEMENTATION_DEFECT dentro de la misma SPEC. BR-20260824-01 (umbral AMI ≤150 ml).
- **Nivel:** L2 (lógica acotada, 3 archivos de código + 2 de tests; sin contrato público/schema/migración/auth/infra). Ejecutado en sesión DEBY con autorización del caller (corregir + tests + reportar, **sin commit/push**).
- **Estado:** `READY_FOR_VERIFYING`

---

## A. Síntoma y alcance

Captura Event v9 (PDF fuente Sibelmed W20s, `context/RD2026/ESPIROMETRIA.pdf`):

- **Operación FEV1 renderizada:** `(2.11 − 2.11) × 1000 = 0 ml` (debe ser `(2.15 − 2.11) × 1000 = 40 ml`).
- **Tabla visible del extractor:** FEV1 `%REF` M1=76, M2=76, M3=75 (M1 y M2 con `%REF` idéntico — duplicado).
- **PDF fuente Sibelmed:** fila FEV1 debe ser M1=2.15/%77, M2=2.11/%76, M3=2.09/%75.
- **FVC:** sigue 30 ml (correcto, sin afectación).
- **Repetibilidad AMI ≤150 ml:** preservada (BR-20260824-01).

El defecto NO está en la fórmula del panel ni en el backfill: está en la **extracción/normalización de celdas**. El LLM duplica M2 como M1 (m1=m2=2.11, %REF 76/76), perdiendo el verdadero M1 (2.15/77) que SÍ aparece consolidado en la fila "Mejor FEV1".

**Alcance:** backend `extractor.py` (normalizador + guardrails), frontend `EspirometriaClinicalCriteriaPanel.tsx` (invalidación), script `update-espirometria-extraction-prompt.ts` (refuerzo de prompt v5/v6). Sin tocar schema, migraciones, endpoints, auth, discovery/SPEC/ADR.

## B. Reproducción

Reproducción determinista (sin LLM en vivo, con payload que simula el output defectuoso del extractor):

```python
# Caso defectuoso Event v9
input_dict = {
  "parametros": [
    {"label": "Mejor FEV1", "key": "mejor_fev1_l", "unidad": "L",
     "m1": 2.15, "m2": 2.15, "m3": 2.15},   # mejor maniobra consolidada
    {"label": "FEV1", "key": "fev1_l", "unidad": "L",
     "m1": 2.11, "m2": 2.11, "m3": 2.09},   # M1 DUPLICADA de M2 (defecto)
  ],
  "calidad": {"es_interpretable": True, "completitud_documental": "suficiente"},
}
normalized = extractor._normalize_espirometria_result(input_dict)
# Antes del fix: no anota nada; el cálculo downstream daría (2.11-2.11)*1000=0 ml.
# Después del fix: anota SOSPECHA_INCONSISTENCIA_MEJOR_FEV1 + no_concluyente.
```

- **Precondiciones:** ExtractorService backend, payload con fila "Mejor FEV1" + fila "FEV1" estándar.
- **Acción:** `_normalize_espirometria_result(payload)`.
- **Esperado (post-fix):** `notas_calidad` contiene `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`; `completitud_documental="no_concluyente"` (raíz + `calidad`); la fila FEV1 conserva m1=2.11 (NO se rellena con 2.15).
- **Observado (post-fix):** coincide con lo esperado (test `test_fev1_duplicated_m2_as_m1_flags_inconsistency` PASS).

## C. Evidencia (logs redactados, sin PII)

- **Antes del fix (síntoma):** `m1 is not None` (vale 2.11) → la detección `SOSPECHA_DESPLAZAMIENTO_M1` de rev. 1.4 (`extractor.py:539-579`) **no dispara** porque requiere `m1 is None`. El cálculo del panel sobre `parametros[].fev1_l` produce `top-2 = (2.11, 2.11)` → `(2.11 − 2.11) × 1000 = 0 ml`.
- **Fixture documental RD2026 (canónico, consistente):** fila "Mejor FEV1" (`mejor_fev1_l`) con `m1=m2=m3=2.15`, `%REF=77`; fila "FEV1" (`fev1_l`) con `m1=2.15/77, m2=2.11/76, m3=2.09/75`. Aquí `max(FEV1)=2.15 == Mejor FEV1=2.15` → consistente, no debe disparar (test `test_rd2026_canonical_does_not_flag_inconsistency` PASS).
- **Backend focal (post-fix):** 25/25 PASS (6 rev. 1.5 nuevos + 12 rev. 1.4 + 12 FIX-20260821-01).
- **No-regresión `test_ai_pipeline.py`:** `31 failed, 174 passed` — los 31 fallos son `M3_CREDENTIALS_UNAVAILABLE` preexistentes (sin `M3_API_KEY` en el entorno de tests, incluyendo `TestEspirometriaExhaustiva_*` y `TestMultiProviderExtraction_*`). Idénticos al baseline rev. 1.4. Sin regresiones nuevas.
- **Frontend focal:** 65/65 PASS (54 previos + 11 nuevos de rev. 1.5).
- **Frontend typecheck:** 0 errores. **Backend py_compile + import:** OK.

## D. Hipótesis evaluadas

| Hipótesis | Evidencia a favor | En contra | Prueba discriminante | Estado |
|---|---|---|---|---|
| H1: El LLM duplica M2 como M1 (m1=m2=2.11), y la defensa rev. 1.4 sólo cubre `m1 is None` | Síntoma `(2.11−2.11)×1000=0`; `%REF` 76/76 duplicado; rev. 1.4 flag requiere `m1 is None` | — | Payload defectuoso por `_normalize_espirometria_result` sin anotar (pre-fix) vs anotar (post-fix) | **Confirmada** |
| H2: El LLM usa la fila "Mejor FEV1" como fila "FEV1" (consolidación m1=m2=m3 colapsa) | El valor de "Mejor FEV1" (2.15) NO aparece en la fila FEV1 defectuosa (m1=m2=2.11) — contradice "usó la fila Mejor como estándar" | Si hubiera usado la fila Mejor como estándar, m1=m2=m3=2.15, no 2.11 | Comparar m1 de la fila defectuosa (2.11) vs m1 de la fila Mejor (2.15) | Descartada como causa única (pero H3 la cubre) |
| H3: El LLM confunde/trunca la fila FEV1 y duplica M2 en M1 (variante de H1) | Consistente con el síntoma completo; rev. 1.4 ya listaba hipótesis análogas ("compactación al detectar 3 valores idénticos en Mejor FEV1") | — | Validación cruzada `max(FEV1) < Mejor FEV1` discrimina defecto de canónico | **Confirmada (variante)** |
| H4: El cálculo del panel o el backfill están mal | El cálculo es correcto sobre sus entradas (rev. 1.3/1.4 lo verifican); el backfill alimenta `fev1` raíz desde la fila "Mejor FEV1" (precedencia FIX-20260821-01 (a)) = 2.15 (correcto para el escalar del gate) | El panel usa `parametros[]` (fila FEV1), no `fev1` raíz, para la operación → 0 ml espurio | Backfill da 2.15 (correcto) pero la fila FEV1 sigue m1=2.11 | Descartada (el cálculo/backfill son correctos; el defecto es la fila extraída) |

## E. Causa raíz

**Causa confirmada (no probable):** el LLM (M3/Gemini) al extraer la fila FEV1 del PDF Sibelmed **duplica M2 en M1** (m1=m2=2.11, %REF 76/76), perdiendo el verdadero M1 (2.15/77) que sí aparece consolidado en la fila "Mejor FEV1". La defensa `SOSPECHA_DESPLAZAMIENTO_M1` de rev. 1.4 **era inefectiva ante este patrón** porque sólo dispara cuando `m1 is None`; aquí `m1=2.11` (no None), así que el flag no actuaba y el cálculo downstream producía `(2.11 − 2.11) × 1000 = 0 ml`.

**Por qué v5 produjo nuevamente M1=2.11:** el prompt v5 (en Railway, `espirometria-sibelmed-v5`) y los guardrails backend §7-§9 (rev. 1.4) hablan de "preservar 6 celdas" y "no desplazar", pero **NO prohibían explícitamente** (a) duplicar una celda (m1=m2), ni (b) usar la fila "Mejor FEV1" como fila estándar FEV1, ni (c) validar la consistencia entre ambas filas. Sin esa prohibición explícita, el LLM reincide en el patrón de duplicación/compactación ya identificado en rev. 1.4 (hipótesis 2/3 de aquel dictamen).

## F. Solución recomendada (corrección mínima, regla general)

**Regla general (NO hardcodea paciente ni valores):** validación cruzada entre la fila "Mejor X" y la fila estándar X (FEV1/FVC). En el layout Sibelmed, la fila "Mejor X" consolida la mejor maniobra (m1=m2=m3). Por tanto, `max(m1,m2,m3)` de la fila estándar X **debe igualar** `m1` de la fila "Mejor X". Si `max(fila estándar) < Mejor X`, el valor de la mejor maniobra se perdió o se duplicó otra celda (típicamente M2 duplicada como M1).

1. **Backend `extractor.py`** — guardrails §10/§11/§12 + pasada de validación cruzada en `_normalize_espirometria_result`:
   - §10: NO usar la fila "Mejor FEV1"/"Mejor FVC" como sustituto de la fila estándar.
   - §11: NO duplicar una celda en otra (no rellenar m1 con m2).
   - §12: consistencia entre "Mejor X" y fila estándar X (`max(m1,m2,m3)` debe igualar "Mejor X").
   - Validación cruzada: para cada par (fila estándar X, fila "Mejor X") presente en `parametros[]`, si `max(fila estándar) < Mejor X` (con epsilon), anotar `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` / `_FVC` (token específico por parámetro) en `notas_calidad` (raíz + `calidad`) y forzar `completitud_documental="no_concluyente"`. **NO se inventa ni rellena m1** (se preserva el valor extraído erróneo; la defensa es la anotación + no_concluyente).
2. **Frontend `EspirometriaClinicalCriteriaPanel.tsx`** — `resolveCriteria` invalida el cálculo de repetibilidad cuando `notas_calidad` contiene `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`/`_FVC`:
   - Oculta la operación visible (`topTwoNative=null` → la línea muestra "—").
   - Si la repetibilidad venía del CÁLCULO (`source="computed"`): invalida el número y el flag ≤150 (no muestra 0 ml como válido).
   - Si venía del TEXTO NATIVO extraído (`calidad.repetibilidad_fev1_ml`, fuente independiente del layout): conserva el número pero oculta la operación espuria.
3. **Script `update-espirometria-extraction-prompt.ts`** — refuerzo del prompt (reglas 8-10 + prohibiciones 9-10): NO duplicar M2 como M1; NO usar "Mejor X" como fila estándar; consistencia "Mejor X" vs fila estándar. **No se ejecutó** (no deploy; el script actualiza la BD en Railway — requiere autorización de Frank para desplegar).

**FVC 30 ml y repetibilidad AMI ≤150 preservados** sin cambios (la validación cruzada no dispara cuando la fila es consistente; el umbral AMI ≤150 sigue derivando del numérico en el panel).

## G. Prueba de regresión y validación

| Gate | Comando | Resultado |
|---|---|---|
| Backend py_compile + import | `python3 -m py_compile app/services/ai/extractor.py` + import | **PASS** |
| Backend pytest rev. 1.5 (duplicación) | `pytest tests/test_ai_pipeline.py::TestFEATURE20260824_01Rev15EspiroDuplicacionM1 -v` | **PASS 6/6** |
| Backend pytest rev. 1.4 (no-regresión) | `pytest tests/test_ai_pipeline.py::TestFEATURE20260824_01Rev14EspiroRD2026Preservation -v` | **PASS 7/7** |
| Backend pytest FIX-20260821-01 (no-regresión) | `pytest tests/test_ai_pipeline.py::TestFIX20260821_01GateTableawareEspirometria -v` | **PASS 12/12** |
| Backend no-regresión completa | `pytest tests/test_ai_pipeline.py --tb=no -q` | **31 failed, 174 passed** (31 preexistentes `M3_CREDENTIALS_UNAVAILABLE`, idénticos al baseline; +6 PASS nuevos) |
| Frontend typecheck | `npx tsc --noEmit` | **PASS** 0 errores |
| Frontend vitest panel | `npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS 65/65** (54 previos + 11 rev. 1.5) |
| Frontend vitest script prompt | `npx vitest run scripts/__tests__/update-espirometria-extraction-prompt.test.ts` | **PASS 38/38** |

**Cobertura de regresión solicitada:**
- FEV1 2.15/77, 2.11/76, 2.09/75 ⇒ 40 ml: `test_rd2026_canonical_preserves_pairs_and_repetibilidad` (backend) + `Caso canónico (sin anotación)` (frontend).
- Caso de columnas duplicadas rechazado/marcado inconsistente: `test_fev1_duplicated_m2_as_m1_flags_inconsistency` (backend: `no_concluyente`) + `Duplicación FEV1 → invalida número, operación y flag` y `Render: ... operación FEV1 muestra "—"` (frontend).
- FVC 30 ml: `test_rd2026_canonical_preserves_pairs_and_repetibilidad` + `Duplicación FEV1 ... FVC consistente: NO se invalida (sigue 30 ml)`.
- Repetibilidad AMI ≤150: `Caso canónico ... repetibilidadFev1Menor150 = 'SI'` (40 ≤ 150) y la suite previa `BR-20260824-01: diff = 151 ml → NO` (frontend, sin cambios).

## H. Parche aplicado

**Sí.** L2 aplicado en sesión DEBY con autorización del caller (corregir + tests + reportar, sin commit/push).

Archivos modificados (5, código puro + tests, sin migración/schema/contrato público):

- `backend/app/services/ai/extractor.py` (+123 líneas): guardrails §10/§11/§12 en `_ESPIROMETRIA_BACKEND_GUARDRAILS`; pasada de validación cruzada `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`/`_FVC` en `_normalize_espirometria_result` (tokens específicos por parámetro, fuerza `no_concluyente`, no inventa m1).
- `backend/tests/test_ai_pipeline.py` (+260 líneas): nueva clase `TestFEATURE20260824_01Rev15EspiroDuplicacionM1` (6 tests).
- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx` (+69 líneas): `resolveCriteria` invalida `topTwoNative`/`repetibilidad*Ml`/`*Menor150` al detectar `SOSPECHA_INCONSISTENCIA_MEJOR_*` en `notas_calidad` (raíz o `calidad`); conserva el valor extraído del texto nativo (fuente independiente).
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` (+153 líneas): nueva suite rev. 1.5 (6 tests, 11 con variantes).
- `frontend/scripts/update-espirometria-extraction-prompt.ts` (+16 líneas): reglas 8-10 (no duplicar, no usar Mejor X como estándar, consistencia) + prohibiciones 9-10. **No ejecutado** (no deploy).

**No se insertó el ID FIX en código fuente.** El `@id IMPL-20260824-06` en la cabecera del componente es metadato de auditoría (consistente con `@id IMPL-20260824-01`/`IMPL-20260824-05` ya presentes), no una marca de agua en código de producto.

## I. Handoff, riesgos y reversión

- **Dueño siguiente:** ATLAS (reespecifica o pivota SOFIA/GEMINI según nivel). Como es L2 con tests focales PASS y sin cambio de contrato público, ATLAS puede (a) aceptar el dictamen y pedir a Frank OK para commit/push + despliegue del nuevo prompt v6 (script), o (b) activar GEMINI para auditoría del cambio del guardrail/prompt (afecta al LLM upstream).
- **Acción exacta:** ATLAS decide despliegue del prompt v6 (`update-espirometria-extraction-prompt.ts`) en Railway con `DATABASE_URL` — requiere OK de Frank (acción sobre BD de configuración). El código backend+frontend puede commitearse cuando Frank autorice.
- **Riesgos:**
  - *Bajo:* la validación cruzada sólo dispara cuando `max(fila estándar) < Mejor X` con epsilon; el canónico RD2026 no dispara (test de no-falso-positivo PASS). Caso de una sola maniobra aceptable (sólo m1) → skip (no hay fila Mejor o no hay std_vals).
  - *Nulo:* no se cambia el cálculo de repetibilidad ni el umbral AMI ≤150; no se cambia el backfill (precedencia Mejor * → estándar intacta); no se cambia schema/migración/auth/endpoints.
  - *Mitigado:* el panel conserva el valor extraído del texto nativo (`repetibilidad_fev1_ml`) cuando existe, aunque la fila esté duplicada (fuente independiente del layout).
- **Reversión recomendada (sin ejecutar rollback):** revertir los 5 archivos restaura el comportamiento rev. 1.4 (sólo `SOSPECHA_DESPLAZAMIENTO_M1` con `m1 is None`; sin validación cruzada; el panel mostraría 0 ml sobre filas duplicadas). 100% reversible (código puro + tests).

## Autoauditoría DEBY (§13)

- Diferencié síntoma (`(2.11−2.11)×1000=0`), causa probable (duplicación M2→M1) y causa confirmada (flag rev. 1.4 insuficiente + LLM duplica).
- La evidencia no contiene secretos ni PII (tests usan "Test duplicación"; el fixture RD2026 es documental preexistente).
- La clasificación considera riesgo (L2 por múltiples archivos, no L1; sin contrato público/schema/migración/auth).
- Cumplí los gates aplicables (tests focales PASS, no-regresión confirmada, no inserté FIX ID en código, no edité artefactos de otro owner, no delegué lateralmente).
- Definí prueba de regresión (6 backend + 6 frontend).
- Apliqué el loop breaker: revisé los dictámenes previos (rev. 1.2/1.3/1.4, IMPL_FIX-20260824-02). El defecto actual es **distinto** al de rev. 1.4 (m1 ausente → m1 duplicado); no repetí la misma solución; añadí una nueva detección (validación cruzada Mejor X vs fila estándar) con evidencia nueva. Máximo 1 ciclo DEBY→SOFIA por error respetado.
- El handoff identifica un único dueño (ATLAS) y una acción concreta (decidir despliegue del prompt v6 + commit del código).

---

```text
[READY_FOR_VERIFYING]
FIX: FIX-20260824-04 (context/interconsultas/DICTAMEN_FIX-20260824-04-ESPIROMETRIA-DUPLICACION-M1.md)
Tarea/SPEC: FEATURE-20260824-01 rev. 1.5 (IMPLEMENTATION_DEFECT) / BR-20260824-01
Nivel: L2
Síntoma: Event v9 — operación FEV1 (2.11 − 2.11) × 1000 = 0 ml (debe 40 ml); tabla %REF M1=76/M2=76 duplicado; PDF fuente M1=2.15/77.
Causa: confirmada — el LLM duplica M2 como M1 (m1=m2=2.11); la defensa rev. 1.4 (SOSPECHA_DESPLAZAMIENTO_M1) sólo cubre m1 is None, no m1 duplicado, por lo que no disparaba.
Parche aplicado: sí (5 archivos, código puro + tests, sin commit/push)
Evidencia: backend 25/25 focales PASS (6 rev.1.5 + 7 rev.1.4 + 12 FIX-20260821-01); no-regresión 174 passed (31 preexistentes M3_CREDENTIALS); frontend 65/65 + typecheck 0 errores + script prompt 38/38.
Dueño siguiente: ATLAS (decide despliegue prompt v6 en Railway + commit/push del código)
Acción exacta: ATLAS pide OK a Frank para (1) commit/push del código backend+frontend y (2) ejecutar `update-espirometria-extraction-prompt.ts` contra Railway (BD de configuración) — ambas requieren autorización explícita de Frank.
Riesgos: bajo (validación cruzada sólo dispara con max(fila) < Mejor X; canónico no dispara); nulo sobre cálculo/umbral AMI/schema/auth; mitigado (conserva texto nativo extraído si existe).
```
