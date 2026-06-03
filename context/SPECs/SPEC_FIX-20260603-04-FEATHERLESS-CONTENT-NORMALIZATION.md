# SPEC FIX-20260603-04 — Normalización robusta de contenido Featherless

- ID: FIX-20260603-04
- Fecha: 2026-06-03
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Respaldo forense:
  - context/interconsultas/DICTAMEN_FIX-20260603-01.md
  - dictamen DEBY interno de esta intervención FIX-20260603-04

## Objetivo

Corregir el fallo clínico de Audiometría donde Featherless/MedGemma llega con `message.content` vacío o no plano y el adaptador actual pierde el texto antes del parseo, provocando errores visibles como:

`FeatherlessParseError: Respuesta del modelo no es JSON parseable: ''`

## Hipótesis verificada

1. La extracción documental de Audiometría sigue funcionando con Gemini y entrega `extracted_data` válido.
2. El fallo actual ocurre después, en [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L800-L874).
3. El adaptador clínico asume que `response.choices[0].message.content` siempre es un string utilizable.
4. Si Featherless entrega contenido vacío o segmentado en otra forma compatible, el adaptador reduce la respuesta a `""` y la manda al parser JSON.
5. El mismo supuesto frágil existe en [backend/app/services/ai/base.py](backend/app/services/ai/base.py#L250-L283) para `FeatherlessVisionBase`.

## Archivo ancla inicial

1. [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L800)

## Datos existentes a reutilizar

1. La degradación honesta a `AI_NON_CONCLUSIVE` ya existe en [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L697-L744).
2. El saneamiento de fences y `<pad>` ya existe parcialmente en la capa clínica.
3. `_tolerant_json_parse()` ya resuelve el rescate `{...}` si recibe texto utilizable.

## Datos faltantes a crear

1. Un extractor robusto de texto para respuestas OpenAI-compatibles de Featherless.
2. Manejo explícito para contenido vacío/no recuperable.
3. Pruebas de regresión para contenido segmentado y para respuesta vacía.

## Alcance aprobado

Incluye:

1. endurecer la extracción de texto de respuesta en la capa clínica
2. endurecer el mismo punto frágil en `FeatherlessVisionBase` para no duplicar el problema
3. agregar pruebas dirigidas de Audiometría para contenido segmentado y vacío

No incluye:

1. recalibrar prompts de Audiometría
2. cambiar proveedor clínico
3. reescribir el parser JSON completo
4. tocar schemas clínicos o de extracción

## Archivos exactos a modificar

Máximo permitido: 3 archivos.

1. [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py)
2. [backend/app/services/ai/base.py](backend/app/services/ai/base.py)
3. [backend/tests/test_ai_pipeline.py](backend/tests/test_ai_pipeline.py)

## Cambio mínimo obligatorio

1. Reemplazar la lectura directa de `message.content` por una normalización robusta que acepte al menos:
   - string plano
   - contenido segmentado con bloques de texto
   - contenido vacío o no recuperable, con error explícito
2. Mantener el saneamiento existente de fences y `<pad>` una vez recuperado el texto.
3. Si no se recupera texto utilizable, degradar de forma honesta a `AI_NON_CONCLUSIVE` con motivo Featherless, sin culpar a Gemini.
4. Replicar el endurecimiento equivalente en `FeatherlessVisionBase` para eliminar el mismo supuesto frágil en la capa compartida.

## Criterios de aceptación

1. Un response clínico Featherless con contenido segmentado y JSON válido ya no cae en parse error.
2. Un response clínico Featherless con contenido realmente vacío sigue degradando a `AI_NON_CONCLUSIVE`, pero con motivo claro de respuesta vacía/no recuperable del proveedor clínico.
3. No se altera el flujo extractivo Gemini de Audiometría.
4. `FeatherlessVisionBase` deja de depender exclusivamente de `message.content` como string plano.

## Validación exacta esperada

```bash
cd /workspaces/Administracion-medica-industrial/backend && pytest tests/test_ai_pipeline.py
```

Pruebas mínimas nuevas:

1. `test_audiometria_featherless_content_segmentado_parsea_ok`
2. `test_audiometria_featherless_content_vacio_sin_rescate_degrada_non_conclusive`
3. si se centraliza o replica en base compartida, una prueba dirigida del extractor robusto en la capa Featherless base

## Criterio de éxito

La iteración será exitosa cuando un caso real de Audiometría con extracción Gemini válida no caiga en `FeatherlessParseError: ''` por perder el texto del proveedor clínico antes del parseo, y cuando la capa compartida ya no dependa de una única forma plana de `message.content`.