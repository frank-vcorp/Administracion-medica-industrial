# HANDOFF ARCH-20260513-08 a SOFIA — MedGemma via OpenAI SDK sobre Featherless

- ID: ARCH-20260513-08
- Fecha: 2026-05-13
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion

## Objetivo

Implementar la integracion real de MedGemma en la capa clinica del backend usando SDK `openai` con `base_url` hacia Featherless.

## Punto de entrada real

1. `backend/app/services/ai/prediagnostic.py`
2. `backend/app/main.py`
3. `backend/requirements.txt`

## Reglas obligatorias

1. Gemini sigue en extraccion
2. Featherless solo entra en prediagnostico text-only
3. si Featherless falla o no esta configurado, fallback a Gemini
4. trazar `clinical_provider` y `clinical_model_used`
5. no romper endpoints V2 actuales

## Variables objetivo

1. `MEDGEMMA_ENABLED`
2. `FEATHERLESS_API_KEY`
3. `FEATHERLESS_BASE_URL`
4. `FEATHERLESS_MODEL`

## Entregables minimos

1. dependencia `openai` agregada
2. cliente OpenAI-compatible o helper equivalente para Featherless
3. ruta condicional MedGemma en `generate_prediagnosis()`
4. fallback a Gemini conservado
5. validacion puntual o prueba acotada del camino nuevo