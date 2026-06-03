# SPEC ARCH-20260603-04 — Migración de capa clínica a DR7.ai (texto) manteniendo Gemini en extracción

- ID: ARCH-20260603-04
- Fecha: 2026-06-03
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260513-08-MEDGEMMA-OPENAI-SDK-FEATHERLESS.md
  - context/SPECs/SPEC_ARCH-20260519-15-ROLLBACK-EXTRACCION-A-GEMINI.md

## Objetivo

Reemplazar Featherless como proveedor de prediagnóstico clínico text-only por DR7.ai usando el endpoint médico indicado por el usuario, manteniendo intacta la extracción documental con Gemini.

## Decisión cerrada del corte

1. Este slice migra solo la capa clínica.
2. Gemini sigue siendo el proveedor extractivo oficial.
3. DR7.ai entra únicamente en `PrediagnosticService` para prompts textuales sobre JSON estructurado.
4. La capacidad de imágenes o multimodal de DR7 queda fuera de este corte.

## Hipótesis verificada

1. La extracción de Audiometría ya entrega payload estructurado útil desde Gemini.
2. Featherless quedó descartado como proveedor clínico confiable para este runtime: el modelo objetivo devuelve `<pad>` en el propio preview del proveedor.
3. El endpoint documentado de DR7 para este caso es `POST https://dr7.ai/api/v1/medical/chat/completions`, con autenticación Bearer y respuesta tipo `choices[0].message.content`.

## Archivo ancla inicial

1. [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py)

## Datos existentes a reutilizar

1. Los prompts clínicos actuales por estudio en [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py) se conservan.
2. La trazabilidad actual de `clinical_provider`, `clinical_model_used`, `prompt_source` y `prompt_version` se conserva.
3. La política actual de degradación honesta a `AI_NON_CONCLUSIVE` se conserva.

## Datos faltantes a crear

1. Cliente HTTP a DR7.ai para el endpoint médico de chat completions.
2. Nuevas variables de entorno clínicas para DR7.
3. Ajuste de telemetría runtime para reflejar que el proveedor clínico activo ya no es Featherless.
4. Pruebas del camino DR7 y de sus fallos HTTP principales.

## Variables de entorno objetivo

1. `MEDGEMMA_ENABLED=true` se conserva como toggle maestro de la capa clínica.
2. `DR7_API_KEY` — obligatoria para habilitar el proveedor clínico.
3. `DR7_BASE_URL` — default: `https://dr7.ai/api/v1/medical/chat/completions`
4. `DR7_MODEL` — default: `medgemma-4b-it`

## Variables que salen del camino crítico clínico

1. `FEATHERLESS_API_KEY`
2. `FEATHERLESS_BASE_URL`
3. `FEATHERLESS_MODEL`

No deben seguir controlando el runtime clínico después de este corte. Si se conservan por compatibilidad en telemetría, deben quedar explícitamente fuera del camino activo.

## Alcance aprobado

Incluye:

1. sustituir la llamada clínica Featherless por llamada HTTP a DR7
2. mantener prompts clínicos y contrato de salida actuales
3. conservar extracción Gemini intacta
4. ajustar observabilidad del proveedor clínico en runtime
5. agregar pruebas del nuevo camino clínico

No incluye:

1. migrar extracción multimodal o por imágenes a DR7
2. recalibrar prompts clínicos por estudio
3. cambiar frontend o UX del panel clínico
4. introducir fallback a Featherless

## Archivos exactos a modificar

Máximo permitido: 3 archivos.

1. [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py)
2. [backend/app/main.py](backend/app/main.py)
3. [backend/tests/test_ai_pipeline.py](backend/tests/test_ai_pipeline.py)

## Cambio mínimo obligatorio

1. Crear en `PrediagnosticService` un camino `_call_dr7_medical_chat()` o equivalente usando `requests.post(...)` al endpoint exacto de DR7.
2. Enviar payload con `model`, `messages`, `max_tokens` y `temperature`.
3. Leer respuesta desde `choices[0].message.content`.
4. Parsear el contenido como JSON usando el parser tolerante actual.
5. En `generate_prediagnosis()`, cambiar el proveedor clínico activo a `dr7` cuando `MEDGEMMA_ENABLED=true` y `DR7_API_KEY` exista.
6. Si DR7 falla por 401, 402, 429 o 500, degradar a `AI_NON_CONCLUSIVE` con razón explícita ligada a DR7.
7. No llamar Featherless como fallback silencioso.

## Reglas de error esperadas

1. `401` → error de autenticación DR7
2. `402` → saldo insuficiente
3. `429` → rate limit
4. `500` → error interno del proveedor

Todas deben quedar mapeadas a `AI_NON_CONCLUSIVE` con `clinical_provider='dr7'`.

## Observabilidad mínima esperada

En [backend/app/main.py](backend/app/main.py), el estado IA debe reflejar:

1. `clinical_provider_active = 'dr7'` cuando aplique
2. `dr7_key_present`
3. `dr7_base_url`
4. `dr7_model`

## Criterios de aceptación

1. La capa clínica ya no invoca Featherless en runtime.
2. La capa clínica usa DR7 con `medgemma-4b-it` por defecto.
3. Gemini sigue intacto en extracción.
4. `clinical_provider` y `clinical_model_used` reflejan `dr7` y `medgemma-4b-it` respectivamente.
5. Los errores HTTP de DR7 degradan honestamente a `AI_NON_CONCLUSIVE`.
6. Las pruebas backend cubren camino nominal y al menos un fallo HTTP.

## Validación exacta esperada

```bash
cd /workspaces/Administracion-medica-industrial/backend && pytest tests/test_ai_pipeline.py
```

## Criterio de éxito

La iteración será exitosa cuando el pipeline clínico deje de depender de Featherless, use DR7 únicamente para prediagnóstico textual y mantenga sin regresión la extracción estructurada con Gemini.