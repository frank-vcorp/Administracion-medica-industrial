# HANDOFF ARCH-20260603-04 a SOFIA — Migración de capa clínica a DR7.ai (texto)

- ID: ARCH-20260603-04
- Fecha: 2026-06-03
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementación
- SPEC fuente: context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md

## Objetivo

Reemplazar Featherless por DR7.ai en la capa clínica text-only, manteniendo Gemini en extracción.

## Punto de entrada real

1. [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py)
2. [backend/app/main.py](backend/app/main.py)
3. [backend/tests/test_ai_pipeline.py](backend/tests/test_ai_pipeline.py)

## Reglas obligatorias

1. no toques [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py)
2. no introduzcas fallback a Featherless
3. no migres imágenes ni multimodal a DR7 en este corte
4. conserva prompts clínicos, auditoría y contrato de `AIPrediagnosisResult`
5. usa el endpoint exacto `https://dr7.ai/api/v1/medical/chat/completions` como default configurable

## Variables objetivo

1. `MEDGEMMA_ENABLED`
2. `DR7_API_KEY`
3. `DR7_BASE_URL`
4. `DR7_MODEL`

## Entregables mínimos

1. cliente DR7 text-only en `PrediagnosticService`
2. reemplazo de `clinical_provider='featherless'` por `clinical_provider='dr7'` en el camino activo
3. telemetría runtime actualizada en `main.py`
4. pruebas de camino nominal y error HTTP de DR7

## Validación obligatoria

```bash
cd /workspaces/Administracion-medica-industrial/backend && pytest tests/test_ai_pipeline.py
```

## Salida esperada

1. implementación acotada a 3 archivos
2. suite backend en verde
3. reporte breve con variables nuevas y comportamiento de degradación