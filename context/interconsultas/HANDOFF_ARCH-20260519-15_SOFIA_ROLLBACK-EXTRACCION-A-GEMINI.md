# HANDOFF ARCH-20260519-15 -> SOFIA

## Contexto

La migración del frente extractivo a Featherless + Qwen quedó desplegada, pero la validación productiva mostró bloqueo operativo real por saturación del proveedor: `503 capacity_exhausted` en corridas de `/api/v2/studies/upload-and-analyze`.

El usuario pidió revertir el frente extractivo a Gemini para recuperar continuidad operativa.

## Fuente de verdad

- context/SPECs/SPEC_ARCH-20260519-15-ROLLBACK-EXTRACCION-A-GEMINI.md

## Objetivo

Restaurar Gemini como proveedor activo de clasificación documental y extracción estructurada, dejando intacta la capa clínica.

## Alcance mínimo

1. regresar `DocumentClassifierService` al camino Gemini
2. regresar el extractor documental al camino Gemini
3. actualizar `/api/v2/ai/status` para reflejar `extraction_provider_active=gemini`
4. asegurar que los snapshots o payloads reporten proveedor/modelo reales tras el rollback
5. cubrir pruebas del camino restaurado

## Restricciones

1. no toques la capa clínica
2. no abras fallback dual Gemini/Featherless en esta iteración
3. preserva la regla de extracción sin fallback de prompt
4. evita dejar trazabilidad híbrida donde runtime y status digan cosas distintas

## Superficie esperada

1. backend/app/services/ai/classifier.py
2. backend/app/services/ai/extractor.py
3. backend/app/main.py
4. backend/tests/test_ai_pipeline.py

## Validación pedida

1. `/api/v2/ai/status` reporta `extraction_provider_active=gemini`
2. clasificación y extracción corren por el camino Gemini
3. Featherless ya no figura como proveedor extractivo activo
4. la capa clínica conserva su semántica actual

## Nota de producto

Este corte prioriza continuidad operativa sobre ahorro. Qwen queda desactivado del runtime extractivo hasta nueva decisión arquitectónica.