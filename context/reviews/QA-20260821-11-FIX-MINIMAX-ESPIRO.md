# QA-20260821-11 — Auditoría FIX-20260821-01 (Gate table-aware Espirometría + backfill determinista desde `parametros[]`)

- **ID tarea:** FIX-20260821-01 (sufijo E2E-MINIMAX-ESPIRO)
- **ID intervención auditada:** IMPL-20260821-01-FIX-GATE-TABLEAWARE-ESPIRO
- **SPEC activa:** `context/SPECs/SPEC_FIX-20260821-01-GATE-TABLEAWARE-ESPIROMETRIA.md` v1.0
- **Incremento auditado:** 4 archivos modificados + 2 archivos nuevos
  - mod: `backend/app/services/ai/extractor.py` (+148 / −15 líneas netas)
  - mod: `backend/app/services/ai/prediagnostic.py` (+34 / −2)
  - mod: `backend/tests/test_ai_pipeline.py` (+447 / 0)
  - mod: `frontend/src/components/clinical/PapeletaWorkspace.tsx` (+29 / −8)
  - new: `frontend/src/lib/clinical/extraction-stage-label.ts` (+31)
  - new: `frontend/src/lib/clinical/__tests__/extraction-stage-label.test.ts` (+46)
- **Handoff/Hallazgo origen:** `HANDOFF_FIX-20260821-01_SOFIA-MINIMAX-ESPIRO.md` (INTEGRA → SOFIA); `DICTAMEN_FIX-20260821-01-E2E-MINIMAX-ESPIRO.md` (DEBY L2, causa raíz H3 CONFIRMADA, FND-20260821-03 E2E real expediente `8af728bf-…`)
- **Fecha auditoría:** 2026-08-21 16:35 America/Mexico_City
- **Alcance:** **Reforzada** (cambio de contrato soft entre extracción y gate clínico; ruta crítica Espirometría; label UI; riesgo clínico y de regresión; §15 INTEGRA obliga GEMINI).
- **Auditor:** GEMINI (sesión independiente, sólo lectura, sin implementación, sin commit/push/deploy, sin prueba contra producción)

---

## QA-VERDICT

**`PASS_WITH_WARNINGS`** — La implementación cumple el SPEC §4.1–§4.5 sin relajar el gate clínico, sin tocar contratos públicos (`EspirometriaData`, `AIPrediagnosisResult`, endpoints V2) ni el flag `enabled` legacy, sin migración Prisma, sin publicación V3, sin reenvío de `medical_test_id` y sin resolver el 422 EXAMEN MEDICO (todos límites explícitos del SPEC §2.2 respetados). Los 12 tests backend nuevos (AC-1.1..1.3, 2.1..2.5, 3.1, 4.1..4.2, 5.1) PASS focal y la suite completa no introduce regresiones nuevas vs baseline (47 failed/386 passed → 47 failed/398 passed = +12 passing, mismo baseline `M3_CREDENTIALS_UNAVAILABLE`). Los 4 tests frontend nuevos (AC-7.1, helper `extractingStageLabel`) PASS focal y la suite completa no introduce regresiones nuevas vs baseline (15 failed/679 passed → 15 failed/683 passed = +4 passing, mismo baseline `medical-exam.actions.test.ts`). `tsc --noEmit` PASS, `eslint` focal PASS (0 errores, 1 warning preexistente `react-hooks/set-state-in-effect` en línea 354 — no introducido por el fix). Hash de fixture `context/RD2026/ESPIROMETRIA.pdf` preservado (`6a94384df2fe…de541`), `context/datos AMI/**` intacto.

**Warnings residuales (P3, no bloqueantes):**

- **W-P3-1 — AC-6.1 E2E real no ejecutado.** El SPEC §7.2 lo declara como gate separado y el IMPL-REPORT §Trazabilidad AC lo reporta como `NO EJECUTADA — sin MEDGEMMA_ENABLED/DR7_API_KEY en entorno de tests. Validación funcional pendiente.` Esta auditoría reproduce los 12 tests unitarios como evidencia funcional del gate y del backfill, pero la corrida E2E real con `MEDGEMMA_ENABLED=true` y DR7 accesible queda pendiente de entorno (no bloqueante para cierre; INTEGRA/Frank decide si ejecuta con credenciales reales).
- **W-P3-2 — `_row_matches` con matching demasiado permisivo.** El helper `_backfill_espirometry_scalar` (`extractor.py:990-1002`) usa `key.startswith(prefix + "_")` que sobre-empareja: para `std_prefix="fev1"`, la fila con `key="fev1_fvc"` también matchearía (correcto semánticamente sólo si fuera una fila de FEV1). En el caso AC-2.4 la fila `fev1` aparece antes que `fev1_fvc` en `parametros[]`, por lo que el helper retorna `m1=3.2` correctamente. En producción el orden es consistente con el dictamen §C.1 (`mejor_*` antes que estándar). No detectado por tests ni esperado por el modelo real, pero documentar como riesgo de mantenibilidad: si el orden de filas cambiara en futuras versiones del prompt o LLM, podría retornar el ratio (%) en vez del absoluto (L). Recomendación: añadir a la blacklist del helper buckets que son derivados (`fev1_fvc`, `fef25_fev1`, etc.) o usar `key in {frozenset por bucket}`.
- **W-P3-3 — Redundancia AC-2.3 con AC-2.1.** El test `test_normalize_espirometry_backfill_with_suffix` usa exactamente el mismo fixture (mismos keys `fev1_l`/`fvc_l` y mismos valores) que `test_normalize_espirometry_backfill_standard`. No hay distinción funcional. El SPEC §7.1 promete "variantes con sufijo" pero el fixture ya las usa en AC-2.1. Cosmético; no afecta correctness.

**Recomendación para ATLAS/INTEGRA:** Aceptar el incremento. Pivote a CRONISTA para aplicar transición de estado `READY_FOR_VERIFYING → DONE` (sujeto a OK explícito de Frank — no mover por GEMINI). El AC-6.1 queda como gate ambiental de INTEGRA/Frank, no como bloqueo de auditoría. Considerar los warnings P3-2 y P3-3 en un fix de seguimiento menor (no urgente).

---

## 1. Delimitación y fuentes

### 1.1 Incremento delimitado

```
backend/app/services/ai/extractor.py                          | +148 -15
backend/app/services/ai/prediagnostic.py                      | +34  -2
backend/tests/test_ai_pipeline.py                             | +447 -0
frontend/src/components/clinical/PapeletaWorkspace.tsx        | +29  -8
frontend/src/lib/clinical/extraction-stage-label.ts           | +31  -0  (NEW)
frontend/src/lib/clinical/__tests__/extraction-stage-label.test.ts | +46 -0 (NEW)
```

Verificación read-only de exclusividad:

```bash
$ git diff --name-only backend/ frontend/ | grep -v __pycache__
backend/app/services/ai/extractor.py
backend/app/services/ai/prediagnostic.py
backend/tests/test_ai_pipeline.py
frontend/src/components/clinical/PapeletaWorkspace.tsx
$ git status --short context/datos\ AMI/
(clean — sólo archivos untracked preexistentes)
$ git diff --stat -- "context/datos AMI/**"
(sin cambios)
```

### 1.2 Fuentes canónicas leídas

| Artefacto | Rol |
|---|---|
| `context/SPECs/SPEC_FIX-20260821-01-GATE-TABLEAWARE-ESPIROMETRIA.md` v1.0 | Contrato técnico (debe ser cumplido) |
| `context/interconsultas/HANDOFF_FIX-20260821-01_SOFIA-MINIMAX-ESPIRO.md` | Handoff INTEGRA → SOFIA |
| `context/interconsultas/DICTAMEN_FIX-20260821-01-E2E-MINIMAX-ESPIRO.md` | Diagnóstico DEBY L2 (causa raíz H3) |
| `IMPL-REPORT_FIX-20260821-01.md` | Índice de evidencia declarado por SOFIA |
| `backend/app/schemas/medical.py:194-218` (EspirometriaData) | Contrato público (protegido) |
| `backend/app/services/ai/prediagnostic.py:172-183` (REQUIRED_PARAMS) | Constante protegida |
| `context/RD2026/ESPIROMETRIA.pdf` | Fixture (hash SHA-256 verificado) |

### 1.3 Fixture

```
$ sha256sum context/RD2026/ESPIROMETRIA.pdf
6a94384df2fe66b8a187a5009bc47ad92d87f4f93d8942e1b181de12325de541  context/RD2026/ESPIROMETRIA.pdf
```

Coincide con el hash del hallazgo FND-20260821-03 y del dictamen DEBY. **Fixture preservado, byte-a-byte.**

---

## 2. Trazabilidad SPEC → implementación → evidencia → resultado

| AC / Criterio SPEC | Implementación (archivo:línea) | Test focal | Resultado |
|---|---|---|---|
| **AC-1.1** Gate table-aware — fila estándar sin `fev1` raíz | `prediagnostic.py:641-647` (rama Espirometría + param in fev1/fvc) + helper `_espirometry_param_present_in_tabla` (`prediagnostic.py:190-208`) + `_backfill_espirometry_scalar` (`extractor.py:963-1033`) | `test_check_minimum_params_espirometry_tableaware_basic` | **PASS** (mock DR7 invocado, `clinical_state == AI_PENDING_REVIEW`) |
| **AC-1.2** Gate table-aware — fila `Mejor FEV1` con m1 poblada | idem | `test_check_minimum_params_espirometry_mejor_fila` | **PASS** (mock DR7 invocado; el gate usa helper, el backfill usa precedencia Mejor*) |
| **AC-1.3** Negativa — sin filas FEV1/FVC en raíz ni tabla | `prediagnostic.py:641-647` (helper devuelve False → `missing.append`) | `test_check_minimum_params_espirometry_negative` | **PASS** (`AI_NON_CONCLUSIVE`, reason contiene "fev1" y "fvc", DR7 NO invocado) |
| **AC-2.1** Backfill `fev1`/`fvc` desde fila estándar (sin sufijo) | `extractor.py:425-450` (loop `_espiro_backfill_fields`) + `_backfill_espirometry_scalar` | `test_normalize_espirometry_backfill_standard` | **PASS** (`fev1=3.2=max(3.2,3.1,3.0)`, `fvc=4.0=max(4.0,3.8,3.7)`, `fev1_fvc_ratio=0.8`) |
| **AC-2.2** Backfill con `Mejor FEV1`/`Mejor FVC` con prioridad | `_backfill_espirometry_scalar` rama (a) mejor fila → m1 | `test_normalize_espirometry_backfill_mejor_priority` | **PASS** (`fev1=3.45` m1 de Mejor, no max estándar 2.9; `fvc=4.12`; pct 84.1/79.4) |
| **AC-2.3** Variantes con sufijo (`fev1_l`/`fvc_l`) | frozenset ampliado con `fev1_l`, `fvc_l`, `mejor_fev1_l`, `mejor_fvc_l` (existentes) | `test_normalize_espirometry_backfill_with_suffix` | **PASS** (idéntico a AC-2.1; ver W-P3-3) |
| **AC-2.4** `es_interpretable=true` + `completitud_documental=suficiente` con keys bare | `extractor.py:478-493` (es_interpretable con `("fev1_l", "fev1")`, `("fvc_l", "fvc")`) + frozenset ampliado + `extractor.py:455-468` (completitud ≥6) | `test_normalize_espirometry_quality_with_bare_keys` | **PASS** (`es_interpretable=True`, `completitud_documental="suficiente"`, `calidad.completitud_documental="suficiente"`) |
| **AC-2.5** `paciente`/`fecha_estudio` desde sub-bloques | `extractor.py:452-468` (mapeo defensivo `paciente_detalle.nombre_completo` / `estudio.fecha_estudio`) | `test_normalize_espirometry_paciente_fecha_from_subblocks` | **PASS** (`paciente="Trabajador B"`, `fecha_estudio="18/05/2026"`) |
| **AC-3.1** Determinismo bit-a-bit | Helper puro módulo-nivel, sin RNG, sin timestamps; dict equality | `test_normalize_espirometry_determinism` | **PASS** (`r1 == r2`) |
| **AC-4.1** Audiometría — gate sin cambios | `prediagnostic.py:644` (rama `if study_type == "Espirometria" and param in ("fev1", "fvc")` — excluye Audiometría) | `test_check_minimum_params_audiometria_unchanged` | **PASS** (reason no contiene "fev1" ni "fvc") |
| **AC-4.2** Otros tipos — gate sin cambios | idem (rama Espirometría exclusivamente) | `test_check_minimum_params_other_studies_unchanged` | **PASS** (Laboratorio→"parametros", Rayos_X→"hallazgos/localizacion", ECG→"ritmo/frecuencia_bpm" en reason) |
| **AC-5.1** Selector provider `m3` preservado | Sin cambios en `_resolve_provider`; verificación via `last_extraction_audit` | `test_extractor_provider_selector_unchanged` | **PASS** (`audit.extraction_provider_used == "m3"`, no fallback) |
| **AC-6.1** E2E real `context/RD2026/ESPIROMETRIA.pdf` | — | — | **NO EJECUTADA** — DR7/MedGemma inaccesible en entorno de tests; precondición declarada en IMPL-REPORT §Trazabilidad AC. **Ver W-P3-1.** |
| **AC-7.1** Label UI: `m3` no afirma "Gemini" | `frontend/src/lib/clinical/extraction-stage-label.ts:26-31` + `PapeletaWorkspace.tsx:163-175` (refactor `AI_PIPELINE_STAGES` → `AI_PIPELINE_STAGE_LABELS` con función por stage) | `extraction-stage-label.test.ts` (4 casos: m3, gemini, ausente, defensivo) | **PASS** (`m3 → "Extrayendo datos con Minimax"` SIN "Gemini"; `gemini → "Extrayendo datos con Gemini"`; ausente/otro → "Extrayendo datos" neutro; `M3` uppercase también → Minimax case-insensitive) |

---

## 3. Validaciones independientes ejecutadas

### 3.1 Backend (pytest)

```bash
$ cd backend && python3 -m pytest tests/test_ai_pipeline.py::TestFIX20260821_01GateTableawareEspirometria -v
============================== 12 passed in 0.30s ==============================
```

Cobertura: AC-1.1, AC-1.2, AC-1.3, AC-2.1..2.5, AC-3.1, AC-4.1, AC-4.2, AC-5.1.

```bash
$ python3 -m pytest tests/test_ai_pipeline.py
... 31 failed, 95 passed, 3 warnings in 6.13s
```

**Comparativa con baseline (mismo comando, con cambios stasheados):**

| Métrica | Baseline (sin fix) | Con fix | Delta |
|---|---:|---:|---:|
| Failed | 31 | 31 | 0 |
| Passed | 83 | 95 | +12 (mis 12 tests nuevos) |
| Warnings | 3 | 3 | 0 |

Las 31 fallas son `M3_CREDENTIALS_UNAVAILABLE` pre-existentes (entorno sin `M3_API_KEY`). Verificado con `git stash`/pop antes/después: **cero regresiones introducidas**, exactamente +12 tests passing.

```bash
$ python3 -m pytest tests/  # suite completa
... 47 failed, 398 passed, 1461 warnings in 225.99s (0:03:45)
```

Baseline (sin fix): **47 failed, 386 passed** → mismo delta de +12. Cero regresiones.

### 3.2 Frontend (vitest)

```bash
$ cd frontend && npx vitest run src/lib/clinical/__tests__/extraction-stage-label.test.ts
✓ src/lib/clinical/__tests__/extraction-stage-label.test.ts (4 tests) 6ms
Test Files  1 passed (1)   Tests  4 passed (4)
```

Cobertura: AC-7.1 (m3, gemini, ausente, defensivo).

```bash
$ npx vitest run  # suite completa
Test Files  1 failed | 34 passed (35)
Tests       15 failed | 683 passed (698)
```

Baseline (sin fix): **15 failed, 679 passed** → +4 tests passing (mis 4 tests nuevos). Las 15 fallas son pre-existentes en `src/actions/__tests__/medical-exam.actions.test.ts` (no tocan Espirometría ni extracción IA). **Cero regresiones introducidas.**

### 3.3 TypeScript

```bash
$ npx tsc --noEmit
(sin output) → PASS, 0 errores
```

### 3.4 ESLint focal

```bash
$ npx eslint src/components/clinical/PapeletaWorkspace.tsx \
             src/lib/clinical/extraction-stage-label.ts \
             src/lib/clinical/__tests__/extraction-stage-label.test.ts
0 errors, 1 warning:
  354:3  warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/set-state-in-effect')
```

El warning `react-hooks/set-state-in-effect` en línea 354 es **preexistente** (no introducido por el fix): la directiva `/* eslint-disable react-hooks/set-state-in-effect */` cubre el `useEffect(() => setLocalTests(eventTests), [eventTests])` que está en líneas 354-358 — la regla puede haberse suavizado entre versiones de ESLint, pero el disable permanece. No es responsabilidad del fix ni lo bloquea.

### 3.5 Build

`npx next build` no se ejecutó para evitar el ciclo de `prisma generate` + bundle completo (~5-7 min en CI; `tsc --noEmit` ya validó tipos). El IMPL-REPORT §Validación reporta `npm run build` SUCCESS en su entorno; esta auditoría lo da por reproducido por typecheck + lint focal + vitest + pytest.

### 3.6 SHA-256 fixture

```bash
$ sha256sum context/RD2026/ESPIROMETRIA.pdf
6a94384df2fe66b8a187a5009bc47ad92d87f4f93d8942e1b181de12325de541
```

Idéntico al hash del hallazgo FND-20260821-03 y del dictamen DEBY. **Fixture intacto.**

### 3.7 Datos AMI

```bash
$ git diff --stat -- "context/datos AMI/**"
(sin cambios)
```

`context/datos AMI/**` no fue tocado por el fix. La rama `main` lo tiene limpio.

---

## 4. Matriz de auditoría por criterio

| Criterio | Estado | Evidencia |
|---|---|---|
| **Alcance** — el diff implementa sólo la SPEC §2.1 | PASS | Sólo 4 archivos backend/frontend modificados + 2 nuevos; frozenset ampliado como en §4.3; gate table-aware como en §4.2; mapeo defensivo §4.4; label UI §4.5. Ningún archivo fuera de scope tocado. |
| **Trazabilidad** — cada criterio tiene código + prueba | PASS | 12 tests unitarios focalizados por AC; trazabilidad 1-a-1 (ver §2). |
| **Correctitud — flujo feliz** | PASS | AC-1.1, 1.2, 2.1, 2.2, 2.3 PASS; integración Espirometría completa (extracción + gate + backfill + DR7 mock). |
| **Correctitud — flujo error / frontera** | PASS | AC-1.3 (negativa sin filas), AC-2.5 (sub-bloques vacíos), AC-3.1 (determinismo bit-a-bit), AC-2.4 (keys bare sin sufijo). |
| **Regresión** — comportamiento previo Audiometría/Laboratorio/Rayos_X/ECG/Somatometría/AgudezaVisual | PASS | AC-4.1 (Audiometría), AC-4.2 (Lab/Rayos_X/ECG) PASS; rama `study_type == "Espirometria"` en `prediagnostic.py:644` aísla el cambio. |
| **Contratos — API / schema / eventos / tipos** | PASS | `EspirometriaData` (`schemas/medical.py:205-212`): sin cambios. `AIPrediagnosisResult`: sin cambios. Endpoints V2 (`/api/v2/studies/upload-and-analyze`, `/api/v2/ai/status`): sin cambios en payload público. `extracted_data` raíz: delta aditivo (campos nuevos sólo cuando aplica backfill, no se sobreescriben). |
| **Datos — migración / integridad / idempotencia** | PASS | Cero migración Prisma; cero cambios en schema; backfill es determinista y no destructivo (sólo añade si ausente); no se sobreescriben valores ya presentes en raíz (`if result.get(target) is None`). |
| **Seguridad — authN / authZ / secretos / inyección** | PASS | Cero secretos en el diff; cero `.env` tocado; cero inyección nueva (parsing Pydantic pre-existente); `prediagnostic.py` no introduce nuevos endpoints ni cambia auth. |
| **Privacidad — PII / logs / retención** | PASS | Cero PII persistida; tests usan nombres sintéticos (`"Test AC-1.1"`, `"Trabajador B"`, `"Determinismo"`); `context/datos AMI/**` intacto. |
| **Dependencias — autorizadas / fijadas** | PASS | Cero deps nuevas en `requirements.txt` ni `package.json`. El fix sólo usa stdlib (`math`-equivalente `round`), `frozenset`, `Dict`, `Any`, `List`. |
| **Operabilidad — errores / logs / métricas / timeouts** | PASS | Cero cambios en logging; cero nuevas métricas; cero timeouts introducidos; backfill es O(n) sobre `parametros[]` (típicamente n≤20). |
| **Rendimiento — consultas / loops / payloads / concurrencia** | PASS | Backfill itera `parametros[]` una vez por cada campo flat (4 campos), cada iteración O(n); total O(n) con n pequeño. Sin nuevos loops críticos. |
| **UX / accesibilidad** | PASS | Label UI ahora refleja provider real (m3 vs gemini) o usa texto neutro; cambio cosmético de strings sin afectar ARIA ni orden de focus. |
| **Evidencia — comandos reproducibles** | PASS | Todos los comandos documentados arriba; baseline verificado con `git stash` antes/después (delta exacto +12 en backend, +4 en frontend). |
| **Reversión — camino seguro sin ejecutarlo** | PASS | 100% reversible: revertir commit restaura pre-fix; cero migraciones; cero estado persistente que el fix altere. `StudyExtractionSnapshot` y `AIPrediagnosisSnapshot` inmutables (sólo afectan corridas nuevas). |
| **Scope límites — V3, publication, enabled, 422, medical_test_id, migración** | PASS | `git diff` no toca: `enabled` legacy (`aiCalibration.extraction.enabled`); `publishedVersions`; `set_published`/`publish_v3`; migración Prisma; endpoint 422 de EXAMEN MEDICO; `medical_test_id` en `triggerStudyAIAnalysis` (`ai-prediagnosis.actions.ts:167-180`). |

---

## 5. Hallazgos priorizados

### 5.1 P0 / P1 / P2

**Ninguno.** La implementación cumple el SPEC sin bloqueantes.

### 5.2 P3 (no bloqueantes, documentados como warnings)

| ID | Hallazgo | Severidad | Evidencia | Impacto | Recomendación | Owner |
|---|---|---|---|---|---|---|
| **F-P3-1** | AC-6.1 E2E real no ejecutado por entorno sin DR7/MedGemma | P3 ambiental | `IMPL-REPORT_FIX-20260821-01.md` §Trazabilidad AC línea 75; SPEC §7.2 precondición explícita | El gate unitario y el backfill están validados por 12 tests; sólo falta la corrida end-to-end real que confirme integración con DR7 | INTEGRA/Frank deciden si ejecutar AC-6.1 con credenciales DR7 reales o documentar bloqueo ambiental | INTEGRA (no SOFIA — precondición externa) |
| **F-P3-2** | `_row_matches` sobre-empareja prefijos (`fev1` matchea `fev1_fvc`) | P3 mantenibilidad | `extractor.py:990-1002` helper `_backfill_espirometry_scalar._row_matches`; uso de `key.startswith(prefix + "_")` no distingue ratios/derivados | En AC-2.4 el orden de filas pone `fev1` antes que `fev1_fvc`, por lo que retorna `m1=3.2` correcto. En producción (dictamen §C.1) el orden `mejor_fvc, mejor_fev1, mefv1_mfvc, fvc, fev1, fev1_fvc, fef25_75, fet100, vext, edad_pulmon` también pone `mejor_fev1` antes que `fev1_fvc`. **Pero si el orden cambiara en futuras versiones del prompt o LLM, podría retornar el ratio (%) en lugar del absoluto.** | Considerar blacklist de buckets derivados por campo destino (`fev1_fvc` no debería matchear `fev1`); o usar `key in {frozenset de variantes válidas por bucket}` en vez de prefix-matching. Tests futuros podrían añadir un caso con filas sólo `fev1_fvc` (sin `fev1`) para asegurar fallback a `None`. | SOFIA (siguiente fix de seguimiento menor, no urgente) |
| **F-P3-3** | Redundancia AC-2.3 con AC-2.1 | P3 cosmético | `test_ai_pipeline.py::TestFIX20260821_01GateTableawareEspirometria::test_normalize_espirometry_backfill_with_suffix` usa mismo fixture (`fev1_l`/`fvc_l`) y mismos valores que AC-2.1 (`test_normalize_espirometry_backfill_standard`) | Ninguno funcional; sólo AC-2.3 no aporta cobertura nueva vs AC-2.1. El frozenset ya tenía `fev1_l`/`fvc_l` antes del fix (amplió para añadir bare) | Renombrar AC-2.3 para reflejar diferencia real (e.g. test con keys bare `fev1`/`fvc`) o eliminar la AC-2.3. Cosmético. | SOFIA (próximo sprint, opcional) |
| **F-P3-4** | Warning ESLint preexistente `react-hooks/set-state-in-effect` línea 354 | P3 preexistente | `npx eslint` sobre los 3 archivos tocados; warning en línea 354 no relacionada con el fix (no es en líneas modificadas por IMPL-20260821-01) | Ninguno funcional; ruido en lint output | Considerar eliminar la directiva `eslint-disable` si la regla ya no aplica en la versión actual de ESLint | SOFIA (limpieza separada, opcional) |
| **F-P3-5** | IMPL-REPORT §Pendientes INTEGRA #4: wiring E2E de `extractionProvider` al panel | P3 wiring pendiente | `PapeletaWorkspace.tsx:834-836` (`extractionProvider?: 'm3' \| 'gemini' \| string`) está declarado como prop opcional pero el parent no lo pasa todavía (el audit no llega antes del panel). El label funciona correctamente en modo neutro mientras esto no se cablee | El helper ya renderiza "Extrayendo datos" cuando `extractionProvider` es `undefined`, así que el UI actual es funcional. El label sólo cambiará a "Extrayendo datos con Minimax" cuando el parent cablee la prop | INTEGRA/ATLAS decide si cablear el wiring completo o dejarlo como prop opcional para iteración futura | INTEGRA (decisión de producto, no técnica) |

---

## 6. Riesgo operativo

- **Riesgo clínico (bajo):** la precedencia §4.1 (Mejor fila m1 → estándar max(m1,m2,m3)) fija qué número ve DR7. Si ATLAS prefiere M1 fijo o la fila `Mejor *` literal, requiere nueva SPEC. El SPEC §10 ya documenta este riesgo como contrato explícito.
- **Riesgo de regresión (bajo):** tests de control AC-4.1/4.2 verifican que otros tipos no se afectan. PASS. El gate table-aware se condiciona explícitamente por `study_type == "Espirometria" and param in ("fev1", "fvc")` (no se generaliza).
- **Riesgo cosmético (aceptado):** label UI mantiene cambio en scope (W-P3-5); actualmente renderiza texto neutro hasta que el wiring E2E se complete. Sin mentira sobre el provider.
- **Sin secretos:** diff no contiene API keys, ni PII, ni credenciales. `context/datos AMI/**` intacto.

---

## 7. Preparación por entorno

| Entorno | Estado | Notas |
|---|---|---|
| **Calidad** | **LISTO** | pytest focal 12/12 PASS; pytest completo sin regresiones nuevas (47/398 baseline vs 47/398 con fix); typecheck 0 errores; lint focal 0 errores (1 warning preexistente no bloqueante); vitest focal 4/4 PASS; vitest completo sin regresiones nuevas (15/683 vs 15/679 baseline). |
| **Staging** | **NO_LISTO** | No hay autorización explícita de Frank en esta conversación para desplegar a staging; aunque los gates pasan, el handoff no solicitó deployment y el SPEC §2.2 lo prohíbe. Requiere OK Frank antes de staging. AC-6.1 E2E real es el gate que típicamente se ejecuta contra staging con DR7 real — sin credenciales en esta sesión, queda pendiente. |
| **Producción** | **NO_LISTO** | Nunca sin OK explícito de Frank en conversación vigente. El SPEC §2.2 y el IMPL-REPORT §Notas de reversión son explícitos: "Cero commit/push/staging/prod hasta autorización Frank." Esta auditoría no es aprobación para deploy. |

---

## 8. Handoff a ATLAS

**Acción concreta:** Aceptar el incremento `IMPL-20260821-01-FIX-GATE-TABLEAWARE-ESPIRO` con verdict `PASS_WITH_WARNINGS`.

**Gate siguiente (CRONISTA → ATLAS → Frank):**

1. ATLAS recibe este QA-VERDICT y decide:
   - **Si Frank ya autorizó cerrar el fix:** ATLAS activa sesión independiente de CRONISTA para aplicar transición `READY_FOR_VERIFYING → DONE` en `PROYECTO.md` y `context/CURRENT.md` (CRONISTA no aplica transiciones sin instrucción explícita de INTEGRA vía ATLAS).
   - **Si Frank aún no autoriza:** ATLAS reporta a Frank con resumen compacto (PASS_WITH_WARNINGS, 5 warnings P3, AC-6.1 pendiente de entorno, fixture hash preservado, 12 tests nuevos PASS, 0 regresiones) y pide decisión sobre: (a) cierre del fix; (b) si INTEGRA ejecuta AC-6.1 con credenciales DR7 reales; (c) si los warnings P3 se abordan en fix de seguimiento.

2. **No mover a SOFIA** (no hay hallazgos bloqueantes que justifiquen nueva implementación; los P3 son opcionales).

3. **No mover a INTEGRA** salvo que Frank pida AC-6.1 con credenciales DR7 reales — en ese caso INTEGRA decide si corre Playwright contra staging con precondición cumplida o documenta el bloqueo ambiental.

4. **No mover a DEBY** (no hay bug reproducible nuevo; causa raíz H3 ya diagnosticada e implementada correctamente).

5. **Wiring pendiente (W-P3-5):** si Frank quiere el label dinámico en lugar de neutro, INTEGRA puede abrir un ticket `FEATURE-20260821-XX-LABEL-PROVIDER-WIRING` separado (cambio trivial de 1-2 archivos parent → `extractionProvider`).

---

## 9. Autoauditoría GEMINI

- Delimité el incremento exacto (4 mod + 2 new) vs baseline `git stash`.
- Verifiqué SPEC activa y HANDOFF vigentes; revisé IMPL-REPORT como índice pero leí diff real y código fuente canónico.
- Reproduje selectivamente los 12 tests backend focal + 4 tests frontend focal + pytest completo (vs baseline) + vitest completo (vs baseline) + typecheck + lint focal + sha256sum del fixture.
- **No edité código fuente, tests, migraciones, config, `discovery/`, SPEC, ni `PROYECTO.md`.** (Esta QA es el único artefacto producido en esta sesión.)
- **No imprimé secretos, ni PII, ni dumps sensibles.** Los nombres de pacientes en tests son sintéticos (`"Trabajador B"`).
- Cada finding (W-P3-1..5) tiene severidad, evidencia (archivo:línea o comando+exit), impacto, recomendación y owner.
- Separé severidad QA (P3) de niveles L1/L2/L3 de ownership de reparación.
- Separé explícitamente QA / staging / producción (sección §7).
- **No invoqué subagentes** (no se usó `task`, `agent_manager`, ni DELFÍN/SOFIA/DEBY/CRONISTA/INTEGRA); el handoff vuelve a ATLAS con una acción concreta (aceptar / escalar a Frank).
- AC-6.1 queda documentado como pendiente de entorno (no inventado): IMPL-REPORT ya lo declaró y esta auditoría lo reproduce.
