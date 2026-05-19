# Checkpoint IMPL-20260519-15 — Rollback Extracción a Gemini

- **ID**: IMPL-20260519-15
- **Fecha**: 2026-05-19
- **Agente**: SOFIA - Builder
- **SPEC de referencia**: context/SPECs/SPEC_ARCH-20260519-15-ROLLBACK-EXTRACCION-A-GEMINI.md
- **Handoff de referencia**: context/interconsultas/HANDOFF_ARCH-20260519-15_SOFIA_ROLLBACK-EXTRACCION-A-GEMINI.md

## Resumen ejecutivo

Rollback del frente extractivo completado. Gemini restaurado como proveedor activo de
clasificación documental y extracción estructurada. Featherless/Qwen-VL desactivado del
runtime extractivo. Capa clínica sin cambios.

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/app/services/ai/extractor.py` | Añadida marca ARCH-20260519-15 al header docstring. La clase `ExtractorService` ya heredaba de `GeminiBase` correctamente. |
| `backend/app/main.py` | Añadido campo `extraction_model_active` en `/api/v2/ai/status`. Actualizado `extraction_snapshot.audit` con `extraction_provider: "gemini"` y `extraction_model_used: GEMINI_MODEL_EXTRACTION`. |
| `backend/tests/test_ai_pipeline.py` | Añadida clase `TestRollbackGeminiARCH20260519_15` con 7 tests de validación del rollback. |

> **Nota**: `classifier.py` ya tenía el rollback aplicado (ARCH-20260519-15 en header, herencia `GeminiBase`). No requirió modificación.

## Validaciones ejecutadas

### Gate 1 — Compilación
- `extractor.py`, `main.py`, `test_ai_pipeline.py` importan sin errores de sintaxis.

### Gate 2 — Tests
```
TestRollbackGeminiARCH20260519_15: 7/7 PASSED
Suite completo test_ai_pipeline.py: 56/56 PASSED (0 regresiones)
```

Tests de rollback cubrieron:
1. `DocumentClassifierService` hereda de `GeminiBase` ✅
2. `DocumentClassifierService` NO hereda de `FeatherlessVisionBase` ✅
3. `ExtractorService` hereda de `GeminiBase` ✅
4. `ExtractorService` NO hereda de `FeatherlessVisionBase` ✅
5. Clasificación invoca `GeminiBase.call_gemini` (no Featherless) ✅
6. Extracción invoca `GeminiBase.call_gemini` (no Featherless) ✅
7. Extracción sin `ai_calibration.extraction.prompt` falla con `EXTRACTION_PROMPT_NOT_CONFIGURED` ✅

### Gate 3 — Revisión de trazabilidad
`/api/v2/ai/status` ahora reporta:
- `extraction_provider_active: "gemini"` ✅
- `extraction_model_active: <GEMINI_MODEL_EXTRACTION>` ✅ (nuevo)

`extraction_snapshot.audit` ahora incluye:
- `extraction_provider: "gemini"` ✅ (nuevo)
- `extraction_model_used: GEMINI_MODEL_EXTRACTION` ✅ (nuevo, reemplaza `GEMINI_MODEL` legacy)

### Gate 4 — Documentación
- Marca ARCH-20260519-15 en `extractor.py`
- Comentarios ARCH-20260519-15 en `main.py` (status endpoint + audit)
- Checkpoint generado

## Restricciones respetadas

| Restricción | Estado |
|-------------|--------|
| No tocar capa clínica | ✅ `prediagnostic.py` no modificado |
| No fallback dual Gemini/Featherless | ✅ Un solo proveedor extractivo activo |
| Extracción sin fallback de prompt | ✅ `EXTRACTION_PROMPT_NOT_CONFIGURED` preservado |
| Trazabilidad honesta | ✅ runtime y status dicen lo mismo: gemini |

## Riesgos residuales

1. **`FeatherlessVisionBase` permanece en `base.py`** — encapsulada per SPEC, sin referencias en runtime extractivo. Riesgo bajo: no afecta comportamiento actual pero puede generar confusión. Limpieza opcional en un corte posterior.
2. **Variable `GEMINI_MODEL` legacy en main.py** — aún referenciada en `_ai_unavailable_response()` como retrocompat. No bloquea operación pero puede divergir si se actualiza solo `GEMINI_MODEL_EXTRACTION`. Deuda técnica menor.
3. **`GEMINI_API_KEY` ausente en producción** — si la variable no está configurada, el inicializador lanza error y los servicios quedan como `None`. El endpoint ya informa `last_init_error` de forma segura.

## Próximo paso sugerido

Notificar a GEMINI-CLOUD-QA para auditoría de calidad y validación en entorno Railway.
