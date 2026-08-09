# SPEC ARCH-20260809-02 — Selector de extracción multi-proveedor (Gemini + MiniMax M3)

- **ID:** ARCH-20260809-02
- **Fecha:** 2026-08-09
- **Agente:** INTEGRA — Arquitecto
- **Estado:** READY (lista para delegación a SOFIA)
- **ADR de respaldo:** `context/decisions/ADR-20260809-02-EXTRACCION-MULTI-PROVEEDOR-M3-GEMINI.md`
- **Relacionada con:**
  - `context/SPECs/SPEC_ARCH-20260519-15-ROLLBACK-EXTRACCION-A-GEMINI.md` (rollback extractivo previo)
  - `context/SPECs/SPEC_ARCH-20260518-06-BASE-EXTRACCION-Y-PLANTILLA-CALIBRACION.md` (base universal + bloque de calibración)
  - `context/SPECs/SPEC_ARCH-20260518-03-EXTRACCION-SIN-FALLBACK-CLINICA-CON-FALLBACK.md` (extracción sin fallback de prompt)
- **Superficie backend:** `backend/app/services/ai/{base.py,extractor.py}`, `backend/app/main.py` (líneas 151-164 env vars, 584-623 status, 1085-1257 upload-and-analyze + endpoint de calibración test), `backend/app/schemas/medical.py` (trazabilidad), `backend/tests/test_ai_pipeline.py`
- **Superficie frontend:** `frontend/src/components/calibration/AICalibrationEditor.tsx`, `frontend/src/types/calibration.ts`, `frontend/src/lib/calibration-schema.ts` (si existe schema Zod), tests vitest asociados
- **No se toca:** `backend/app/services/ai/prediagnostic.py` (capa clínica intacta por decisión de Frank)

---

## 1. Objetivo

Agregar un selector runtime de proveedor (`gemini` | `m3`) y modelo configurable para la **capa de extracción documental** del pipeline IA de AMI, editable desde el módulo de calibración existente (`aiCalibration`), con override opcional por ejecución (A/B sin redeploys), degradación honesta automática de M3 a Gemini ante fallo del upstream, y trazabilidad completa del proveedor efectivo.

La capa clínica (MedGemma 4B vía DR7) **no se modifica** en este corte.

## 2. Alcance

### Incluye

1. Nuevas variables de entorno para el proveedor M3 (`M3_API_KEY`, `M3_BASE_URL`, `M3_DEFAULT_MODEL`).
2. Nuevo cliente de extracción compatible OpenAI para M3, siguiendo el patrón de `FeatherlessVisionBase` (ver `backend/app/services/ai/base.py:206-345`).
3. Dispatcher de proveedor en `ExtractorService.extract_by_type` que selecciona cliente según `aiCalibration.extraction.provider` (con override por payload).
4. Política de fallback unidireccional M3 → Gemini con trazabilidad `requested/used/reason`.
5. Extensión del contrato de `aiCalibration.extraction` con `provider` y `model` (opcionales, default `gemini`).
6. Extensión del contrato de `/api/v2/ai/status` con campos de configuración M3 y provider activo.
7. Extensión del contrato de `/api/v2/studies/upload-and-analyze` y del endpoint de test de calibración con trazabilidad de proveedor.
8. Extensión de los esquemas Pydantic (`ExtractedDataUnion`, `ExtractionSnapshotPayload.audit`) con campos de trazabilidad.
9. UI: extensión del formulario `AICalibrationEditor` con selector proveedor + input modelo. Sin nueva pantalla.
10. Tests: cliente M3, fallback, migración legacy, override por payload.
11. Migración implícita de calibraciones legacy (lectura defensiva, sin script).

### No incluye

1. Migración del clasificador documental a M3 (sigue con Gemini; futuro ARCH si Frank lo pide).
2. Selector de proveedor para la capa clínica (MedGemma/DR7).
3. Balanceo entre más de dos proveedores.
4. Reintentos exponenciales sofisticados (solo 1 reintento corto antes de fallback).
5. Política de cuotas/costo por proveedor.
6. Cambios en el prompt de extracción ni en `BASE_EXTRACTION_PROMPT`.

## 3. Contrato de `aiCalibration.extraction` (nuevo)

Extender el contrato existente (ver `frontend/src/types/calibration.ts:131-137`) con dos campos opcionales. **Todo lo existente se conserva intacto**.

### Forma nueva

```
aiCalibration.extraction = {
  enabled: boolean,                       // existente
  prompt?: string,                        // existente — obligatorio en runtime (sin fallback de prompt)
  version?: string,                       // existente
  schemaVersion?: string,                  // existente
  targetFields?: string[],                // existente
  provider?: "gemini" | "m3",            // NUEVO — default implícito "gemini" si ausente
  model?: string                          // NUEVO — string libre; si ausente, default por provider
}
```

### Reglas de resolución

- `provider` ausente o `null` → se trata como `"gemini"` (migración legacy implícita).
- `provider="gemini"` + `model` ausente → usar `GEMINI_MODEL_EXTRACTION` (env, default `gemini-2.5-flash`).
- `provider="m3"` + `model` ausente → usar `M3_DEFAULT_MODEL` (env, default `minimax-m3`).
- `provider="m3"` + `M3_API_KEY` ausente → fallback a Gemini con `extraction_fallback_reason="m3_not_configured"`.
- `provider` con valor no reconocido (no `gemini` ni `m3`) → error explícito `EXTRACTION_PROVIDER_UNKNOWN` (no fallback silencioso).

### Override por payload (opcional, A/B sin redeploy)

El endpoint `/api/v2/studies/upload-and-analyze` y el endpoint de test de calibración aceptan, opcionalmente, en el payload:

- `extraction_provider_override`: `"gemini" | "m3"` (sobreescribe `aiCalibration.extraction.provider`).
- `extraction_model_override`: `string` (sobreescribe `aiCalibration.extraction.model`).

**Precedencia:** override por payload > `aiCalibration.extraction.*` > default de proceso (`gemini` + `GEMINI_MODEL_EXTRACTION`).

Si el override es inválido (proveedor no reconocido) → error explícito, no fallback.

## 4. Variables de entorno nuevas

Agregar en `backend/app/main.py` junto al bloque existente (líneas 151-164), sin alterar las existentes:

- `M3_API_KEY` — token del plan Pro de tokens de Frank para MiniMax M3. Default `""` (vacío = no configurado).
- `M3_BASE_URL` — endpoint OpenAI-compatible de M3. Default a confirmar por SOFIA contra la documentación del plan Pro (valor sugerido inicial: `https://api.minimaxi.io/v1`, **verificar**).
- `M3_DEFAULT_MODEL` — modelo default de M3 para extracción. Default `minimax-m3`. **SOlIA debe verificar el nombre exacto** del modelo en el plan Pro (puede ser `MiniMax-M3` o variante); el valor es ajustable vía env sin tocar código.

**Estado runtime de M3** (análogo a `MEDGEMMA_STATUS`):
- `M3_ENABLED` = `bool(M3_API_KEY)` (derivado, no env).
- `M3_STATUS` = `"available"` si `M3_ENABLED` else `"pending_integration"`.

## 5. Cliente M3 (patrón)

Implementar en `backend/app/services/ai/base.py` una clase `M3VisionBase` que siga el patrón de `FeatherlessVisionBase` (líneas 206-345): OpenAI SDK, `get_b64_jpeg` reutilizable, content multimodal con `image_url` base64, `temperature=0.1`, `max_tokens=4096`, y reutilización de `GeminiBase._sanitize_model_json_text` + `GeminiBase._extract_openai_choice_text` + parseo tolerante.

**Alternativa de implementación (decisión de SOFIA):** factorizar un `OpenAICompatibleVisionBase` base del que hereden `FeatherlessVisionBase` y `M3VisionBase`. Es aceptable **siempre que** no se rompa la superficie pública existente (`FeatherlessVisionBase.call_featherless_vision` y `GeminiBase.call_gemini` deben seguir operativos sin cambio de firma).

**Contrato del cliente M3** (independiente de la herencia elegida):

- `M3VisionBase(file_path, prompt) -> Dict[str, Any]` — análogo a `call_gemini` / `call_featherless_vision`.
- Debe lanzar excepción en fallo HTTP/timeout/parseo (no devolver dict vacío).
- No logear `M3_API_KEY` ni tokens (privacidad, igual que `call_gemini` no logea `GEMINI_API_KEY`).

## 6. Dispatcher de proveedor en `ExtractorService`

`ExtractorService.extract_by_type` (ver `backend/app/services/ai/extractor.py:184-304`) debe:

1. Resolver `provider` y `model` efectivos con la precedencia del §3.
2. Seleccionar el cliente (`call_gemini` o `M3VisionBase`).
3. Si `provider="m3"` y el cliente M3 falla con un trigger del §7 → invocar `call_gemini` como fallback, registrar `extraction_fallback_reason`.
4. Devolver el resultado parseado al schema correspondiente (lógica existente de parseo por `doc_type` **sin cambios**).
5. El campo `gemini_model` legacy de `ExtractedDataUnion` (ver `backend/app/schemas/medical.py:439`) se mantiene poblado por compat hacia atrás, pero ahora refleja el **modelo efectivo** (no asume Gemini).

**Restricción de diseño:** el dispatcher debe quedar encapsulado en `ExtractorService`. No se exponen detalles de cliente M3 a `main.py` ni al frontend. El endpoint solo ve `provider` y `model`.

## 7. Política de fallback (unidireccional M3 → Gemini)

### Triggers (cualquiera dispara fallback)

- HTTP 5xx del upstream M3.
- Timeout de lectura > 60 s.
- HTTP 4xx persistente tras 1 reintento corto, **excluyendo 401/403** (estos son error de credenciales → no fallback, error explícito `M3_AUTH_ERROR`).

### Caso especial

- `provider="m3"` + `M3_API_KEY` ausente → fallback inmediato a Gemini con `extraction_fallback_reason="m3_not_configured"`. No se intenta llamar a M3.

### Comportamiento si `provider="gemini"` y Gemini falla

**No hay fallback.** No existe segundo proveedor para ese camino. La corrida degrada a error explícito (comportamiento actual, sin cambios).

### Trazabilidad poblada en toda corrida de extracción

| Campo | Tipo | Null permitido | Significado |
|---|---|---|---|
| `extraction_provider_requested` | `"gemini" \| "m3"` | No | Proveedor pedido (tras resolución override + calibración + default) |
| `extraction_provider_used` | `"gemini" \| "m3"` | No | Proveedor que efectivamente respondió (puede ser `gemini` tras fallback) |
| `extraction_model_used` | `string` | No | Modelo efectivo (env resuelta) |
| `extraction_fallback_reason` | `string \| null` | Sí | Null si no hubo fallback; si no, uno de: `m3_5xx`, `m3_timeout`, `m3_4xx_persistent`, `m3_not_configured` |

## 8. Contrato extendido de `/api/v2/ai/status`

Extender el dict retornado (ver `backend/app/main.py:601-623`) con:

```
{
  ... campos existentes sin cambios ...,

  // NUEVO: configuración del proveedor M3
  "m3_enabled": <bool M3_ENABLED>,
  "m3_status": <"available" | "pending_integration">,
  "m3_base_url": <M3_BASE_URL>,
  "m3_default_model": <M3_DEFAULT_MODEL>,
  "m3_key_present": <bool>,

  // EXTENDIDO: provider/model activo por defecto de proceso
  // (cambia semántica: antes "gemini" hardcodeado, ahora refleja el default de proceso,
  //  que sigue siendo gemini salvo que Frank cambie el default efectivo)
  "extraction_provider_active": "gemini",   // default de proceso; gemini sigue siendo el activo global
  "extraction_model_active": <current_extraction_model>,   // sin cambios
  "extraction_default_provider_configurable": true  // NUEVO: indica que el selector existe y es configurable por calibración
}
```

**Restricciones:**
- Nunca retornar `M3_API_KEY`, `GEMINI_API_KEY` ni `DR7_API_KEY`. Solo flags `*_key_present` booleanos (patrón ya existente).
- `extraction_provider_active` sigue siendo `"gemini"` como default de proceso (no se cambia el default global). El selector opera por calibración, no cambiando el default de proceso.

## 9. Contrato extendido de `/api/v2/studies/upload-and-analyze`

Extender el `extraction_snapshot.audit` (ver `backend/app/main.py:1205-1214`) con la trazabilidad del §7. **Campos existentes se conservan** (`extraction_provider: "gemini"` hardcodeado debe desaparecer o reinterpretarse; ver nota):

```
extraction_snapshot.audit = {
  // EXISTENTES (conservar):
  "prompt_version": <_extraction_prompt_version>,
  "prompt_source": <_extraction_prompt_source>,
  "pipeline_version": <PIPELINE_VERSION>,
  "source_file_hash": <file_hash>,
  "triggered_by_user_id": <triggered_by_user_id>,

  // RENOMBRADO/REINTERPRETADO:
  // "extraction_provider": "gemini"   (hardcodeado, línea 1207)
  //   → pasa a ser dinámico = extraction_provider_used
  "extraction_provider_used": <provider efectivo>,
  "extraction_model_used": <modelo efectivo>,

  // NUEVOS:
  "extraction_provider_requested": <provider pedido>,
  "extraction_fallback_reason": <string | null>
}
```

**Nota de compat:** el campo legacy `model_name` (línea 1209) se mantiene poblado con el mismo valor que `extraction_model_used` por compat hacia atrás (consumidores que lo lean no se rompen). NO eliminar.

### Override por payload en este endpoint

Aceptar en el `Form` (ver `backend/app/main.py:1085-1091`) dos parámetros opcionales:

- `extraction_provider_override: Optional[str] = Form(default=None)`
- `extraction_model_override: Optional[str] = Form(default=None)`

Pasárselos a `extractor.extract_by_type` (o al dispatcher) para que aplique la precedencia del §3.

## 10. Contrato extendido del endpoint de test de calibración

El endpoint de test de calibración (`POST /api/v1/calibration/upload`, ver `CalibrationTestExtractionResult` en `frontend/src/types/calibration.ts:160-166`) debe devolver también:

```
CalibrationTestExtractionResult = {
  structured_data: ...,
  raw_payload: ...,
  model_used: string,                        // existente (mantener por compat)
  prompt_version: string,                     // existente
  duration_seconds: number,                   // existente
  // NUEVOS (nomenclatura alineada con §7 — prefijo extraction_ en ambos endpoints):
  extraction_provider_used: "gemini" | "m3",
  extraction_provider_requested: "gemini" | "m3",
  extraction_fallback_reason: string | null
}
```

El frontend `CalibrationTestResults.tsx` debe mostrar estos campos (proveedor efectivo + razón de fallback si la hubo).

## 11. Esquemas Pydantic (trazabilidad)

Extender en `backend/app/schemas/medical.py`:

- `ExtractionSnapshotPayload.audit` (vía `AIAuditMetadata`, líneas 584-593): añadir:
  - `extraction_provider_requested: Optional[str] = None`
  - `extraction_provider_used: Optional[str] = None`
  - `extraction_fallback_reason: Optional[str] = None`
  - `extraction_model_used` ya existe implícito en `model_name`; se mantiene.

**No se extiende `ExtractedDataUnion`** (línea 432-439): tras investigación de flujo, `ExtractorService.extract_by_type` devuelve modelos Pydantic específicos por tipo de estudio (`AudiometriaData`, etc.), no `ExtractedDataUnion`; `ExtractedDataUnion` no se instancia en el pipeline de upload-and-analyze (solo se importa en `main.py:34` y se re-exporta). Extenderla añadiría campos siempre `null`. La trazabilidad extractiva vive exclusivamente en `AIAuditMetadata`.

**Restricción:** `AIPrediagnosisResult.clinical_provider` (línea 556) **no se toca**. Es capa clínica. La trazabilidad nueva es exclusivamente extractiva.

## 12. UI: extensión de `AICalibrationEditor.tsx`

Modificar `frontend/src/components/calibration/AICalibrationEditor.tsx` (ver líneas 233-290) en la sección "Extracción documental":

1. Reemplazar el badge hardcodeado `Gemini` (línea 237) por un badge dinámico según `provider` seleccionado.
2. Agregar un `<select>` con opciones `gemini` | `m3` (default `gemini` si `initial.extraction.provider` ausente).
3. Agregar un `<input>` para `model` con `placeholder` dinámico según provider:
   - `gemini` → `gemini-2.5-flash`
   - `m3` → `minimax-m3`
4. Guardar ambos en `data.extraction.provider` y `data.extraction.model` al submit (ver bloque `data.extraction = {...}` líneas 142-147).
5. Preservar el merge con `...(extraction ?? {})` para no perder campos existentes.

**Sin nueva pantalla.** Es extensión del formulario existente. Mantener accesibilidad (labels `htmlFor`, select con `id`).

## 13. Migración de calibraciones legacy

- **No se requiere script de migración.** La lectura es defensiva: `provider` ausente → `"gemini"`.
- Toda `aiCalibration` existente en `MedicalTest.options` que no tenga `extraction.provider` sigue funcionando con Gemini sin cambios.
- Test específico (ver §15) cubre el caso: cargar una calibración legacy (sin `provider`) → verificar que se trata como `gemini` y la corrida completa sin fallback.

## 14. Criterios de aceptación (verificables)

1. **CA-01 (env vars):** `M3_API_KEY`, `M3_BASE_URL`, `M3_DEFAULT_MODEL` están declaradas en `main.py` con defaults sensatos; `M3_STATUS` derivado como `"available"` solo si `M3_API_KEY` presente.
2. **CA-02 (status):** `/api/v2/ai/status` retorna `m3_enabled`, `m3_status`, `m3_base_url`, `m3_default_model`, `m3_key_present`, `extraction_default_provider_configurable=true`; `extraction_provider_active` sigue `"gemini"` (default de proceso sin cambiar); sin exponer secretos.
3. **CA-03 (selector UI):** `AICalibrationEditor` renderiza `<select>` provider (`gemini`|`m3`) + `<input>` model, guarda en `data.extraction.provider/model`, mergea con campos existentes; badge dinámico.
4. **CA-04 (default legacy):** una calibración sin `extraction.provider` se trata como `gemini` (sin error, sin fallback); trazabilidad reporta `extraction_provider_requested="gemini"`, `extraction_provider_used="gemini"`, `extraction_fallback_reason=null`.
5. **CA-05 (override por payload):** pasar `extraction_provider_override="m3"` en una corrida con `aiCalibration.extraction.provider="gemini"` → se usa M3 efectivo; trazabilidad `extraction_provider_requested="m3"`, `extraction_provider_used="m3"`, `extraction_fallback_reason=null`.
6. **CA-06 (fallback M3→Gemini por 5xx):** mock M3 retorna 5xx → se invoca Gemini; `extraction_provider_requested="m3"`, `extraction_provider_used="gemini"`, `extraction_fallback_reason="m3_5xx"`.
7. **CA-07 (fallback por M3 no configurado):** `M3_API_KEY` ausente + `provider="m3"` → fallback inmediato a Gemini, `extraction_fallback_reason="m3_not_configured"`, no se intenta llamar a M3.
8. **CA-08 (sin fallback para Gemini):** `provider="gemini"` y Gemini falla → error explícito, **no** hay fallback a M3; no se puebla `extraction_fallback_reason` con `m3_*`.
9. **CA-09 (401/403 M3):** M3 retorna 401/403 → error explícito `M3_AUTH_ERROR`, **no** fallback silencioso (credenciales malas no se enmascaran).
10. **CA-10 (capa clínica intacta):** `prediagnostic.py` no se modifica; `AIPrediagnosisResult.clinical_provider` y `clinical_model_used` sin cambios; `medgemma_status` y `dr7_*` en status sin cambios.
11. **CA-11 (sin fallback de prompt):** `aiCalibration.extraction.prompt` ausente → sigue fallando con `EXTRACTION_PROMPT_NOT_CONFIGURED` (comportamiento existente, sin cambios).
12. **CA-12 (test endpoint):** `POST /api/v1/calibration/upload` retorna `extraction_provider_used`, `extraction_provider_requested`, `extraction_fallback_reason` además de `model_used` existente.
13. **CA-13 (gates backend):** `pytest backend/tests -v` pasa con tests nuevos incluidos.
14. **CA-14 (gates frontend):** `typecheck` 0 errores, `vitest` verde (con tests nuevos), `lint` 0 errores nuevos.
15. **CA-15 (test manual A/B):** subir un PDF con `extraction_provider=gemini` y otro con `extraction_provider=m3` (vía override o calibración); ambos retornan JSON válido parseado al schema correcto.

## 15. Casos borde

- **CB-01:** calibración con `provider="m3"` + `model` explícito pero inválido para la API de M3 → M3 responde error → fallback a Gemini con `extraction_fallback_reason` apropiado (ej. `m3_4xx_persistent` si es 400 persistente, o error explícito si es 401/403).
- **CB-02:** override por payload con proveedor desconocido (`extraction_provider_override="foo"`) → error explícito `EXTRACTION_PROVIDER_UNKNOWN`, no fallback.
- **CB-03:** M3 responde pero el JSON no es parseable (texto corrupto) → **no es trigger de fallback** (es error de parseo, no de upstream). Lanzar `ValueError` con mensaje claro (análogo a Featherless hoy). No enmascarar como `m3_5xx`.
- **CB-04:** PDF inválido/corrupto (no se puede convertir a JPEG) → error en `get_b64_jpeg` antes de llamar a cualquier proveedor → propagar excepción (comportamiento actual, sin cambios). No hay fallback.
- **CB-05:** timeout de M3 a mitad de stream → abortar, fallback a Gemini con `extraction_fallback_reason="m3_timeout"`.
- **CB-06:** calibración con `provider="gemini"` + override `extraction_model_override="gemini-2.5-pro"` → se usa ese modelo sin cambiar provider; trazabilidad `extraction_model_used="gemini-2.5-pro"`.
- **CB-07:** Gemini caído y calibración pide `m3` → M3 es el proveedor pedido; si M3 falla con trigger del §7, **se intenta fallback a Gemini**, que también falla (Gemini caído) → error explícito (no hay tercer proveedor); `extraction_provider_requested="m3"`, `extraction_provider_used="gemini"` solo si Gemini respondió antes de caer, `extraction_fallback_reason` refleja el fallo M3 (ej. `m3_5xx`).
- **CB-08:** `aiCalibration` completamente `null`/ausente → `EXTRACTION_PROMPT_NOT_CONFIGURED` (comportamiento existente; el selector de provider no aplica porque falta el prompt obligatorio).
- **CB-09:** M3 responde 200 pero con `choices` vacío → tratar como respuesta inválida; `ValueError` (no fallback, es respuesta vacía no error de upstream).

## 16. Gates de validación (SOFIA debe ejecutar)

1. `pytest backend/tests -v` — debe pasar, con tests nuevos incluidos.
2. Frontend `typecheck` — 0 errores (comando según gestor del proyecto: `npm run typecheck` o `pnpm typecheck`).
3. Frontend `test` (vitest) — verde, con tests nuevos incluidos.
4. Frontend `lint` — 0 errores nuevos.
5. **Test manual A/B:** subir PDF con `extraction_provider=gemini` y con `extraction_provider=m3`; ambos retornan JSON válido parseado al schema del estudio.
6. **Test manual de fallback:** con `M3_API_KEY` ausente o mock M3 caído, ejecutar corrida con `provider="m3"`; verificar que cae a Gemini y deja `extraction_fallback_reason` poblado.

## 17. Superficie esperada (archivos a tocar)

### Backend
- `backend/app/main.py` — env vars M3 (líneas ~151-164), inicialización de cliente M3, extensión `/api/v2/ai/status` (584-623), extensión `/api/v2/studies/upload-and-analyze` (1085-1257), extensión endpoint de test de calibración.
- `backend/app/services/ai/base.py` — nueva clase `M3VisionBase` (patrón `FeatherlessVisionBase`, líneas 206-345).
- `backend/app/services/ai/extractor.py` — dispatcher de provider en `extract_by_type` (184-304), fallback a Gemini.
- `backend/app/schemas/medical.py` — trazabilidad en `ExtractedDataUnion` (432-439) y `AIAuditMetadata` (584-593).
- `backend/tests/test_ai_pipeline.py` — tests de cliente M3, fallback, migración legacy, override.

### Frontend
- `frontend/src/components/calibration/AICalibrationEditor.tsx` — selector provider + input model + badge dinámico.
- `frontend/src/types/calibration.ts` — `AICalibrationV2.extraction` (131-137) + `CalibrationTestExtractionResult` (160-166).
- `frontend/src/lib/calibration-schema.ts` — si existe schema Zod, añadir validación de `provider`/`model` opcionales.
- `frontend/src/components/calibration/CalibrationTestResults.tsx` — mostrar `provider_used`/`fallback_reason`.
- Tests vitest asociados.

## 18. Definition of Done (DoD)

- Criterios CA-01 a CA-15 verificados con evidencia.
- Gates §16 aprobados.
- Revisión SOFIA (self-review manual incluido en reporte).
- **GEMINI** (`subagent_type='gemini'`) como segunda mano de validación antes de marcar como listo para commit (Qodo está sunset, no invocarlo).
- `PROYECTO.md` con una sola representación de ARCH-20260809-02.
- Sin commits/push/PR sin OK explícito de Frank.

## 19. Riesgos conocidos

1. Trazabilidad inconsistente si quedan referencias residuales hardcodeadas a `"gemini"` (líneas 612, 1207, 1209 de `main.py`). Mitigado por CA-02, CA-06, CA-08.
2. Estados híbridos difíciles de depurar si el fallback no puebla `extraction_fallback_reason`. Mitigado por tests §15 CB-06.
3. Nombre exacto del modelo M3 a confirmar contra la API del plan Pro. Mitigado dejándolo como env var `M3_DEFAULT_MODEL` ajustable.
4. `M3_BASE_URL` default a confirmar por SOFIA. Mitigado por env var ajustable.
5. Posible duplicación de lógica de cliente OpenAI-compatible entre `FeatherlessVisionBase` y `M3VisionBase`. Mitigado: SOFIA puede factorizar base común sin romper contrato público.
