# SPEC ARCH-20260513-08 — Integracion MedGemma via SDK OpenAI Compatible sobre Featherless

- ID: ARCH-20260513-08
- Fecha: 2026-05-13
- Agente: INTEGRA - Arquitecto
- Estado: Listo para implementacion

## Objetivo

Habilitar la capa clinica real de MedGemma en el backend actual usando el SDK de OpenAI en modo compatible con `base_url` apuntando a Featherless, sin alterar la capa de extraccion con Gemini y manteniendo fallback clinico a Gemini cuando Featherless no este disponible.

## Decisiones de arquitectura

1. Gemini sigue siendo proveedor de extraccion documental
2. MedGemma via Featherless entra solo en la capa text-only de interpretacion clinica
3. la integracion se hara con SDK `openai` y `base_url` configurable
4. el cliente o frontend no vera Featherless directamente; solo el backend lo usara
5. si Featherless falla o no esta configurado, se usa fallback actual a Gemini

## Superficie minima a tocar

1. `backend/requirements.txt`
2. `backend/app/services/ai/prediagnostic.py`
3. `backend/app/main.py`
4. pruebas puntuales del backend si aplica

## Variables de entorno objetivo

1. `MEDGEMMA_ENABLED=true`
2. `FEATHERLESS_API_KEY`
3. `FEATHERLESS_BASE_URL`
4. `FEATHERLESS_MODEL=google/medgemma-27b-text-it`
5. `GEMINI_MODEL_CLINICAL` se conserva como fallback

## Comportamiento esperado

### Camino primario

1. `generate_prediagnosis()` detecta que MedGemma esta habilitado y configurado
2. arma prompt con calibracion y JSON estructurado
3. llama a Featherless usando OpenAI SDK
4. parsea JSON de respuesta
5. devuelve `AIPrediagnosisResult` con `clinical_provider=featherless`

### Camino fallback

1. si falta configuracion o Featherless falla
2. el sistema degrada a Gemini text-only
3. devuelve resultado con `clinical_provider=gemini`
4. no rompe el endpoint V2 ni el flujo actual

## Criterios de aceptacion

1. el backend instala y usa `openai`
2. existe llamada OpenAI-compatible hacia Featherless desde la capa clinica
3. el flujo V2 sigue funcionando sin romper extraccion
4. el resultado traza `clinical_provider` y `clinical_model_used`
5. si Featherless falla, existe fallback a Gemini
6. existe al menos una validacion automatizada o estructural del nuevo camino

## Restricciones

1. no cambiar el contrato funcional del endpoint V2 salvo para mejorar auditoria clinica
2. no tocar la capa de extraccion con imagen
3. no exponer API keys en logs
4. no simular MedGemma como activo si la configuracion real no existe