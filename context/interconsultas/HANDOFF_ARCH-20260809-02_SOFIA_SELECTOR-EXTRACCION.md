# Handoff a SOFIA — ARCH-20260809-02 Selector de extracción multi-proveedor

- **ID de tarea:** ARCH-20260809-02
- **Fecha:** 2026-08-09
- **De:** INTEGRA (Arquitecto)
- **Para:** SOFIA (Implementación)
- **Estado:** Listo para implementación
- **SPEC:** `context/SPECs/SPEC_ARCH-20260809-02-SELECTOR-EXTRACCION-MULTI-PROVEEDOR.md`
- **ADR:** `context/decisions/ADR-20260809-02-EXTRACCION-MULTI-PROVEEDOR-M3-GEMINI.md`

---

## 1. Resumen ejecutivo

Implementar un selector runtime de proveedor (`gemini` | `m3`) + modelo para la **capa de extracción documental** del pipeline IA, configurable desde el módulo de calibración existente (`aiCalibration`), con override opcional por payload (A/B sin redeploys), degradación honesta automática de M3 a Gemini ante fallo del upstream, y trazabilidad completa. La capa clínica (MedGemma/DR7) **no se toca**.

**Tono de trabajo:** backend + frontend, ~8–14 archivos, sin migración de DB ni schema Prisma. Sin cambios de contrato hacia usuarios finales (solo observabilidad de proveedor).

## 2. Lecturas obligatorias antes de tocar código

1. `context/SPECs/SPEC_ARCH-20260809-02-SELECTOR-EXTRACCION-MULTI-PROVEEDOR.md` — contrato canónico (lee primero).
2. `context/decisions/ADR-20260809-02-EXTRACCION-MULTI-PROVEEDOR-M3-GEMINI.md` — justificación de decisiones.
3. `backend/app/services/ai/base.py` — patrones `GeminiBase` (líneas 30-194) y `FeatherlessVisionBase` (206-345, tu plantilla para `M3VisionBase`).
4. `backend/app/services/ai/extractor.py` — `ExtractorService.extract_by_type` (184-304), donde va el dispatcher.
5. `backend/app/main.py` líneas 151-164 (env vars), 584-623 (`/api/v2/ai/status`), 1085-1257 (`/api/v2/studies/upload-and-analyze`).
6. `backend/app/schemas/medical.py` — `ExtractedDataUnion` (432-439), `AIAuditMetadata` (584-593), `AIPrediagnosisResult.clinical_provider` (556, **no tocar**).
7. `frontend/src/components/calibration/AICalibrationEditor.tsx` (233-290 sección extracción).
8. `frontend/src/types/calibration.ts` — `AICalibrationV2.extraction` (131-137), `CalibrationTestExtractionResult` (160-166).

## 3. Entrada (qué recibes)

- SPEC firmada con 15 criterios de aceptación verificables (CA-01 a CA-15) y 9 casos borde (CB-01 a CB-09).
- ADR con política de fallback unidireccional M3 → Gemini definida.
- Patrón de cliente OpenAI-compatible ya implementado en `FeatherlessVisionBase` (`base.py:206-345`) — reutilizable como plantilla.
- Endpoint `/api/v2/ai/status` ya expone `extraction_provider_active` y `extraction_model_active` — patrón a replicar/extender.
- No hay script de migración: la lectura de calibraciones legacy es defensiva (`provider` ausente → `"gemini"`).

## 4. Salida esperada (qué debe entregar SOFIA)

### Backend
- **`backend/app/services/ai/base.py`**: nueva clase `M3VisionBase` siguiendo el patrón de `FeatherlessVisionBase` (OpenAI SDK, `get_b64_jpeg` reutilizable, content multimodal, `temperature=0.1`, `max_tokens=4096`, reutilización de `GeminiBase._sanitize_model_json_text` + `_extract_openai_choice_text` + parseo tolerante). **Alternativa permitida:** factorizar un `OpenAICompatibleVisionBase` base del que hereden `FeatherlessVisionBase` y `M3VisionBase`, **siempre que** no rompas la firma pública de `FeatherlessVisionBase.call_featherless_vision` ni de `GeminiBase.call_gemini`.
- **`backend/app/services/ai/extractor.py`**: dispatcher de provider en `extract_by_type`. Resuelve `provider`/`model` con precedencia (override payload > `aiCalibration.extraction.*` > default `gemini`+`GEMINI_MODEL_EXTRACTION`). Selecciona cliente (`call_gemini` o `M3VisionBase`). Aplica fallback M3→Gemini con `extraction_fallback_reason` según triggers del §7 de la SPEC. Devuelve resultado parseado al schema por `doc_type` (lógica existente **sin cambios**).
- **`backend/app/main.py`**: 
  - Env vars `M3_API_KEY`, `M3_BASE_URL` (default confirmado: `https://api.minimax.io/v1`), `M3_DEFAULT_MODEL` (default confirmado: `MiniMax-M3`).
  - `M3_ENABLED`, `M3_STATUS` derivados.
  - Extensión de `/api/v2/ai/status` con `m3_enabled`, `m3_status`, `m3_base_url`, `m3_default_model`, `m3_key_present`, `extraction_default_provider_configurable`. `extraction_provider_active` sigue `"gemini"` (no cambies el default global de proceso).
  - Extensión de `/api/v2/studies/upload-and-analyze`: aceptar `extraction_provider_override` y `extraction_model_override` (opcionales en el `Form`); poblar `extraction_snapshot.audit` con `extraction_provider_requested`, `extraction_provider_used`, `extraction_model_used`, `extraction_fallback_reason`. Mantener `model_name` legacy por compat (= `extraction_model_used`). Eliminar/reinterpretar el hardcodeo `"extraction_provider": "gemini"` (línea 1207).
  - Extensión del endpoint de test de calibración (`POST /api/v1/calibration/upload`): devolver `provider_used`, `provider_requested`, `fallback_reason`.
- **`backend/app/schemas/medical.py`**: añadir a `ExtractedDataUnion` (432-439) los campos opcionales `extraction_provider_requested`, `extraction_provider_used`, `extraction_model_used`, `extraction_fallback_reason`. Conservar `gemini_model` legacy (poblado con modelo efectivo). A `AIAuditMetadata` (584-593) añadir los mismos campos de trazabilidad. **No tocar `AIPrediagnosisResult.clinical_provider` (556)**.
- **`backend/tests/test_ai_pipeline.py`**: tests nuevos (ver §6).

### Frontend
- **`frontend/src/components/calibration/AICalibrationEditor.tsx`**: en la sección "Extracción documental" (233-290), reemplazar badge hardcodeado "Gemini" (237) por badge dinámico; añadir `<select>` provider (`gemini`|`m3`, default `gemini`) + `<input>` model con `placeholder` dinámico (`gemini-2.5-flash` / `MiniMax-M3`); persistir en `data.extraction.provider` y `data.extraction.model` preservando el merge `...(extraction ?? {})`. Mantener accesibilidad.
- **`frontend/src/types/calibration.ts`**: extender `AICalibrationV2.extraction` (131-137) con `provider?: "gemini" | "m3"` y `model?: string`. Extender `CalibrationTestExtractionResult` (160-166) con `provider_used`, `provider_requested`, `fallback_reason`.
- **`frontend/src/lib/calibration-schema.ts`**: si existe schema Zod de validación, añadir `provider` y `model` opcionales (enum `["gemini","m3"]` + string libre).
- **`frontend/src/components/calibration/CalibrationTestResults.tsx`**: mostrar `provider_used` y `fallback_reason` cuando aplique.
- Tests vitest asociados (override por payload, render del selector, migración legacy de UI).

## 5. Restricciones (NO romper)

1. **No modificar `prediagnostic.py`.** La capa clínica (MedGemma/DR7) es intocable en este corte por decisión de Frank.
2. **No cambiar el contrato del prompt de extracción.** `BASE_EXTRACTION_PROMPT` (extractor.py:74) y la regla "sin fallback de prompt" (`EXTRACTION_PROMPT_NOT_CONFIGURED`) se mantienen.
3. **No cambiar el default global de proceso.** `extraction_provider_active` en status sigue `"gemini"`. El selector opera por calibración, no mutando el default.
4. **No exponer secretos.** Nunca retornar `M3_API_KEY`, `GEMINI_API_KEY`, `DR7_API_KEY`. Solo flags `*_key_present` booleanos (patrón ya existente en status).
5. **No eliminar campos legacy.** `gemini_model` (medical.py:439) y `model_name` (main.py:1209) se conservan poblados con el modelo efectivo, por compat hacia atrás.
6. **No romper la firma pública de `FeatherlessVisionBase.call_featherless_vision` ni de `GeminiBase.call_gemini`** si decides factorizar una base común.
7. **No hacer fallback bidireccional.** Solo M3→Gemini. Nunca Gemini→M3.
8. **No enmascarar 401/403 de M3 como fallback.** Son error de credenciales → `M3_AUTH_ERROR` explícito.
9. **No fallback si `provider="gemini"` y Gemini falla.** No hay segundo proveedor para ese camino.
10. **No commits/push/PR sin OK explícito de Frank.** Marca el trabajo listo para commit y espera.

## 6. Validaciones obligatorias antes de cerrar

Ejecuta y reporta el resultado de:

1. **`pytest backend/tests -v`** — debe pasar, con tests nuevos incluidos (ver §6.1).
2. **Frontend typecheck** — 0 errores (usa `pnpm typecheck` si el proyecto usa pnpm; `npm run typecheck` si usa npm — verifica `package.json` y usa el correcto).
3. **Frontend test (vitest)** — verde, con tests nuevos incluidos.
4. **Frontend lint** — 0 errores nuevos (`pnpm lint` / `npm run lint` según corresponda).
5. **Test manual A/B:** subir un PDF con `extraction_provider=gemini` y otro con `extraction_provider=m3` (vía override o calibración); ambos retornan JSON válido parseado al schema del estudio. Reporta qué proveedor se usó y si hubo fallback.
6. **Test manual de fallback:** con `M3_API_KEY` ausente o mock M3 caído, ejecutar corrida con `provider="m3"`; verificar que cae a Gemini y deja `extraction_fallback_reason` poblado (ej. `"m3_not_configured"` o `"m3_5xx"`).

### 6.1 Tests nuevos requeridos (mínimo)

- **Test del cliente M3:** mock OpenAI SDK, verificar que `M3VisionBase` arma content multimodal, parsea JSON y devuelve dict. Cubrir caso de respuesta vacía y JSON no parseable (CB-03, CB-09).
- **Test de fallback 5xx:** mock M3 retorna 5xx → verify Gemini invocado + `extraction_fallback_reason="m3_5xx"` (CA-06, CB-01).
- **Test de fallback por M3 no configurado:** `M3_API_KEY=""` + `provider="m3"` → fallback a Gemini con `extraction_fallback_reason="m3_not_configured"`, no se llama a M3 (CA-07).
- **Test de migración legacy:** calibración sin `extraction.provider` → trata como `gemini`, `extraction_fallback_reason=null` (CA-04).
- **Test de override por payload:** `aiCalibration.extraction.provider="gemini"` + `extraction_provider_override="m3"` → se usa M3, `extraction_provider_requested="m3"` (CA-05).
- **Test de 401/403 M3:** mock M3 retorna 401 → error explícito `M3_AUTH_ERROR`, no fallback (CA-09, CB-01).
- **Test de proveedor desconocido:** `extraction_provider_override="foo"` → error `EXTRACTION_PROVIDER_UNKNOWN` (CB-02).
- **Test de capa clínica intacta:** `AIPrediagnosisResult.clinical_provider` y `clinical_model_used` sin cambios tras el corte (CA-10).
- **Test frontend:** `AICalibrationEditor` renderiza `<select>` provider + `<input>` model, persiste en `data.extraction`, badge dinámico.

## 7. Incógnitas a resolver durante la implementación

1. **`M3_BASE_URL`** confirmado contra docs oficiales de MiniMax: `https://api.minimax.io/v1` (OpenAI-compatible). Alternativa Anthropic: `https://api.minimax.io/anthropic`.
2. **`M3_DEFAULT_MODEL`** confirmado contra docs oficiales: `MiniMax-M3` (case-sensitive, soporta multimodal texto+imagen+video, 1M context).
3. **Gestor de paquetes frontend:** el `package.json` del proyecto indica si es npm o pnpm. PROYECTO.md históricamente usa `npm run`. ATLAS mencionó `pnpm`. **Verifica y usa el que aplique.** Reporta cuál usaste.

Estas son decisiones internas reversibles (env vars ajustables sin redeploy). Confianza ≥80%: procede sin preguntar, documenta en el reporte final.

## 8. Reporte final que debes entregar a INTEGRA

Al cerrar, entrega un reporte con:

1. Archivos modificados (lista con líneas añadidas/quitadas aprox).
2. Resultado de las 6 validaciones de §6 (comando + salida resumida o PASS/FAIL).
3. Self-review manual (Qodo está **sunset**, NO lo invoques — retorna error y bloquea):
   - ¿El código refleja la SPEC? (referencia a CA-NN cubiertos)
   - ¿Hay code smells evidentes?
   - ¿Los tests cubren los edge cases CB-01 a CB-09?
   - ¿Algún riesgo de regresión? (especialmente en capa clínica y en `extract_by_type`)
4. Incógnitas resueltas de §7 (qué valores tomaste para `M3_BASE_URL`, `M3_DEFAULT_MODEL`, gestor de paquetes).
5. Capturas o evidencia del test manual A/B y del test de fallback si fueron factibles localmente.
6. Estado: `LISTO PARA COMMIT` (sin ejecutar commit; espera OK de Frank).

## 9. Segunda mano de validación (obligatoria)

**Solicitar revisión final a GEMINI (subagent_type='gemini') como segunda mano de validación antes de marcar la implementación como lista para commit.** Pasa a GEMINI: la SPEC, el ADR, la lista de archivos tocados y el reporte de self-review. GEMINI auditará consistencia con SPEC, typecheck, tests, code smells y trazabilidad. Su dictamen es informativo (no aprueba commits); la decisión final es de INTEGRA, que la reportará a Frank.

**NO pidas qodo (está sunset). Incluye self-review manual en el reporte final.** Si Frank pide explícitamente "usa Qodo", intenta el comando una vez; si falla con "Qodo Command has been sunset", notifica y procede con self-review manual + GEMINI.

## 10. DoD (heredada de la SPEC §18)

- CA-01 a CA-15 verificados con evidencia.
- Gates §6 aprobados.
- Self-review manual + GEMINI como segunda mano.
- `PROYECTO.md` con una sola representación de ARCH-20260809-02 (INTEGRA lo actualiza al recibir tu reporte).
- Sin commits/push/PR sin OK explícito de Frank.

## 11. Escalamiento

- 2 intentos técnicos sin progreso → invoca a DEBY (`subagent_type='debugger'`) con contexto del fallo. DEBY decide L1 (quick-fix <10 líneas) vs L2 (dictamen + delega a SOFIA) vs L3 (deriva a INTEGRA para nueva SPEC).
- Si `M3_BASE_URL` o `M3_DEFAULT_MODEL` no son determinables tras búsqueda razonable → marca la incógnita en el reporte, deja el env var sin default y escala a INTEGRA. No bloquees toda la tarea por esto (Gemini sigue operativo).
- Si la factorización de `OpenAICompatibleVisionBase` base introduce riesgo de regresión en `FeatherlessVisionBase` o `DocumentClassifierService` → NO la hagas; crea `M3VisionBase` standalone. Reporta la decisión.

---

**Fin del handoff.** Procede con la implementación siguiendo la SPEC. No esperes confirmación de INTEGRA para empezar (la delegación es la acción por defecto). Reporta al cerrar.
