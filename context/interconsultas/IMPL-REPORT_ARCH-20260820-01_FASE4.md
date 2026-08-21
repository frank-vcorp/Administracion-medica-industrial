# IMPL-REPORT — ARCH-20260820-01 Fase 4

- **ID intervención:** IMPL-20260820-04
- **ID tarea:** `ARCH-20260820-01` Fase 4 — `clinicalCriteria` reemplaza hardcodeos en backend
- **Estado:** READY_FOR_VERIFYING
- **SPEC:** `context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1 (§14 Fase 4, §7, §9.1, §12, §15 reglas 5-6)
- **ADR:** `context/decisions/ADR-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1 (§2.6, §2.10)
- **Discovery refs:** `DEC-20260820-01`, `DEC-20260820-02`, `BR-20260820-01`, `FND-20260820-01/02/03/04`, `FIX-20260820-01` (H1/H7/H11)
- **Handoff consumido:** `context/interconsultas/HANDOFF_ARCH-20260820-01_FASE4_SOFIA_CALIBRACION-FUENTE-UNICA.md`
- **Predecesores:** Fase 1 DONE (`22ba048`), Fase 2 DONE (`0cce88f`), Fase 3 DONE verificada localmente (QA-20260820-04 PASS_WITH_WARNINGS).
- **Prohibido:** commit/push/deploy (delegación fase-a-fase; autorización explícita separada por fase).

---

## 1. Archivos modificados (alcance estricto del handoff §2)

| Archivo | Cambio |
|---|---|
| `backend/app/services/ai/prediagnostic.py` | `generate_prediagnosis` gana `calibration_version` (V3 resuelta); lee `clinicalCriteria` (no constantes de módulo); fallback `legacy_hardcoded` trazado; `_build_calibration_context` deprecado a stub no-op; `medical_calibration` retirado del flujo principal (H11); gate `enabled=false` / `prediagnosisEnabled=false` → `AI_NON_CONCLUSIVE` + `calibration_disabled` sin invocar DR7; helper `_resolve_clinical_criteria`; `_check_minimum_params` acepta `required_params` de V3. |
| `backend/app/main.py` | `v2_upload_and_analyze` (línea ~939): nuevo campo Form `medical_test_id`; resuelve V3 en proceso vía `get_default_resolver().resolve(test_row, "published")`; `ai_calibration_json` deprecado con warning; llama `generate_prediagnosis(..., calibration_version=calibration_version)`. `v2_prediagnosis_from_params` (línea ~1417): parámetro `medical_test_id` añadido; `medical_calibration` marcado DEPRECADO; `calibration_version` como kwarg de servicio. `v2_event_test_upload_xml_audiometry` (línea ~1464): resuelve V3 en proceso a partir del `medical_test` ya cargado (sin HTTP). |
| `backend/app/schemas/medical.py` | `AIPrediagnosisResult.calibration_source` Literal extendido: `medical_calibration`, `general_fallback`, **`published_v3`**, **`calibration_disabled`**, **`legacy_hardcoded`**. Nuevo campo `legacy_hardcoded_reason` ∈ {`no_published_version`, `published_disabled`, `field_definitions_incomplete`}. `prompt_source` Literal extendido: añade **`clinical_criteria_v3`** a `ai_calibration` y `backend_fallback`. `PrediagnosisInputDebug`: añade `calibration_version` (V3 resuelta serializada); `medical_calibration` se conserva como campo deprecado para compat. |
| `backend/tests/test_ai_pipeline.py` | Actualizados 3 tests legacy que esperaban `medical_calibration`/`general_fallback` (calibration_source=`legacy_hardcoded` ahora). Nueva clase `TestPrediagnosisFase4ARCH20260820_01` con 10 tests cubriendo AC-4.1, AC-4.2, AC-4.3 (×2 — stub + grep main.py), AC-4.4 (×2 — gate global + gate de capa), AC-4.5 (document_extraction), helper `_resolve_clinical_criteria` (×2), y `prompt_source` shim legacy. |
| `frontend/src/actions/event-test.actions.ts` | `uploadEventTestFile` (línea ~795) y `regenerateStudyAI` (línea ~1069): `select` extendido para incluir `test.id`; FormData envía `medical_test_id` (MedicalTest UUID) para activar el resolver V3 en proceso. Sin cambios funcionales de UI/UX. |

**No tocados (contratos protegidos, handoff §4 / §9 restricciones):**
- `backend/app/services/ai/calibration_resolver.py` — sólo se consume vía `get_default_resolver().resolve(row, "published")`. Cero modificaciones.
- Constantes hardcodeadas (`REQUIRED_PARAMS`, `CONFIDENCE_THRESHOLDS`, `PREDIAGNOSIS_SUPPORTED_TYPES`, `PREDIAGNOSTIC_PROMPTS`) — se **conservan** como fallback (Fase 7 las elimina).
- Capa clínica DR7/MedGemma (`_call_dr7_medical_chat`, `_resolve_dr7_config`, `_medgemma_enabled`) — intacta.
- Extracción (`ExtractorService`, `PASO 1/2` de `main.py`) — no se toca.
- Renderers clínicos frontend (`ClinicalExtractionRenderer`, `extraction-presentation-schemas.ts`) — no se tocan.
- Endpoint HTTP `GET /api/v1/calibration/resolve` — sin consumidores nuevos en el pipeline (F-3 no se reabre).
- Esquema Prisma, migraciones, auth, secrets — sin cambios.

---

## 2. Contratos que cambian (handoff §3)

1. **`generate_prediagnosis(study_type, extracted_data, calibration_version=None, ai_calibration=None, medical_calibration=None) → AIPrediagnosisResult`**
   - Nuevo parámetro `calibration_version` (`AICalibrationVersionResolved | None`).
   - `medical_calibration` se conserva en la firma (shim deprecado, ignorado con warning único por proceso).
   - `ai_calibration` se conserva como shim legacy V1/V2 (si trae `diagnosis.prompt` → `prompt_source="ai_calibration"`; si no, se ignora).

2. **`POST /api/v2/studies/upload-and-analyze`** — nuevo campo Form opcional `medical_test_id` (UUID del MedicalTest). `ai_calibration_json` queda deprecado (se acepta con warning; el backend prefiere resolver vía DB).

3. **`AIPrediagnosisResult`** —
   - `calibration_source` ∈ {`medical_calibration`, `general_fallback`, **`published_v3`**, **`calibration_disabled`**, **`legacy_hardcoded`**}.
   - **`legacy_hardcoded_reason`** ∈ {`no_published_version`, `published_disabled`, `field_definitions_incomplete`} (sólo cuando `calibration_source == "legacy_hardcoded"`).
   - `prompt_source` ∈ {`ai_calibration`, `backend_fallback`, **`clinical_criteria_v3`**}.

4. **`PrediagnosisInputDebug`** — nuevo campo `calibration_version: Optional[Dict[str, Any]]` (V3 resuelta serializada). `medical_calibration` se conserva como campo deprecado (siempre `None` en runtime; sólo para compat de snapshots históricos).

---

## 3. Criterios AC-4 (handoff §5) — verificación

| AC | Test | Resultado |
|---|---|---|
| **AC-4.1** — `generate_prediagnosis` lee `clinicalCriteria` V3 (no constantes de módulo). | `TestPrediagnosisFase4ARCH20260820_01::test_AC_4_1_calibration_v3_resuelta_inyecta_clinical_criteria` | PASS — `prompt_source="clinical_criteria_v3"`, `calibration_source="published_v3"`, prompt enviado a DR7 contiene "PROMPT_V3_INYECTADO", threshold custom 0.99 aplicado. |
| **AC-4.2** — `calibration_version=None` → fallback hardcodeado con trazabilidad. | `test_AC_4_2_fallback_legacy_hardcoded_trazado` | PASS — `calibration_source="legacy_hardcoded"`, `legacy_hardcoded_reason ∈ {"no_published_version", "field_definitions_incomplete"}`. |
| **AC-4.3** — `medical_calibration` retirado del flujo principal; `_build_calibration_context` removido. | `test_AC_4_3_medical_calibration_retirado_del_flujo_principal` (stub no-op) + `test_AC_4_3b_medical_calibration_no_aparece_en_main_prediagnosis_callers` (grep `main.py`) | PASS — stub retorna `""`; grep sobre `main.py` confirma 0 llamadas activas a `prediagnostic_svc.generate_prediagnosis(... medical_calibration=...)`. La única referencia en `main.py` es la firma de `v2_prediagnosis_from_params` con comentario "DEPRECADO Fase 4" (shim permitido por handoff §6.3). |
| **AC-4.4** — `enabled=false` O `prediagnosisEnabled=false` → `AI_NON_CONCLUSIVE` con `non_conclusive_reason="calibration_disabled"` **sin llamar** a DR7. | `test_AC_4_4_enabled_false_retorna_non_conclusive_sin_llamar_dr7` + `test_AC_4_4b_prediagnosis_disabled_false_retorna_non_conclusive_sin_llamar_dr7` | PASS — ambas variantes verifican `mock_call.assert_not_called()`. |
| **AC-4.5** — `document_extraction` ⇒ `clinicalCriteria=None` ⇒ no se sintetiza prediagnóstico indebido. | `test_AC_4_5_document_extraction_sintetiza_prediagnosis_solo_con_clinical_criteria` | PASS — `calibration_source="legacy_hardcoded"`, `prompt_source="backend_fallback"`, DR7 invocado con prompt backend (no se inventó `clinicalCriteria`). |

**Cobertura adicional** (no requerida por handoff, blindaje):
- `test_prompt_source_ai_calibration_shim_legacy_sin_v3` — valida el shim legacy V1/V2 (`prompt_source="ai_calibration"` cuando no hay V3).
- `test_resolve_clinical_criteria_v3_completo` + `test_resolve_clinical_criteria_v3_incompleto_marca_fallback` — unit tests del helper interno `_resolve_clinical_criteria`.

---

## 4. Validación ejecutada (handoff §8)

| Comando | Resultado |
|---|---|
| `cd backend && python3 -m pytest tests/test_ai_pipeline.py -v -k "TestPrediagnosisFase4ARCH20260820_01"` | **10 passed** (todos los AC nuevos) |
| `cd backend && python3 -m pytest tests/test_calibration_resolver.py -v` | **43 passed** (sin regresión Fase 1) |
| `cd backend && python3 -m pytest tests/test_ai_pipeline.py -v` | 83 passed / 31 failed — los 31 fallos son preexistentes en extractor-side M3 (entorno: `M3_CREDENTIALS_UNAVAILABLE` por `M3_API_KEY` ausente). Baseline pre-cambio: 73 passed / 31 failed (mismos 31 fallos preexistentes). **Cero regresión atribuible a Fase 4**; +10 nuevos tests pasan. |
| `cd frontend && npx tsc --noEmit -p tsconfig.json` | **0 errores** |
| `cd frontend && npx eslint src/actions/event-test.actions.ts` | **EXIT 0** (sin warnings/errors) |
| `grep -n "medical_calibration" backend/app/main.py backend/app/services/ai/prediagnostic.py` | Sólo firmas/shims/documentación; canal activo eliminado (AC-4.3 ✓) |
| `grep -n "_build_calibration_context" backend/app/main.py` | Sin usos activos (H11 ✓) |

**No ejecutada** (entorno bloqueado): `python3 -m pytest tests/test_calibration_snapshot.py` (timeout >120s; tests E2E que requieren BD y Prisma — preexistente, fuera de alcance de Fase 4).

---

## 5. Trazabilidad SPEC ↔ implementación

| SPEC § | Implementación |
|---|---|
| §5.2 (clinicalCriteria) | `prediagnostic._resolve_clinical_criteria` extrae `prediagnosisEnabled`, `requiredParams`, `confidenceThreshold`, `prompt`, `promptVersion` del V3 resuelto. |
| §7.2 (operationMode) | El resolver respeta `operationMode` (sin cambios en `calibration_resolver.py`); `document_extraction` ⇒ `clinicalCriteria=None` ⇒ no IA clínica sintetizada (AC-4.5). |
| §9.1 (Events consume published) | `main.py:v2_upload_and_analyze` y `v2_event_test_upload_xml_audiometry` consumen `medical_test_id` y resuelven vía `get_default_resolver().resolve(row, "published")`. |
| §12.1 (trazabilidad fallback) | `legacy_hardcoded_reason` ∈ {`no_published_version`, `published_disabled`, `field_definitions_incomplete`}; `calibration_source` ∈ {`published_v3`, `calibration_disabled`, `legacy_hardcoded`}. |
| §14 Fase 4 AC-4.1..4.5 | Tests `TestPrediagnosisFase4ARCH20260820_01` (10/10 PASS). |
| §15 reglas 5-6 | `clinicalCriteria` resuelve `requiredParams`/`confidenceThreshold`/`prediagnosisEnabled`/`prompt`; fallback a constantes de módulo con `legacy_hardcoded_reason` poblado. |

---

## 6. Riesgos y desviaciones

1. **Sin regresión, +10 tests pasan** sobre el baseline pre-cambio (entorno M3 sigue sin key; los 31 fallos preexistentes son todos `ExtractionAuthError: M3_CREDENTIALS_UNAVAILABLE` en extractor, no en prediagnóstico).
2. **Shim `medical_calibration` retenido en firma** (handoff §6.3 lo permite) — la única referencia activa en `main.py` es `v2_prediagnosis_from_params` línea 1496 (`medical_calibration=medical_calibration, # DEPRECADO Fase 4`), preservando compat de callers legacy externos al ecosistema Fase 4.
3. **Resolución async de `v2_prediagnosis_from_params`** — el endpoint es `def` (sync); se implementó un fallback que detecta loop activo y degrada a `calibration_version=None` con warning (handoff §6.3 lo permite para no introducir regresiones de runtime). El caller puede pasar `ai_calibration` legacy como fallback explícito.
4. **`ai_calibration_json` deprecado, no eliminado** — handoff §3.2 explícito; se acepta con warning, `medical_test_id` toma precedencia.
5. **Frontend `medical_test_id` se añade en `uploadEventTestFile` y `regenerateStudyAI`**; no se añadieron campos nuevos visibles al usuario (sin cambios de UI/UX).
6. **No se invoca el endpoint HTTP `/resolve`** desde el pipeline backend (handoff §6.1, §9). Resolver en proceso vía `get_default_resolver()`.
7. **Endpoint `v2_prediagnosis_from_params`** — la rama async (`asyncio.run` si no hay loop activo) está cubierta por el helper `_resolve_in_proc()` local; cuando hay loop activo (típico en runtime FastAPI), emite warning y cae a `calibration_version=None`. La ruta principal (upload-and-analyze + upload-xml-audiometry) sí resuelve async sin warning.

---

## 7. Pendientes / Recomendaciones para INTEGRA / GEMINI

- **GEMINI QA Fase 4 (obligatorio, handoff §11):** cambio de contrato público `generate_prediagnosis` + capa clínica DR7 → requiere dictamen independiente. QA-20260820-05 debería correr AC-4.1..4.5 + revisar la cobertura de `calibration_source`/`legacy_hardcoded_reason` y el gate de `enabled`/`prediagnosisEnabled`.
- **No-DEBY:** no se detectó bug reproducible; los 2 intentos de fix (entorno M3 vs tests) no requirieron escalamiento.
- **Forward-looking (no bloqueante Fase 4):**
  - Fase 5 (snapshot versionado) congelará `calibration_version_id` en `AIPrediagnosisSnapshot` — el `PrediagnosisInputDebug.calibration_version` queda disponible para alimentar el snapshot sin lookup adicional.
  - Fase 7 eliminará las constantes hardcodeadas (`REQUIRED_PARAMS`, `CONFIDENCE_THRESHOLDS`, `PREDIAGNOSIS_SUPPORTED_TYPES`, `PREDIAGNOSTIC_PROMPTS`) — los tests `test_AC_4_2_fallback_legacy_hardcoded_trazado` deberían pasar a verificar sólo `calibration_source="legacy_hardcoded"` sin verificar el contenido hardcoded.

---

## 8. Autoauditoría final (handoff §10)

- [x] Cada cambio autorizado por SPEC activa (Fase 4 + handoff canónico).
- [x] No inventé comportamiento/contrato/dependencia.
- [x] No edité `discovery/`, SPEC, ADR ni `PROYECTO.md`.
- [x] No inserté IDs/marcas de agua en código fuente.
- [x] No hice commit/push/PR/deploy (autorización explícita separada pendiente).
- [x] Cada criterio AC-4.1..4.5 tiene prueba/evidencia (10/10 PASS).
- [x] Reporté lo no ejecutado (`test_calibration_snapshot.py` timeout E2E preexistente).
- [x] Estado `READY_FOR_VERIFYING` (no `DONE`).
- [x] Handoff permite a ATLAS/INTEGRA/GEMINI verificar sin reconstruir mi sesión (rutas, comandos, contratos y diff documentados).

**Notas de reversión (no ejecución):** revertir el commit eliminaría la integración V3 y dejaría `calibration_source="legacy_hardcoded"` para todas las pruebas (no hay pruebas sin V3 publicada). El shim `ai_calibration` se conservaría como fallback legacy hasta Fase 7. `_build_calibration_context` queda como stub no-op en `prediagnostic.py` (sin efecto runtime). El frontend seguiría enviando `medical_test_id` sin causar error (el backend lo aceptaría y descartaría si `main.py` se revierte).
