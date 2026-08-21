# IMPL-REPORT — FIX-20260821-01: Gate table-aware Espirometría + backfill determinista desde `parametros[]`

```
ID intervención: IMPL-20260821-01-FIX-GATE-TABLEAWARE-ESPIRO
ID tarea: FIX-20260821-01
Estado: READY_FOR_VERIFYING
SPEC: context/SPECs/SPEC_FIX-20260821-01-GATE-TABLEAWARE-ESPIROMETRIA.md v1.0
Discovery refs: FND-20260821-03 (E2E real Playwright expediente 8af728bf-f572-47c3-94b7-31aa9916a4b8); DICTAMEN_FIX-20260821-01-E2E-MINIMAX-ESPIRO (DEBY L2, causa raíz H3 CONFIRMADA, 5/5 hipótesis evaluadas)
```

---

## Archivos modificados

- `backend/app/services/ai/extractor.py` — frozenset `_ESPIROMETRIA_CANONICAL_KEYS` ampliado con buckets bare (`fev1`/`fvc`/`mejor_fev1`/`mejor_fvc`/`fef25_75`/`fef25`/`fef50`/`fef75`/`fet100`/`vext`/`edad_pulmon`/`fev1_fvc`/`fev1_fvc_ratio`); helper módulo-nivel `_backfill_espirometry_scalar` (precedencia Mejor * m1 → estándar max(m1,m2,m3), determinista, puro); `_normalize_espirometria_result` aplica backfill a `fev1`/`fvc`/`fev1_percent_predicho`/`fvc_percent_predicho` cuando ausentes en raíz (no sobreescribe), deriva `fev1_fvc_ratio` post-backfill, mapeo defensivo `paciente`/`fecha_estudio` desde sub-bloques, derivación `es_interpretable` ampliada a bare+con sufijo.
- `backend/app/services/ai/prediagnostic.py` — helper módulo-nivel `_espirometry_param_present_in_tabla` (reutiliza `_backfill_espirometry_scalar` con misma precedencia); `_check_minimum_params` consulta `parametros[]` SOLO en rama Espirometría para `fev1`/`fvc`, resto de tipos comportamiento idéntico.
- `backend/tests/test_ai_pipeline.py` — nueva clase `TestFIX20260821_01GateTableawareEspirometria` con 12 tests (AC-1.1..1.3, AC-2.1..2.5, AC-3.1, AC-4.1..4.2, AC-5.1).
- `frontend/src/components/clinical/PapeletaWorkspace.tsx` — `AI_PIPELINE_STAGES` ya no carga label hardcodeado "Gemini"; labels derivan del provider vía `extractingStageLabel`; nuevo prop opcional `extractionProvider` en `UploadProgressPanel`; `s.label` resuelto por `AI_PIPELINE_STAGE_LABELS[s.id](extractionProvider)`.

## Archivos nuevos

- `frontend/src/lib/clinical/extraction-stage-label.ts` — helper exportable con la lógica de derivación de label por provider (m3 → "Minimax", gemini → "Gemini", ausente/otro → "Extrayendo datos").
- `frontend/src/lib/clinical/__tests__/extraction-stage-label.test.ts` — vitest AC-7.1 (4 casos: m3, gemini, ausente, defensivo).

## Contratos

- **Cambian (delta soft):**
  - `extracted_data` raíz Espirometría: aditivo — nuevos `fev1`/`fvc`/`fev1_fvc_ratio`/`fev1_percent_predicho`/`fvc_percent_predicho` por backfill desde `parametros[]` cuando ausentes en raíz.
  - `extracted_data.es_interpretable` / `.completitud_documental`: corrección de falso negativo cuando hay FEV1/FVC en tabla con variantes bare.
  - `prediagnosis_snapshot.non_conclusive_reason`: ya no emite `"Parámetros mínimos faltantes: fev1, fvc"` cuando las filas existen en tabla.
  - `AI_PIPELINE_STAGES` label: deriva de provider real o texto neutro.

- **Protegidos (NO TOCADOS):**
  - `REQUIRED_PARAMS` (`prediagnostic.py:172-181`) — constante sin cambios.
  - `EspirometriaData` Pydantic (`schemas/medical.py:205-212`) — sin cambios.
  - `AIPrediagnosisResult` — sin cambios.
  - Endpoints V2 (`/api/v2/studies/upload-and-analyze`, `/api/v2/ai/status`) — sin cambios en payload público.
  - Schema Prisma — sin cambios (cero migración).
  - `aiCalibration.extraction.enabled` flag legacy — sin cambios.
  - `medical_test_id` en `triggerStudyAIAnalysis` (`ai-prediagnosis.actions.ts:167-180`) — sin cambios.
  - Audiometría, Laboratorio, Rayos_X, ECG, Somatometría, AgudezaVisual: comportamiento idéntico (AC-4.1/4.2 PASS).
  - `ExtractionSnapshot 8fad6571-ccc1-4d12-9569-49b23037bd33` — inmutable.
  - `context/datos AMI/**` — read-only, intacto.

---

## Validación

| Gate | Comando | Resultado |
|---|---|---|
| Backend unitarias focal | `cd backend && python3 -m pytest tests/test_ai_pipeline.py -k "FIX20260821_01GateTableawareEspirometria"` | **PASS** 12/12 (AC-1.1..1.3, 2.1..2.5, 3.1, 4.1, 4.2, 5.1) |
| Backend suite completa | `cd backend && python3 -m pytest tests/test_ai_pipeline.py` | **0 regresiones nuevas**: 31 fallos preexistentes `M3_CREDENTIALS_UNAVAILABLE` (sin M3_API_KEY en test env) idénticos a baseline (verificado con `git stash` antes/después: 31 failed/83 passed → 31 failed/95 passed; +12 = mis 12 nuevos). |
| Backend typecheck | N/A (Python sin tsc) | N/A |
| Frontend typecheck | `cd frontend && npx tsc --noEmit` | **PASS** 0 errores |
| Frontend vitest focal | `cd frontend && npx vitest run src/lib/clinical/__tests__/extraction-stage-label.test.ts` | **PASS** 4/4 (AC-7.1) |
| Frontend vitest suite | `cd frontend && npx vitest run` | **0 regresiones nuevas**: 15 fallos preexistentes en `medical-exam.actions.test.ts` (verificado antes/después con `git stash`: 15 failed/683 passed → 15 failed/687 passed; +4 = mis 4 nuevos) |
| Frontend lint focal | `cd frontend && npx eslint src/components/clinical/PapeletaWorkspace.tsx src/lib/clinical/extraction-stage-label.ts src/lib/clinical/__tests__/extraction-stage-label.test.ts` | **PASS** 0 errores (1 warning preexistente `react-hooks/set-state-in-effect` sin relación con mi cambio) |
| Frontend build | `cd frontend && npx next build` | **SUCCESS** (compila completo, 0 errores) |
| Determinismo (AC-3.1) | `_backfill_espirometry_scalar` + `_normalize_espirometria_result` | PASS — `r1 == r2` para mismo input |

## Trazabilidad AC

- **AC-1.1** (`test_check_minimum_params_espirometry_tableaware_basic`): PASS — gate pasa con filas estándar en tabla, DR7 invocado.
- **AC-1.2** (`test_check_minimum_params_espirometry_mejor_fila`): PASS — Mejor fila en tabla, gate pasa.
- **AC-1.3** (`test_check_minimum_params_espirometry_negative`): PASS — sin filas, gate cae a `AI_NON_CONCLUSIVE` con mismo reason.
- **AC-2.1** (`test_normalize_espirometry_backfill_standard`): PASS — `fev1 = max(3.2, 3.1, 3.0) = 3.2`, `fvc = max(4.0, 3.8, 3.7) = 4.0`.
- **AC-2.2** (`test_normalize_espirometry_backfill_mejor_priority`): PASS — `fev1 = 3.45` (m1 de Mejor FEV1, no max estándar 2.9), `fvc = 4.12`, `_percent_predicho` también correctos (84.1, 79.4).
- **AC-2.3** (`test_normalize_espirometry_backfill_with_suffix`): PASS — sufijo `_l` aceptado idénticamente.
- **AC-2.4** (`test_normalize_espirometry_quality_with_bare_keys`): PASS — `es_interpretable=True`, `completitud_documental=suficiente` con bare keys.
- **AC-2.5** (`test_normalize_espirometry_paciente_fecha_from_subblocks`): PASS — `paciente` y `fecha_estudio` mapeados desde sub-bloques.
- **AC-3.1** (`test_normalize_espirometry_determinism`): PASS — `r1 == r2` para input idéntico.
- **AC-4.1** (`test_check_minimum_params_audiometria_unchanged`): PASS — Audiometría con `oido_derecho`/`oido_izquierdo` en raíz, gate pasa.
- **AC-4.2** (`test_check_minimum_params_other_studies_unchanged`): PASS — Laboratorio, Rayos_X, ECG mantienen reasons originales; Espirometría no afecta a otros tipos.
- **AC-5.1** (`test_extractor_provider_selector_unchanged`): PASS — `extraction_provider_used == "m3"` con mock M3.
- **AC-6.1** (E2E real con `context/RD2026/ESPIROMETRIA.pdf`): **NO EJECUTADA — `Ejecución: NO EJECUTADA — sin MEDGEMMA_ENABLED/DR7_API_KEY en entorno de tests. Validación funcional pendiente.`** Requiere verificación INTEGRA con credenciales DR7 reales.
- **AC-7.1** (`extraction-stage-label.test.ts`): PASS — `m3 → "Extrayendo datos con Minimax"`, no contiene "Gemini"; `gemini → "Extrayendo datos con Gemini"`; ausente/otro → "Extrayendo datos" neutro.

## Riesgos y desviaciones

- **Riesgo clínico (bajo):** la precedencia §4.1 (Mejor fila → estándar → max(m1,m2,m3)) fija qué número ve DR7. Si ATLAS prefiere M1 fijo o la fila `Mejor *` literal, debe corregirse antes de promover. SPEC ya define la precedencia explícita — esto es contrato.
- **Riesgo de regresión (bajo):** tests de control AC-4.1/4.2 verifican que otros tipos no se afectan. PASS. El gate table-aware se condiciona explícitamente por `study_type == "Espirometria"`, no se generaliza.
- **AC-6.1 E2E real no ejecutado:** precondición DR7 inaccesible en test env. Queda como gate de verificación para INTEGRA (no bloqueante para el READY_FOR_VERIFYING porque el fix está implementado y los unitarios cubren la lógica del gate y backfill).
- **No se introdujo fallback a Gemini** — provider extractivo `m3/MiniMax-M3` vigente (FIX-20260812-12). AC-5.1 confirma.
- **Ningún cambio de comportamiento fuera de Espirometría** — AC-4.1/4.2 confirman.

## Requiere GEMINI

**Sí.** Cambio de contrato soft entre extracción y gate clínico (§15 INTEGRA). GEMINI debe auditar:
- Delta soft de `extracted_data` raíz (campos aditivos)
- Lógica del backfill (precedencia, no sobreescritura, determinismo)
- Lógica del gate table-aware (rama Espirometría solamente)
- Label UI (no afirma Gemini cuando m3)
- Casos borde E1..E11 enumerados en SPEC §6

## Requiere DEBY

**No.** No hay bug reproducible en esta implementación (causa raíz ya diagnosticada por DEBY en `DICTAMEN_FIX-20260821-01`). El cambio implementa exactamente el fix prescrito.

## Pendientes INTEGRA

1. **Verificación de gates completos:** INTEGRA reejecuta pytest completo + vitest completo + build (yo ya lo hice y está verde focal, falta auditoría independiente).
2. **GEMINI obligatorio** post-IMPL (cambio de contrato soft) — INTEGRA pivota sesión GEMINI con esta IMPL-REPORT + diff + SPEC.
3. **AC-6.1 E2E real** con `context/RD2026/ESPIROMETRIA.pdf` y credenciales DR7 reales (`MEDGEMMA_ENABLED=true` + `DR7_API_KEY`) — precondición no cumplida en test env. INTEGRA decide si lo ejecuta con credenciales reales o documenta el bloqueo ambiental.
4. **Decisión sobre etiqueta "m3"** en UI: `PapeletaWorkspace` ahora acepta prop opcional `extractionProvider`. El parent no lo pasa todavía (el audit no llega antes del panel). INTEGRA/ATLAS decide si añadir el wiring completo cuando `extraction_snapshot.audit.extraction_provider_used` esté disponible (E2E wiring).
5. **OK Frank para commit/push** — sin autorización explícita no se commitea, pushea, despliega.

## Notas de reversión

- Cambios son código puro (4 archivos modificados + 2 archivos nuevos); sin migración ni cambio de schema.
- Revertir el commit del fix (si Frank lo autoriza) restaura comportamiento previo.
- `StudyExtractionSnapshot` y `AIPrediagnosisSnapshot` ya persistidos son inmutables; el fix solo afecta corridas nuevas.
- Si el backfill produce valores incorrectos en producción (no detectado por tests), Frank puede revertir el commit y la cola de uploads vuelve al estado pre-fix sin pérdida de datos.
- El expediente `8af728bf-…` puede regenerarse tras el fix vía re-subida o `regenerateStudyAI` (si Frank lo autoriza y existe el endpoint).
- 100% reversible.

## Estado

**READY_FOR_VERIFYING.** WIP=0, sesión SOFIA cerrada. Entrega a ATLAS → INTEGRA verifica → GEMINI audita → ATLAS pide OK Frank.