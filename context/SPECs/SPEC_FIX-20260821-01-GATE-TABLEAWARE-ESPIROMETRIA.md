# SPEC — FIX-20260821-01: Gate clínico table-aware para Espirometría + backfill determinista desde `parametros[]`

- **ID:** SPEC_FIX-20260821-01
- **Versión:** v1.0 (inicial)
- **Estado:** `READY` (tras firma DEBY del dictamen FIX-20260821-01 y compilación por INTEGRA)
- **Propietario:** INTEGRA (compila y mantiene) → SOFIA (implementa) → GEMINI (audita por cambio de contrato)
- **Dictamen origen:** `context/interconsultas/DICTAMEN_FIX-20260821-01-E2E-MINIMAX-ESPIRO.md` (DEBY, 2026-08-21, nivel L2)
- **Hallazgo funcional:** FND-20260821-03 (E2E real Playwright sobre expediente `8af728bf-…`)
- **Trazabilidad inversa:** ARCH-20260516-12 (extracción exhaustiva 6 bloques) · FIX-20260812-20 (guardrails backend extracción espirometría) · ARCH-20260820-01 Fases 3/4 · SPEC_ARCH-20260326-16 (separación extractiva/interpretativa)
- **Fecha:** 2026-08-21
- **Riesgo:** Medio-Alto — toca gate clínico y contrato de extracción efectivo (cambio de contrato soft). GEMINI obligatorio (cambio de contrato público entre extracción y gate, sección §15 INTEGRA).

---

## 1. Resultado esperado

Que el pipeline V2 de Espirometría (`/api/v2/studies/upload-and-analyze`) deje de emitir `clinicalState = AI_NON_CONCLUSIVE` con `non_conclusive_reason = "Parámetros mínimos faltantes: fev1, fvc"` cuando la extracción tabular (`extracted_data.parametros[]`) contiene filas FEV1/FVC válidas. Que el valor clínico que el prompt de DR7 observa sea el **mejor valor disponible** (mejor maniobra o fila `Mejor *`, según contrato del schema). Que ningún otro tipo de estudio (Audiometría, Laboratorio, Rayos_X, ECG, Somatometría, AgudezaVisual) vea alterada su semántica de mínimos. Que el label UI de progreso refleje el provider real o sea neutro.

## 2. Alcance

### 2.1 Dentro del alcance

1. **Backfill determinista** en `_normalize_espirometria_result` (`backend/app/services/ai/extractor.py:346-454`): poblar `fev1`, `fvc`, `fev1_fvc_ratio`, `fev1_percent_predicho`, `fvc_percent_predicho` desde `parametros[]` cuando estén ausentes en raíz, usando reglas explícitas (§5).
2. **Aceptación de variantes sin sufijo** en el conteo de principales y en la derivación `es_interpretable` / `completitud_documental` (eliminar falso `no_concluyente` y `es_interpretable=false` cuando la tabla tiene FEV1/FVC).
3. **Mapeo defensivo `paciente`/`fecha_estudio`** desde `paciente_detalle.nombre_completo` / `estudio.fecha_estudio` para que `EspirometriaData(**result)` valide y se elimine la caída silenciosa al dict crudo (`extractor.py:904-906`).
4. **Gate clínico table-aware para Espirometría** en `_check_minimum_params` (`prediagnostic.py:590-621`): si el parámetro requerido no está en raíz, buscarlo en `parametros[]` por `key`/`label` con normalización de aliases antes de declararlo faltante. Resto de tipos: comportamiento actual sin cambios.
5. **Label UI de provider**: `PapeletaWorkspace.tsx:164` debe derivar del provider real expuesto por `extraction_snapshot.audit.extraction_provider_used` (o ser neutro) — sin afirmar "Gemini" cuando el provider es `m3`.
6. **Tests** (§7).

### 2.2 Fuera del alcance (límites explícitos — confirmados en el dictamen §I y §F)

- **No publicar V3** de Espirometría (permanece `draft`, no `tested`/`published`).
- **No aplicar migración Prisma** (ni añadir columnas, ni tocar schema). Cambios son código puro sin migración DB.
- **No resolver el 422 de Examen Médico** (`EXAMEN MEDICO` GEN-015, `study_type` como query param) — hallazgo incidental del dictamen §I, queda registrado para ATLAS.
- **No reenviar `medical_test_id`** en `triggerStudyAIAnalysis` (`ai-prediagnosis.actions.ts:167-180`). Si se cablea el resolver, la calibración V1/V2 con `enabled=false` bloquearía la IA por completo (`prediagnostic.py:813-826, 850-891`). Este punto requiere decisión funcional de Frank (semántica vigente de `enabled=false`) antes de cualquier cambio.
- **No cambiar `enabled` legacy** salvo que sea estrictamente necesario para que el fix funcione. Default: no tocar.
- **No romper el contrato público** `EspirometriaData` (`schemas/medical.py:205-212`) ni `AIPrediagnosisResult`. Campos son aditivos (nuevos en raíz) o se mantienen los nombres existentes.
- **No introducir fallback a Gemini** (FIX-20260812-12 vigente: provider extractivo `m3/MiniMax-M3` por doble fuente — calibración + AppConfig).
- **No persistir PII ni secretos**. No tocar `context/datos AMI/**`. Cero commit/push/staging/prod hasta autorización Frank.

## 3. Contratos afectados y protegidos

### 3.1 Contratos que cambian (deltas soft)

| Contrato | Archivo | Cambio | Riesgo |
|---|---|---|---|
| `extracted_data` raíz (Espirometría) | `extractor.py` (post-normalización) | Añado `fev1`, `fvc`, `fev1_fvc_ratio`, `fev1_pct_ref`, `fvc_pct_ref` cuando se hace backfill desde `parametros[]`. | Bajo — aditivo |
| `extracted_data.es_interpretable` / `.completitud_documental` (Espirometría) | `extractor.py:399-435` | Deja de ser `false/no_concluyente` cuando hay FEV1/FVC en `parametros[]` con variantes sin sufijo (`fev1`, `fvc`). | Bajo — corrección de falso negativo |
| `prediagnosis_snapshot.non_conclusive_reason` | `prediagnostic.py:614` | Ya no emite `"Parámetros mínimos faltantes: fev1, fvc"` cuando las filas existen en `parametros[]`. | Bajo — semántica clínica |
| `AI_PIPELINE_STAGES` label | `frontend/src/components/.../PapeletaWorkspace.tsx:164` | Texto deriva de `extraction_provider_used` o usa neutro "Extrayendo datos". | Cosmético |

### 3.2 Contratos protegidos (no tocar)

- `REQUIRED_PARAMS` (`prediagnostic.py:172-181`) como constante de módulo: **se mantiene**. El gate no se relaja: si una fila no existe en raíz ni en `parametros[]`, sigue retornando `AI_NON_CONCLUSIVE` con el mismo reason.
- `EspirometriaData` Pydantic (`schemas/medical.py:205-212`): sin cambios.
- `AIPrediagnosisResult`: sin cambios.
- Endpoints V2 (`/api/v2/studies/upload-and-analyze`, `/api/v2/ai/status`): sin cambios en payload público.
- Audiometría, Laboratorio, Rayos_X, ECG, Somatometría, AgudezaVisual: comportamiento idéntico.
- `enabled` legacy (`aiCalibration.extraction.enabled`): sin tocar.
- `medical_test_id` en `triggerStudyAIAnalysis` (`ai-prediagnosis.actions.ts:167-180`): sin tocar.

## 4. Modelo técnico necesario

### 4.1 Reglas de backfill (prioridad explícita)

Para cada campo flat legacy ausente en raíz (`fev1`, `fvc`, `fev1_fvc_ratio`, `fev1_pct_ref`, `fvc_pct_ref`):

1. **Construir índice** de `parametros[]` por `key` normalizado (lowercase, sin `_` finales, sin sufijos `_l`/`_pct`/`_l_s`/`_s`) y por `label` normalizado (lowercase, sin acentos opcional). Por ejemplo `fev1_l` y `fev1` colapsan al mismo bucket `fev1`; `mejor_fev1_l` y `mejor_fev1` colapsan a `mejor_fev1`.
2. **Precedencia por bucket** (de mayor a menor confianza):
   1. Fila con `key`/`label` que matchee **la fila `Mejor *`** del parámetro (p. ej. `mejor_fev1`, `mejor_fvc`). Si existe, usar esa fila. **Su valor escalar = `m1`** (la fila `Mejor *` es típicamente la mejor maniobra consolidada).
   2. Si no hay fila `Mejor *`, usar la fila FEV1/FVC "estándar" (`fev1`, `fvc`, `fev1_l`, `fvc_l`). **Su valor escalar = `max(m1, m2, m3)`** entre las tres maniobras (mejor maniobra disponible — semántica ya documentada en `schemas/medical.py:208-212`: "mejor valor disponible").
   3. Si tampoco existe, el campo queda ausente y el gate cae al flujo actual (non-conclusive con la misma razón).
3. **Aliases válidos** (mínimo necesario, ampliar solo si el LLM emite variantes nuevas):

   | Campo destino | Keys/labels aceptados |
   |---|---|
   | `fev1` | `fev1`, `fev1_l`, `Mejor FEV1` (caso de mejor maniobra consolidada), `mejor_fev1`, `mejor_fev1_l` |
   | `fvc` | `fvc`, `fvc_l`, `Mejor FVC`, `mejor_fvc`, `mejor_fvc_l` |
   | `fev1_fvc_ratio` | `fev1_fvc`, `fev1_fvc_pct`, `mefv1_mfvc`, `fev1/fvc`, `fe1_fvc` |
   | `fev1_pct_ref` | `m1_pct_ref`/`m2_pct_ref`/`m3_pct_ref` de la fila `fev1`, o valor `pct_ref` directo si existe |
   | `fvc_pct_ref` | idem para `fvc` |

4. **Determinismo**: mismas entradas → mismas salidas. Sin timestamps, sin RNG, sin orden de iteración que dependa del backend de Python. Tests con fixture congelado verifican igualdad bit-a-bit.

### 4.2 Gate table-aware (Espirometría solamente)

Modificar `_check_minimum_params` (`prediagnostic.py:590-621`) **solo en la rama Espirometría**:

```
Para cada `param` en required (REQUIRED_PARAMS["Espirometria"] = ["fev1", "fvc"]):
    if extracted_data.get(param) truthy: pass
    else if extraer_de_parametros(extracted_data, param) truthy: pass
    else: missing.append(param)
```

- `extraer_de_parametros`: misma precedencia §4.1 (Mejor fila → estándar → `max(m1,m2,m3)`). Si devuelve valor escalar `> 0`, cuenta como presente.
- **Negativa del gate**: si no existe en raíz **ni** en `parametros[]` (con cualquier variante), sigue retornando `AI_NON_CONCLUSIVE` con el mismo reason. **El gate no se relaja**: la diferencia es dónde busca, no cuándo acepta.
- **Resto de tipos** (`Audiometria`, `Laboratorio`, `Rayos_X`, `Electrocardiograma`, `Somatometria`, `AgudezaVisual`): comportamiento actual, sin cambios. Test de control obligatorio (§7.4).

### 4.3 Aceptación de variantes sin sufijo en `_normalize_espirometria_result`

- Antes de comparar contra `_ESPIROMETRIA_CANONICAL_KEYS` (`extractor.py:150-155`), normalizar `key`:
  - `key_norm = key.lower().rstrip("_l").rstrip("_pct").rstrip("_l_s").rstrip("_s")` para variantes; o ampliar el frozenset con los buckets observados (`fev1`, `fvc`, `fev1_fvc`, `mejor_fev1`, `mejor_fvc`, `fef25_75`, `mefv1_mfvc`, `fet100`, `vext`, `edad_pulmon`).
- Decisión recomendada: **ampliar el frozenset** con los buckets (incluye `fev1`, `fvc`, `fev1_fvc`, `mejor_fev1`, `mejor_fvc`, `fef25_75`, `mefv1_mfvc`, `fet100`, `vext`, `edad_pulmon`). Mantiene `_ESPIROMETRIA_CANONICAL_KEYS` como fuente única de verdad y evita errores de normalización en runtime.
- Eliminar `SOSPECHA_MAPEO` cuando las keys sin sufijo son variantes semánticamente equivalentes (FEV1, FVC, FEV1/FVC, FEF25-75, FET100, Vext, Edad del pulmón, Mejor FEV1, Mejor FVC). Mantener `SOSPECHA_MAPEO` para keys genuinamente no canónicas (p. ej. typos, sin mapeo posible).

### 4.4 Mapeo defensivo `paciente` / `fecha_estudio`

En `_normalize_espirometria_result` (o wrapper previo al `EspirometriaData(**result)` en `extractor.py:865-906`):

- Si `result.get("paciente")` ausente y `result.get("paciente_detalle", {}).get("nombre_completo")` presente → `result["paciente"] = paciente_detalle.nombre_completo`.
- Si `result.get("fecha_estudio")` ausente y `result.get("estudio", {}).get("fecha_estudio")` presente → `result["fecha_estudio"] = estudio.fecha_estudio`.
- Esto evita la caída al dict crudo en `extractor.py:904-906` cuando el LLM emite los campos en sub-bloques en lugar de raíz.

### 4.5 Label UI de provider

- `PapeletaWorkspace.tsx:164` actualmente lee `AI_PIPELINE_STAGES` con texto "Extrayendo datos con Gemini" hardcodeado.
- Cambiar a derivar de `extraction_snapshot.audit.extraction_provider_used` si está disponible (mapping: `m3 → "Minimax"`, `gemini → "Gemini"`, default → "IA").
- Si el audit aún no está disponible en el momento del label (etapa temprana), usar texto neutro `"Extrayendo datos"` sin afirmar proveedor.
- **No afirmar Gemini** cuando el provider real es `m3`. Esto es un fix cosmético, no clínico; sin embargo, está en scope porque la auditoría FND-20260821-03 lo identificó como defecto secundario (S3) que confunde a Frank.

## 5. Datos y privacidad

- Cero PII persistida. Las pruebas usan el fixture sintético `context/RD2026/ESPIROMETRIA.pdf` (mismo expediente real del hallazgo, pero el backfill opera sobre `parametros[]` ya extraído — no se reintroduce PII al código).
- Cero secretos. Sin `.env`, sin credenciales.
- `context/datos AMI/**`: read-only, intacto.
- Backfill no introduce nuevos endpoints, no toca schema Prisma, no toca migraciones.

## 6. Casos borde y errores

| # | Caso | Comportamiento esperado |
|---|---|---|
| E1 | Fila `Mejor FEV1` existe pero `Mejor FVC` no | Backfill: `fev1` = m1 de `Mejor FEV1`; `fvc` = `max(m1,m2,m3)` de fila `fvc` estándar; gate: pasa |
| E2 | Solo existe fila `FVC` estándar, sin `Mejor FVC` | `fvc` = `max(m1,m2,m3)` de `fvc`; gate: pasa |
| E3 | Filas presentes pero `m1`, `m2`, `m3` todos `None` | Backfill no rellena; gate: cae a `AI_NON_CONCLUSIVE` con mismo reason |
| E4 | `parametros[]` está vacío o ausente | Backfill no opera; gate: cae a `AI_NON_CONCLUSIVE` con mismo reason |
| E5 | `key` con typo no mappable (p. ej. `fevi1`) | Backfill ignora; gate: cae a `AI_NON_CONCLUSIVE` con mismo reason |
| E6 | Fila con `m1_pct_ref` solo, sin `m1` | Backfill intenta `pct_ref` directo; si no, no rellena `fev1` |
| E7 | LLM emite variantes nuevas (p. ej. `mejorfev1` sin `_`) | Normalización lower+strip antes de matchear bucket |
| E8 | Audiometría con `oido_derecho`/`oido_izquierdo` en raíz | Gate sin cambios: sigue pasando por el camino actual |
| E9 | Laboratorio con `parametros` en raíz | Gate sin cambios: sigue pasando por el camino actual |
| E10 | `paciente_detalle` ausente y `paciente` ausente | Mapeo defensivo no opera; cae al flujo actual (Pydantic raise → except → dict crudo) |
| E11 | Label UI antes de que llegue el primer audit | Texto neutro `"Extrayendo datos"` sin provider |

## 7. Pruebas y criterios de aceptación (verificables)

### 7.1 Unitarias backend (`backend/tests/test_ai_pipeline.py` o nuevo archivo)

Cada test debe ejecutarse con `pytest -q <archivo>::<test>` y PASS.

| AC | Test | Comando | Resultado esperado |
|---|---|---|---|
| **AC-1.1** Gate table-aware Espirometría — fila FEV1 estándar sin `fev1` raíz | `test_check_minimum_params_espirometry_tableaware_basic` | `pytest -q backend/tests/test_ai_pipeline.py::test_check_minimum_params_espirometry_tableaware_basic` | `generate_prediagnosis` supera el gate; la llamada clínica es invocada (mock DR7/MedGemma verifica llamada) |
| **AC-1.2** Gate table-aware Espirometría — fila `Mejor FEV1` con m1 poblada | `test_check_minimum_params_espirometry_mejor_fila` | idem | Gate pasa; valor enviado a DR7 = m1 de la fila `Mejor FEV1` |
| **AC-1.3** Negativa: sin filas FEV1/FVC en raíz ni tabla | `test_check_minimum_params_espirometry_negative` | idem | `non_conclusive_reason = "Parámetros mínimos faltantes: fev1, fvc"` (sin cambios en reason) |
| **AC-2.1** Normalizador backfill `fev1`/`fvc` desde filas estándar (sin sufijo) | `test_normalize_espirometry_backfill_standard` | idem | `result["fev1"] = max(m1,m2,m3)` de fila `fev1`; `result["fvc"] = idem` de `fvc` |
| **AC-2.2** Normalizador backfill con `Mejor FEV1`/`Mejor FVC` con prioridad | `test_normalize_espirometry_backfill_mejor_priority` | idem | `result["fev1"] = m1` de `Mejor FEV1`; `result["fvc"] = m1` de `Mejor FVC` (prioridad sobre estándar) |
| **AC-2.3** Normalizador: variantes con sufijo (`fev1_l`/`fvc_l`) | `test_normalize_espirometry_backfill_with_suffix` | idem | Backfill funciona idéntico al AC-2.1 |
| **AC-2.4** Normalizador: `es_interpretable=true` y `completitud_documental=suficiente` con keys sin sufijo | `test_normalize_espirometry_quality_with_bare_keys` | idem | Derivaciones consistentes con la realidad clínica |
| **AC-2.5** Normalizador: `paciente`/`fecha_estudio` desde sub-bloques | `test_normalize_espirometry_paciente_fecha_from_subblocks` | idem | `result["paciente"] = paciente_detalle.nombre_completo`; `result["fecha_estudio"] = estudio.fecha_estudio` |
| **AC-3.1** Determinismo: dos corridas sobre mismo input → mismo output byte-a-byte | `test_normalize_espirometry_determinism` | idem | `result_1 == result_2` |
| **AC-4.1** Control Audiometría: comportamiento del gate sin cambios | `test_check_minimum_params_audiometria_unchanged` | idem | `oido_derecho`/`oido_izquierdo` siguen funcionando como antes |
| **AC-4.2** Control Laboratorio/Rayos_X/ECG/Somatometría/AgudezaVisual | `test_check_minimum_params_other_studies_unchanged` | idem | Reason idéntico al actual; sin tabla `parametros[]` consultada |
| **AC-5.1** `extraction_provider_used=m3` preservado (sin regresión del selector) | `test_extractor_provider_selector_unchanged` | idem | `audit.extraction_provider_used == "m3"` para input de espirometría |

### 7.2 E2E (reproducción del hallazgo FND-20260821-03)

| AC | Test | Comando | Resultado esperado |
|---|---|---|---|
| **AC-6.1** E2E real: subir `context/RD2026/ESPIROMETRIA.pdf` en EventTest Espirometría | (suite Playwright preexistente + nuevo caso) | `npm run test:e2e -- espirometry-gate-fix` | `prediagnosis_snapshot.clinical_state != AI_NON_CONCLUSIVE` con reason `"Parámetros mínimos faltantes: fev1, fvc"`. Con DR7 accesible, llega a `AI_PENDING_REVIEW` o non-conclusive por causa clínica, **nunca por el gate**. Precondición: `MEDGEMMA_ENABLED=true` y DR7 accesible. |

### 7.3 Frontend (label UI)

| AC | Test | Comando | Resultado esperado |
|---|---|---|---|
| **AC-7.1** Label UI refleja provider real | `vitest run frontend/src/components/.../PapeletaWorkspace.test.tsx` | `npx vitest run <archivo>` | Cuando `audit.extraction_provider_used == "m3"`, el label NO contiene "Gemini" (contiene "Minimax" o texto neutro). |

### 7.4 Gates backend

- `pytest -q backend/tests/test_ai_pipeline.py` → 0 fallos (los existentes + los nuevos).
- `pytest -q backend/tests/` (completo) → 0 regresiones (mismas baseline `M3_CREDENTIALS_UNAVAILABLE` esperadas).
- `tsc --noEmit` en backend (si aplica) → 0 errores.

### 7.5 Gates frontend (AC-7.1)

- `npm run typecheck` → 0 errores.
- `npx vitest run` (suite relacionada) → 0 fallos nuevos.
- `npm run lint` → 0 errores nuevos.

## 8. Validaciones detectadas

- `pytest` (backend)
- `npm run typecheck`, `npx vitest run`, `npm run lint` (frontend)
- `npx playwright test` o `npm run test:e2e` (E2E con DR7 mockeado o real, según AC-6.1)
- Hash de fixture: `sha256:6a94384df2fe66b8a187a5009bc47ad92d87f4f93d8942e1b181de12325de541` (mismo del hallazgo, byte-a-byte)
- Inspección visual (label UI): snapshot Playwright o revisión visual con captura del label

## 9. Rollback recomendado (no ejecución — sólo diseño)

- Cambios son código puro sin migración ni cambio de schema DB.
- Revertir el commit del fix (si Frank lo autoriza) restaura comportamiento previo.
- Los `StudyExtractionSnapshot` y `AIPrediagnosisSnapshot` ya persistidos son inmutables; el fix sólo afecta corridas nuevas. El expediente `8af728bf-…` puede regenerarse tras el fix vía re-subida o `regenerateStudyAI` (si Frank lo autoriza y existe el endpoint).
- Si el backfill produce valores incorrectos en producción (no detectado por tests), Frank puede revertir el commit y la cola de uploads vuelve al estado pre-fix sin pérdida de datos.

## 10. Riesgos y pendientes

- **Riesgo clínico (bajo)**: la precedencia §4.1 (Mejor fila → estándar → max(m1,m2,m3)) fija qué número ve DR7. Si ATLAS/SOFIA prefieren M1 fijo o la fila `Mejor *` literal, debe corregirse antes de implementar. Esta SPEC ya define la precedencia explícita; un cambio aquí requiere nueva revisión.
- **Riesgo de regresión (bajo)**: tests de control AC-4.1/4.2 verifican que otros tipos no se afectan. Si fallan, el gate table-aware debe condicionarse aún más (p. ej. por presencia de `parametros[]` Y `study_type == "Espirometria"`).
- **Riesgo cosmético (aceptado)**: el label UI se mantiene como cambio en scope para no propagar la mentira de "Gemini" en producción. Si GEMINI lo considera fuera de alcance por ser cosmético, se separa a unidad trivial independiente.
- **Pendiente para Frank (escalado por ATLAS, fuera de este fix)**: semántica de `enabled=false` en `aiCalibration.extraction` V1/V2 (§I del dictamen). Si Frank confirma que es decisión vigente, queda como está y el resolver V3 puede activarse por separado. Si Frank confirma que es inconsistencia, requiere fix funcional separado.

## 11. Definition of Done (DoD)

- AC-1.1, 1.2, 1.3 PASS.
- AC-2.1, 2.2, 2.3, 2.4, 2.5 PASS.
- AC-3.1 PASS.
- AC-4.1, 4.2 PASS (control regresión).
- AC-5.1 PASS.
- AC-6.1 PASS (E2E real con `context/RD2026/ESPIROMETRIA.pdf`).
- AC-7.1 PASS (label UI).
- Gates backend: pytest 0 fallos nuevos, typecheck 0, sin regresión.
- Gates frontend: typecheck 0, vitest 0 fallos nuevos, lint 0 nuevos.
- GEMINI PASS o PASS_WITH_WARNINGS (obligatorio por cambio de contrato — §15 INTEGRA).
- `context/datos AMI/**` intacto.
- Cero commit/push sin autorización Frank.
- Snapshot de `ExtractionSnapshot 8fad6571-…` sin cambios (inmutable).
- `PROYECTO.md` y `context/CURRENT.md` actualizados con cierre.

---

### Autoauditoría INTEGRA (pre-firma)

- No inventé decisión funcional: usé sólo evidencia del dictamen DEBY (FND-20260821-03) y código observado (`extractor.py`, `prediagnostic.py`, `schemas/medical.py`).
- No generé código fuente: esta SPEC contiene contratos, reglas, criterios, snippets de interfaz y ejemplos en markdown.
- Cumple DoR de arquitectura (§5 INTEGRA): fuente funcional + checkpoint identificados, problema/resultado claros, alcance dentro/fuera explícito, decisiones y reglas críticas con ID, casos borde enumerados, criterios verificables.
- Cumple DoR de implementación (§5 INTEGRA) por unidad: ID, prioridad, SPEC activa, referencias funcionales, resultado técnico, contratos afectados/protegidos, criterios AC verificables, dependencias disponibles, comandos de validación.
- GEMINI clasificado obligatorio (cambio de contrato soft entre extracción y gate; §15 INTEGRA).
- Límites respetados: no V3 published, no migración, no 422 Examen Médico, no `enabled` legacy, no `medical_test_id`.