# IMPL-REPORT — FIX-20260824-01: STUDY_TYPE_MISMATCH estructurado (mismatch Audio↔Espiro)

```
ID intervención: IMPL-20260824-01-FIX-STUDY-MISMATCH
ID tarea: FIX-20260824-01
Estado: READY_FOR_VERIFYING
SPEC: context/SPECs/SPEC-FIX-20260824-01-STUDY-MISMATCH.md v1.0
Discovery refs: FND-20260824-02 (UI muestra error crudo de M3 ante documento incompatible); DEC-20260824-01 (mensaje claro operativo)
QA refs: context/reviews/QA-20260824-12-FIX-STUDY-MISMATCH.md (PASS_WITH_WARNINGS; F-1 IMPLEMENTATION_DEFECT cerrado en mismo SPEC; F-2/F-3/F-4/F-5 P3 alineados); context/reviews/QA-20260824-13-FIX-STUDY-MISMATCH.md (PASS_WITH_WARNINGS; G-1 IMPLEMENTATION_DEFECT cerrado en mismo SPEC)
```

> **Delta acumulado del mismo SPEC (F-1 + G-1 + P3 alignment).** Esta entrega cierra los hallazgos de QA-20260824-12 y QA-20260824-13 dentro de la misma sesión, sin ampliar alcance:
>
> **QA-20260824-12 (round previo):**
> - **F-1 (P2, IMPLEMENTATION_DEFECT):** el detector de mismatch es ahora consciente de negación (cierra el falso positivo "This is not a radiografía; es una espirometría válida"). AC-2 fixture corregido a contenido naturalmente Audio cuando `selected=Espirometria`. 6 nuevos casos de negación ES/EN añadidos.
> - **F-2 (P3):** response V2 incluye `message` redactado como contrato explícito (antes implícito vía `error`).
> - **F-3 (P3):** `selected_study_type` y `detected_study_type` se validan al conjunto `CANONICAL_STUDY_TYPES` antes de serializar.
> - **F-4 (P3):** log de servidor NUNCA imprime contenido del modelo. Helper `sanitize_provider_text_for_log` expone sólo `len` y `sha256_16`.
> - **F-5 (P3):** copy user-facing usa tildes para Audiometría/Espirometría/Campimetría/Rayos X/Riesgo Cardiovascular (alineado con DEC-20260824-01).
>
> **QA-20260824-13 (este round, G-1):**
> - **G-1 (P2, IMPLEMENTATION_DEFECT):** dos residuos del cierre F-1:
>   1. **Ventana de negación truncaba frases modales EN no contraídas** — `"This does not appear to be an audiogram. It's a spirometry report."` con `selected=Audiometria` retornaba `is_mismatch=False` porque la ventana de 5 tokens dejaba `"does"` fuera del match. Solución: ventana ampliada a 6 tokens + stripping ITERATIVO de artículos/modificadores desde el final (max 3 iteraciones).
>   2. **Modificadores interpuestos entre article y noun rompían la negación** — `"This is not a valid radiograph. It is a valid spirometry report."` con `selected=Espirometria` retornaba `is_mismatch=True, detected=Rayos_X` (falso positivo) porque el adjetivo `"valid"` se interponía entre `"not a"` y `"radiograph"`. Solución: set conservador `_NEGATION_MODIFIERS` (`valid`, `real`, `mere`, `simple`, `proper`, `complete`, `actual`, `ordinary`, `common`, `clear`, `true`, `false`, `actually`, `really`, `quite`, `just`, `only`, `simply`, `exactly`, `precisely`, `presumably`, `likely`, `especially`, `particularly`, `definitely`, `clearly`, `obviously`, `honestly`, `apparently`, `seemingly`, `evidently`, `supposedly`) se elimina antes del match.
> - **`str(e)` raw en `main.py:1490-1492` re-surge para rechazos no clasificados** — el catch-all `except Exception` del endpoint V2 devolvía `{"error": str(e)}` (puede contener el texto crudo del modelo si un `ValueError("Respuesta de X no es JSON válido: '<raw>…')` se filtra sin ser clasificado). Solución: rama `ValueError` con detección de `"no es JSON"` → `error_code="EXTRACTION_NOT_JSON"` con mensaje user-friendly; fallback genérico `error_code="EXTRACTION_FAILED"`. Ambos usan `sanitize_provider_text_for_log` para el log y NUNCA incluyen `str(e)` en el response.

---

## Archivos modificados

- `backend/app/services/ai/extractor.py` — `_call_with_dispatch` acepta `selected_study_type: Optional[str]`; cuando M3 o Gemini lanzan `ValueError("Respuesta de X no es JSON válido: …")` cuyo texto crudo pasa `detect_study_type_mismatch`, el dispatcher re-lanza `StudyTypeMismatchError` (NO fallback a Gemini: mismatch es error de DOMINIO, no transient — FIX-20260812-12). `extract_by_type` propaga `doc_type` y stashes `mismatch_provider_text` en `last_extraction_audit` (sólo log server-side, sanitizado — ver F-4).
- `backend/app/main.py` — `/api/v2/studies/upload-and-analyze` añade bloque `except StudyTypeMismatchError` que valida `selected/detected_study_type` contra `CANONICAL_STUDY_TYPES` (F-3) y devuelve `{"status": "error", "error": …, "message": …, "error_code": "STUDY_TYPE_MISMATCH", "selected_study_type": …, "detected_study_type": …, "file": filename}`. `message` está SIEMPRE presente como contrato (F-2). El `provider_text` crudo sólo va al log de servidor vía `sanitize_provider_text_for_log` (F-4: `provider_len` + `provider_sha256_16`, NUNCA contenido). **G-1 (QA-20260824-13):** el catch-all `except Exception` al final del endpoint (precedente: `return {"status": "error", "error": str(e), "file": filename}` que filtraba raw text) se reemplaza por:
  - Rama `isinstance(e, ValueError)` con detección de `"no es JSON"` → `error_code="EXTRACTION_NOT_JSON"` con mensaje user-friendly (`"La IA no pudo procesar el documento. Verifica el archivo y vuelve a intentarlo."`); `message` también presente.
  - Fallback genérico `error_code="EXTRACTION_FAILED"` para cualquier otra `Exception` (tipo + len + sha256_16 al log).
  - NUNCA `str(e)` ni `provider_text` en el response dict. Log usa `sanitize_provider_text_for_log`.
- `frontend/src/actions/ai-prediagnosis.actions.ts` — `StudyAIAnalysisResult` añade campos `errorCode`, `message`, `selectedStudyType`, `detectedStudyType`. `triggerStudyAIAnalysis` parsea `error_code === "STUDY_TYPE_MISMATCH"` tanto del path `result.status !== "success"` como del path `response.ok === false` (HTTP 4xx/5xx) y propaga los 4 campos estructurados sin copiar el `error` crudo al `resultNotes`. `detectedStudyType` se preserva como `null` cuando la confianza es baja (F-3 frontend).
- `frontend/src/actions/event-test.actions.ts` — `uploadEventTestFile` y `regenerateStudyAI` tratan `errorCode === "STUDY_TYPE_MISMATCH"` como rama aparte: persistir `resultNotes` redactado vía `buildMismatchResultNote` (importado de módulo separado, no `'use server'`); propagar mensaje user-friendly al cliente. Otros errores siguen el camino existente (`buildAIResultNote`).
- `frontend/src/components/clinical/PapeletaWorkspace.tsx` — añade `StudyTypeMismatchState`, nuevos `useState`s `uploadMismatch` / `regenMismatch`, y un sub-componente `MismatchMessageBanner` que renderiza SOLO el `message` redactado como children JSX (escape automático de React; NUNCA `dangerouslySetInnerHTML`). Cuando `errorCode === "STUDY_TYPE_MISMATCH"`, la UI muestra el banner accionable; el `uploadError`/`regenError` crudo se conserva sólo para errores no-mismatch (AC-4).

## Archivos nuevos

- `backend/app/services/ai/study_type_mismatch.py` — `StudyTypeMismatchError` (atributos `selected_study_type`, `detected_study_type`, `provider`, `provider_text`, `message`); `StudyTypeMismatchAssessment` (dataclass frozen); **`detect_study_type_mismatch` ahora CONSciente DE NEGACIÓN (F-1)**: clasifica cada mention de tipo como `affirmed` o `negated` comparando contra ~50 frases de negación ES+EN en los últimos 5 tokens (con manejo de artículos entre la frase y el sustantivo). Algoritmo:
  - (a) Texto no vacío.
  - (b) ≥1 `_REFUSAL_SIGNALS` (expandidos para cubrir `isn't a`, `isn't an`, `this isn't`, `it isn't`, `tampoco es`, `ni audiograma`, etc.).
  - (c) Análisis de menciones: hay 5 casos (affirmed_others, negated_selected, affirmed_selected + sin negated_selected/affirmed_others → no mismatch, sólo negated_others, sin menciones → confianza baja).
  - Resultado: cierra el falso positivo "This is not a radiografía; es una espirometría" (no se clasifica como Rayos_X). `extract_raw_response_text_from_value_error(ValueError)` para extraer el raw text del ValueError canónico del proveedor. `build_user_facing_message(selected, detected)` con `_DISPLAY_NAME` (tildes para Audiometría/Espirometría/Campimetría/Rayos X/Riesgo Cardiovascular) que produce los dos mensajes del SPEC, alineado con el ejemplo de DEC-20260824-01 (F-5). `sanitize_provider_text_for_log(provider_text)` que devuelve `{len, sha256_16}` sin contenido (F-4) — útil para deduplicar/correlar logs sin filtrar PII.
- `frontend/src/lib/clinical/study-type-mismatch-note.ts` — `buildMismatchResultNote({selectedStudyType, detectedStudyType, message})` exportable (testeable). Vive en módulo no-`'use server'` por restricción de Next.js sobre exports desde server actions.
- `frontend/src/actions/__tests__/study-type-mismatch.test.ts` — vitest con 13 tests (AC-1 mismatch Audio→Espiro, **AC-2 con fixture corregido naturalmente Audio (F-1)**, AC-3 resultNotes sin HTML/prompt/PII/raw, AC-4 errores no-mismatch siguen propagándose, AC-4 paridad HTTP no-OK, **F-3 null detectedStudyType preservado**, garantías estáticas de no-leakage).
- `backend/tests/test_ai_pipeline.py` (clase `TestFIX20260824_01StudyTypeMismatch`, +41 tests) — detector puro (AC-1 Audio→Espiro, **AC-2 fixture corregido**, AC-1.2/1.3/1.4/1.5); **F-1 nuevos tests**: `test_detect_negated_different_type_is_NOT_mismatch`, `test_detect_negated_then_affirmed_different_type_IS_mismatch`, `test_detect_only_negations_low_confidence`, `test_detect_only_negations_no_affirmation`, `test_detect_ni_list_negation_es`, `test_detect_doesnt_appear_to_be_negation`, `test_detect_isnt_a_negation_en`; **G-1 nuevos tests** (QA-20260824-13): `test_g1_long_modal_en_does_not_appear_to_be`, `test_g1_modifier_between_article_and_noun`, `test_g1_doesnt_appear_to_be_negates_audiogram`, `test_g1_adverb_not_recognized`, `test_g1_double_modifier_negation`, `test_g1_affirmed_remains_affirmed_with_modifier`, `test_g1_max_three_iterations_protect_false_negatives`; **G-1 main.py tests**: `test_main_catchall_does_not_leak_raw_str_e`, `test_main_catchall_detects_value_error_no_json`; `build_user_facing_message` (AC-3.1/3.2/3.3 + **F-5 tildes en todos los tipos**); `extract_raw_response_text_from_value_error` (AC-3.4/3.5); **F-4 nuevos tests**: `test_sanitize_provider_text_for_log_no_raw_content`, `test_sanitize_provider_text_for_log_empty`, `test_sanitize_provider_text_for_log_different_inputs_different_hashes`; `ExtractorService` dispatcher (AC-4.1 m3 mismatch → typed error; AC-4.2 NO fallback a Gemini; AC-4.3 JSON genérico NO reclasificado; AC-4.4 Gemini parity); regresión (AC-5.1 Audio válido, AC-5.2 Espiro válido); `main.py` shape (AC-6 response canónico + **5 campos incl. `message` (F-2)**; AC-6.1 mensaje redactado en `error` Y `message`; **F-3 `detected_study_type` validado a canónico**; **F-4 log NO imprime raw provider_text**, sólo `provider_len` + `provider_sha256_16`).

## Contratos

- **Cambian (delta suave):**
  - Backend `POST /api/v2/studies/upload-and-analyze` → nueva rama de error estructurado `STUDY_TYPE_MISMATCH` con `selected_study_type`, `detected_study_type`, **`message` (F-2 contrato explícito)**, `error` (retrocompat). Validación contra `CANONICAL_STUDY_TYPES` para `selected/detected` (F-3): si no canónico, queda `null` antes de serializar.
  - Frontend `StudyAIAnalysisResult` → 4 campos opcionales `errorCode`/`message`/`selectedStudyType`/`detectedStudyType`. Backwards-compat: `error` siempre presente; `errorCode` undefined para errores no-mismatch; `detectedStudyType` puede ser `null` (F-3 confianza baja).
  - Frontend `uploadEventTestFile` / `regenerateStudyAI` → cuando `errorCode === "STUDY_TYPE_MISMATCH"`, devuelven los 4 campos estructurados y NO caen a fallback V1.
  - UI `PapeletaWorkspace` → render condicional de `MismatchMessageBanner` vs. `uploadError`/`regenError` crudo. Privacidad reforzada: `dangerouslySetInnerHTML` no se introduce (verificado por test estático).
  - Mensaje user-facing: `build_user_facing_message` ahora usa `_DISPLAY_NAME` con tildes (F-5) — `"Seleccionaste Audiometría, pero el documento parece ser Espirometría. Abre Espirometría y vuelve a cargar el archivo."` (alineado con DEC-20260824-01).
  - Log de servidor: `provider_text` NUNCA se imprime (F-4) — sólo `provider_len` y `provider_sha256_16` para correlación entre logs sin filtrar PII.

- **Protegidos (NO TOCADOS):**
  - Proveedores (m3 / gemini) — sólo se añade catch defensivo del ValueError, sin cambiar prompts ni `call_m3`/`call_gemini`.
  - Prompts clínicos (DR7/MedGemma) — intactos.
  - Calibraciones V3, presentación, snapshot versioning — sin cambios.
  - Publicación, migraciones, schema Prisma — sin cambios.
  - Auth, RBAC, sesión — sin cambios.
  - Otros errores no-mismatch (auth, timeout, JSON corrupto, EXTRACTION_PROMPT_NOT_CONFIGURED) — propagan idénticos (CB-03 preservado: `test_m3_json_no_parseable_no_es_fallback` sigue PASS).
  - `ExtractorService._normalize_espirometria_result`, `_backfill_espirometry_scalar`, gates clínicos — intactos.
  - `AIPrediagnosisService`, `PrediagnosticService`, `_check_minimum_params` — intactos.
  - `AIPrediagnosisResult`, `EspirometriaData`, `AudiometriaData` — schemas sin cambios.
  - `EventTest.resultNotes` para errores no-mismatch — sigue vía `buildAIResultNote` (sin cambios).
  - `context/datos AMI/**` y `context/RD2026/**` — read-only, intactos.

---

## Validación

| Gate | Comando | Resultado |
|---|---|---|
| Backend pytest focal FIX-20260824-01 | `cd backend && python3 -m pytest tests/test_ai_pipeline.py -k "FIX20260824_01StudyTypeMismatch"` | **PASS** 41/41 (AC-1/2/3/4/5 + endpoint shape + sanitización log + F-1 negation + G-1 ventana/modificadores + G-1 catch-all sanitización + F-2/F-3/F-4/F-5) |
| Backend pytest focal compartido | `cd backend && python3 -m pytest tests/test_ai_pipeline.py -k "FIX20260821_01GateTableawareEspirometria or m3_json_no_parseable"` | **PASS** 54/54 (FIX-20260821-01 sigue verde; CB-03 preservado) |
| Backend suite completa | `cd backend && python3 -m pytest tests/test_ai_pipeline.py` | **0 regresiones nuevas**: 31 fallos preexistentes `M3_CREDENTIALS_UNAVAILABLE` (sin `M3_API_KEY` en test env) idénticos a baseline. Total: 136 passed (era 127 antes de G-1; +9 = mis tests G-1 ventana/modificadores + catch-all sanitización). |
| Backend typecheck | N/A (Python sin tsc) | N/A |
| Frontend typecheck | `cd frontend && npx tsc --noEmit` | **PASS** 0 errores |
| Frontend vitest focal nuevo | `cd frontend && npx vitest run src/actions/__tests__/study-type-mismatch.test.ts` | **PASS** 13/13 (AC-1/2 con fixture corregido + AC-3/4 + F-3 null passthrough; sin cambios en este round G-1) |
| Frontend vitest focal compartido | `cd frontend && npx vitest run src/lib/clinical/__tests__/extraction-stage-label.test.ts` | **PASS** 4/4 (FIX-20260821-01 intacto) |
| Frontend vitest suite | `cd frontend && npx vitest run` | **0 regresiones nuevas**: 15 fallos preexistentes en `medical-exam.actions.test.ts` (sin relación con este SPEC). |
| Frontend lint focal | `cd frontend && npx eslint src/actions/ai-prediagnosis.actions.ts src/actions/event-test.actions.ts src/actions/__tests__/study-type-mismatch.test.ts src/lib/clinical/study-type-mismatch-note.ts src/components/clinical/PapeletaWorkspace.tsx` | **PASS** 0 errores (1 warning preexistente `react-hooks/set-state-in-effect` sin relación con mi cambio) |
| Frontend prisma generate | `cd frontend && npx prisma generate` | **PASS** (sin cambios schema) |
| Frontend build | `cd frontend && npx next build` | **SUCCESS** (✓ Compiled successfully en 21.9s) |
| Determinismo detector (defensa) | `detect_study_type_mismatch` mismo input → mismo `StudyTypeMismatchAssessment` | PASS (dataclass frozen, sin estado mutable) |
| F-1 cierre: reproducción QA | `"This is not a radiografía; es una espirometría válida."` con `selected=Espirometria` | PASS — `is_mismatch=False`, `detected=None` (cierra el falso positivo del QA-12) |
| G-1.A cierre: reproducción QA | `"This does not appear to be an audiogram. It's a spirometry report."` con `selected=Audiometria` | PASS — `is_mismatch=True`, `detected=Espirometria` (cierra el falso negativo del QA-13) |
| G-1.B cierre: reproducción QA | `"This is not a valid radiograph. It is a valid spirometry report."` con `selected=Espirometria` | PASS — `is_mismatch=False` (cierra el falso positivo residual del QA-13) |
| G-1 catch-all sanitization | `main.py` catch-all `except Exception` no devuelve `str(e)` raw | PASS — `error_code="EXTRACTION_NOT_JSON"` (ValueError no-JSON) o `error_code="EXTRACTION_FAILED"` (resto), con mensaje user-friendly; log usa `sanitize_provider_text_for_log`. |

## Trazabilidad AC

- **AC-1** (`test_detect_mismatch_audio_to_espirometry`, `test_m3_modality_mismatch_raises_typed_error`, `triggerStudyAIAnalysis AC-1`): PASS — rechazo "no parece ser un estudio de Audiometría... es una espirometría" produce `is_mismatch=True`, `detected="Espirometria"`, mensaje user-friendly con tipos correctos.
- **AC-2** (`test_detect_mismatch_espirometry_to_audio_inverse`, `triggerStudyAIAnalysis AC-2 inverso (fixture corregido F-1)`): PASS — fixture ahora naturalmente Audio: "Lo siento, este documento no parece ser una espirometría. Es un audiograma con umbrales en 500/1000/2000 Hz." → `detected="Audiometria"`.
- **AC-3** (`test_build_user_facing_message_confident/generic/same_type_falls_back/tildes_all_types`, `test_extract_raw_response_text_from_canonical_value_error`, `test_main_endpoint_response_shape_for_mismatch`, `test_main_endpoint_uses_redacted_message`, `test_main_endpoint_validates_detected_study_type`, `test_main_log_does_not_print_raw_provider_text`, `buildMismatchResultNote` (5 tests), `garantías estáticas` (3 tests)): PASS — `provider_text` queda sólo en log server sanitizado (F-4: `provider_len` + `provider_sha256_16`, NUNCA contenido); `EventTest.resultNotes` no contiene HTML, prompt, respuesta M3, stack, PII ni secretos; el response serializado incluye `message` como contrato (F-2); `detected_study_type` validado contra `CANONICAL_STUDY_TYPES` (F-3); tildes en todos los tipos (F-5).
- **AC-4** (`test_detect_mismatch_generic_no_type_mentioned`, `test_detect_mismatch_same_type_not_a_mismatch`, `test_detect_no_refusal_signal_not_mismatch`, `test_detect_empty_text_not_mismatch`, `test_m3_generic_json_error_still_propagates_as_value_error`, `test_gemini_modality_mismatch_raises_typed_error`, `triggerStudyAIAnalysis AC-4 genérico + AC-4 paridad HTTP no-OK`): PASS — rechazos sin tipo mencionado → `detectedStudyType=None`, UI usa mensaje genérico; rechazos del mismo tipo → NO clasifica; errores no-mismatch (`Servicios de IA no están disponibles`) → `success=false`, `errorCode=undefined`.
- **AC-5** (`test_valid_audio_extraction_unchanged`, `test_valid_espirometry_extraction_unchanged`, FIX-20260821-01 sigue PASS): PASS — extracción válida Audio/Espiro retorna el mismo `AudiometriaData`/`EspirometriaData` sin modificación; `last_extraction_audit.extraction_fallback_reason` ≠ `study_type_mismatch`.
- **AC-6** (`npx tsc --noEmit`, `npx eslint`, `npx prisma generate`, `npx next build`, `test_main_endpoint_response_shape_for_mismatch`): PASS — 0 errores de tipo, 0 errores de lint, prisma generate OK, `next build` SUCCESS.

## Trazabilidad F-1 (cierre)

- **F-1.1** `test_detect_negated_different_type_is_NOT_mismatch` — QA repro exacta: "This is not a radiografía de tórax; es una espirometría válida" con `selected=Espirometria` → `is_mismatch=False`. Antes del fix: `True, detected=Rayos_X`. **CERRADO**.
- **F-1.2** `test_detect_negated_then_affirmed_different_type_IS_mismatch` — "This is not a radiografía. Es un electrocardiograma válido." con `selected=Audiometria` → `is_mismatch=True, detected=Electrocardiograma`. **CERRADO**.
- **F-1.3** `test_detect_only_negations_low_confidence` — "Tampoco es un audiograma." con `selected=Audiometria` → `is_mismatch=True, detected=None` (confianza baja). **CERRADO**.
- **F-1.4** `test_detect_only_negations_no_affirmation` — "Esto no es una radiografía de tórax. Tampoco es un audiograma. No es un electrocardiograma. Es una espirometría válida." con `selected=Espirometria` → `is_mismatch=False` (doc ES el seleccionado). **CERRADO**.
- **F-1.5** `test_detect_ni_list_negation_es` — "Ni audiograma, ni radiografía, ni electrocardiograma. Es claramente un estudio de función pulmonar." con `selected=Audiometria` → `is_mismatch=True, detected=Espirometria`. **CERRADO**.
- **F-1.6** `test_detect_doesnt_appear_to_be_negation` — "This doesn't appear to be an audiogram. It's a spirometry report." con `selected=Audiometria` → `is_mismatch=True, detected=Espirometria`. **CERRADO**.
- **F-1.7** `test_detect_isnt_a_negation_en` — "This isn't a spirometry. It's an ECG." con `selected=Espirometria` → `is_mismatch=True, detected=Electrocardiograma`. **CERRADO**.

## Trazabilidad G-1 (cierre)

- **G-1.A** `test_g1_long_modal_en_does_not_appear_to_be` — QA-20260824-13 repro exacta: `"This does not appear to be an audiogram. It's a spirometry report."` con `selected=Audiometria` → `is_mismatch=True, detected=Espirometria`. Antes del fix: `is_mismatch=False` (ventana de 5 tokens truncaba la frase 5-token `"does", "not", "appear", "to", "be"` dejando `"does"` fuera). **CERRADO** — ventana ampliada a 6 tokens + stripping de artículo "an".
- **G-1.B** `test_g1_modifier_between_article_and_noun` — QA-20260824-13 repro exacta: `"This is not a valid radiograph. It is a valid spirometry report."` con `selected=Espirometria` → `is_mismatch=False`. Antes del fix: `is_mismatch=True, detected=Rayos_X` (falso positivo — `"valid"` se interponía entre `"not a"` y `"radiograph"`). **CERRADO** — stripping iterativo de modificadores (`valid`) + artículos (`a`) antes del match.
- **G-1.C** `test_g1_doesnt_appear_to_be_negates_audiogram` — Variante contraída de G-1.A: `"This doesn't appear to be an audiogram. It's a spirometry report."` con `selected=Audiometria` → `is_mismatch=True, detected=Espirometria`. **CERRADO**.
- **G-1.D** `test_g1_adverb_not_recognized` — Adversativo adicional: `"This is actually not a spirometry. It is an audiogram."` con `selected=Espirometria` → `is_mismatch=True, detected=Audiometria`. **CERRADO** — añadidas frases `("actually", "not")`, `("really", "not")`, etc. a `_NEGATION_PHRASES`.
- **G-1.E**`test_g1_double_modifier_negation` — No-regresión: `"This is not a really valid audiogram. It is a spirometry report."` con `selected=Audiometria` → `is_mismatch=True, detected=Espirometria`. Doble modificador (`really` + `valid`) stripping progresivo. **CERRADO**.
- **G-1.F** `test_g1_affirmed_remains_affirmed_with_modifier` — No-regresión crítica: `"This is a valid radiograph."` (sin refusal) NO clasifica; `"This is not a valid radiograph. It is a spirometry."` (con refusal) clasifica con `detected=Espirometria` (no `Rayos_X` — "radiograph" queda negated). **CERRADO**.
- **G-1.G** `test_g1_max_three_iterations_protect_false_negatives` — Defensa: cap de 3 iteraciones evita falsos positivos con cláusulas de modificadores en cadena. **CERRADO**.
- **G-1.H** `test_main_catchall_does_not_leak_raw_str_e` — `main.py:1490-1492` catch-all NO devuelve `str(e)` ni `provider_text`; usa `error_code` estructurado + `sanitize_provider_text_for_log` en log. **CERRADO**.
- **G-1.I** `test_main_catchall_detects_value_error_no_json` — `ValueError("Respuesta de X no es JSON válido: …")` capturado por catch-all se mapea a `error_code="EXTRACTION_NOT_JSON"` con mensaje user-friendly (no raw); fallback `EXTRACTION_FAILED` para el resto. **CERRADO**.

## Riesgos y desviaciones

- **Riesgo de falso positivo (heurística F-1):** cerrado. El detector ahora clasifica cada mention como `affirmed` o `negated` comparando contra ~50 frases de negación ES+EN (con manejo de artículos entre la frase y el sustantivo: "tampoco es UN audiograma", "this is not AN x-ray"). Las menciones negadas de otros tipos NO se promueven a `detected`. Probado con `test_detect_negated_different_type_is_NOT_mismatch` (repro exacta del QA-12) y `test_detect_only_negations_low_confidence`.
- **Riesgo de falso negativo (F-1):** monitoreado. Si el modelo usa una frase de negación no cubierta (ej. "hardly a", "not really a"), podría fallar a clasificar como negación → mention pasaría a `affirmed` y dispararía mismatch posiblemente incorrecto. La lista `_NEGATION_PHRASES` es extensible; en el improbable caso de aparición, agregar la frase es trivial y no requiere cambio de contrato.
- **Riesgo de falso positivo/negativo (G-1):** monitoreado. La ventana de 6 tokens + stripping iterativo de artículos/modificadores cubre los casos del QA-13. Casos adversativos con modificadores en cadena (3+) caen fuera del cap y mantienen comportamiento conservador. La lista `_NEGATION_MODIFIERS` es conservadora (sólo fillers que NO especifican el tipo). Probado con `test_g1_long_modal_en_does_not_appear_to_be` (repro exacta QA-13.A), `test_g1_modifier_between_article_and_noun` (repro exacta QA-13.B), `test_g1_double_modifier_negation`, `test_g1_affirmed_remains_affirmed_with_modifier`, `test_g1_max_three_iterations_protect_false_negatives`.
- **Riesgo clínico (nulo):** no se cambia el proveedor (M3 sigue activo), no se cambian prompts clínicos (FIX-20260812-12 vigente), no se cambia `last_extraction_audit` salvo en la rama de mismatch (donde se añade `mismatch_provider_text` para auditoría server-side, NO persistido en Prisma).
- **Riesgo de regresión (bajo):** tests AC-4.1/4.3/4.4 confirman que JSON corrupto NO reclasifica, que NO hay fallback a Gemini, y que la extracción válida es idéntica. La rama Gemini parity (AC-4.4) es defensiva — sólo se dispara si Gemini produjera un rechazo similar, cosa que no fue el caso en FND-20260824-02 pero queda cubierta para futura evolución.
- **Desviación menor:** `buildMismatchResultNote` se movió a un módulo separado `src/lib/clinical/study-type-mismatch-note.ts` porque Next.js prohíbe exports no-async desde archivos `'use server'`. Esto NO cambia el comportamiento — es la misma función, ahora testeable sin violar la restricción del framework.
- **Cobertura de "no-leakage"**: `test_main_endpoint_response_shape_for_mismatch` valida estáticamente que el dict retornado NO contiene `provider_text`; `test_main_log_does_not_print_raw_provider_text` valida que el log usa `provider_len` + `provider_sha256_16` (F-4); **`test_main_catchall_does_not_leak_raw_str_e` (G-1)** valida que el catch-all NO devuelve `str(e)` ni `provider_text` en el response; **`test_main_catchall_detects_value_error_no_json` (G-1)** valida la rama `EXTRACTION_NOT_JSON` para `ValueError` con `"no es JSON"`; `test_sanitize_provider_text_for_log_no_raw_content` valida que el helper NO expone PII (sólo `len` y `sha256_16`); `buildMismatchResultNote` valida que `EventTest.resultNotes` no contiene HTML, prompt, stack, ni nombres de provider; `garantías estáticas en event-test.actions.ts` verifica que el bloque del action NO referencia `provider_text` ni copia texto crudo del proveedor.
- **AC-6 E2E real con Playwright:** NO EJECUTADA — precondición `M3_API_KEY` no disponible en test env; además, la UI nunca debería mostrar el banner de mismatch en expediente sano (sólo ante input incorrecto del operador). FND-20260824-02 ya confirmó el bug en producción con `8af728bf-…`. INTEGRA/GEMINI puede reproducir con el `ESPIROMETRIA.pdf` cargado en un estudio `AUDIOMETRIA` y verificar que la UI muestra el banner accionable en lugar del `Respuesta de M3 no es JSON válido`.

## Requiere GEMINI

**Sí (tercera pasada — F-1 + G-1 + P3 alignment).** Cambio de contrato suave entre el extractor y la capa HTTP boundary + heurística de negación + catch-all sanitización. GEMINI debe auditar:
- **F-1:** detector consciente de negación — verificar que el cierre de "This is not a radiografía; es una espirometría" (repro exacta del QA-12) cubre todos los patrones reportados (ES + EN, con/sin artículos, frases de negación compuestas).
- **G-1.A:** detector ampliado a ventana 6 tokens + stripping de artículo "an" — repro exacta `"This does not appear to be an audiogram"` con `selected=Audiometria` → `is_mismatch=True, detected=Espirometria`.
- **G-1.B:** detector con stripping de modificadores (`valid`, `real`, `actually`, etc.) — repro exacta `"This is not a valid radiograph. It is a valid spirometry report."` con `selected=Espirometria` → `is_mismatch=False`.
- **G-1 catch-all sanitization:** `main.py:1490-1492` NO devuelve `str(e)` raw; `error_code="EXTRACTION_NOT_JSON"` para `ValueError` con `"no es JSON"`, `error_code="EXTRACTION_FAILED"` para el resto. Verificar que el log usa `sanitize_provider_text_for_log` y que el response NO contiene `str(e)` ni `provider_text`.
- **F-2:** response V2 incluye `message` como contrato explícito (no implícito en `error`); `triggerStudyAIAnalysis` preserva el campo.
- **F-3:** `selected_study_type` y `detected_study_type` validados contra `CANONICAL_STUDY_TYPES` antes de serializar.
- **F-4:** log de servidor NO imprime contenido del modelo — sólo `provider_len` + `provider_sha256_16`. `sanitize_provider_text_for_log` es el helper canónico.
- **F-5:** copy user-facing usa tildes (`Audiometría`, `Espirometría`, `Campimetría`, `Rayos X`, `Riesgo Cardiovascular`).
- Garantía de no-leakage: `provider_text` fuera del response, log server-side con sanitización PII.
- Privacidad en `EventTest.resultNotes`: el builder frontend NO copia el `message` del backend verbatim — lo redacta independientemente.
- Banner UI: `MismatchMessageBanner` renderiza children JSX (escape React); ningún `dangerouslySetInnerHTML`.

## Requiere DEBY

**No.** No hay bug reproducible en esta implementación (la causa raíz ya está diagnosticada por FND-20260824-02 y DEC-20260824-01). El F-1 y el G-1 fueron IMPLEMENTATION_DEFECTs dentro de la misma SPEC, atendidos en la misma sesión SOFIA (regla §11 del protocolo).

## Pendientes INTEGRA

1. **Verificación de gates completos:** INTEGRA reejecuta pytest completo + vitest completo + build (yo ya lo hice y está verde focal, falta auditoría independiente).
2. **GEMINI obligatorio** post-IMPL (cambio de contrato suave + heurística de negación F-1/G-1 + garantías de privacidad F-4 + catch-all sanitización G-1) — INTEGRA pivota sesión GEMINI con esta IMPL-REPORT + diff + SPEC + QA-20260824-12 + QA-20260824-13.
3. **E2E manual** con `context/RD2026/ESPIROMETRIA.pdf` cargado en estudio `Audiometria` (V3 published) en entorno dev/staging — precondición `M3_API_KEY` real. Verifica que la UI muestra el banner accionable y NUNCA `Respuesta de M3 no es JSON válido`. DEC-20260824-01 pidió feedback operativo claro: el banner debe decir "Seleccionaste Audiometría, pero el documento parece ser Espirometría. Abre Espirometría y vuelve a cargar el archivo." (con tildes, F-5).
4. **Sanitización del log server (F-4 + G-1):** ya aplicada en estos dos rounds — log emite `provider_len` + `provider_sha256_16` (sin contenido); catch-all usa `sanitize_provider_text_for_log`. GEMINI confirma que cumple DEC-20260824-01.
5. **OK Frank para commit/push** — sin autorización explícita no se commitea, pushea, despliega.

## Notas de reversión

- Cambios son código puro (5 archivos modificados + 3 archivos nuevos); sin migración ni cambio de schema ni de contrato público irreversible (el response V2 suma un `error_code` nuevo y 3 campos opcionales; callers que no inspeccionen esos campos siguen funcionando idénticos).
- Revertir el commit del fix (si Frank lo autoriza) restaura comportamiento previo: el `ValueError` original burbujea al cliente sin clasificar (FND-20260824-02 vuelve a reproducirse).
- `StudyExtractionSnapshot` y `AIPrediagnosisSnapshot` ya persistidos son inmutables; el fix solo afecta corridas nuevas. Si el operador subió un PDF incompatible ANTES del fix y vio el error crudo, NO se regenera automáticamente — el resultado queda tal cual (a menos que Frank autorice `regenerateStudyAI` o nuevo upload).
- Si el banner de mismatch resulta confuso en pruebas reales con usuarios (p.ej. el operador sí quiere "forzar" un documento Espiro bajo estudio Audio), Frank puede ajustar el copy en `build_user_facing_message` (1 lugar, 1 función) sin tocar heurística.
- 100% reversible.

## Estado

**READY_FOR_VERIFYING.** WIP=0, sesión SOFIA cerrada. Entrega a ATLAS → INTEGRA verifica → GEMINI audita → ATLAS pide OK Frank.