# HANDOFF ARCH-20260519-13 -> SOFIA

## Contexto

El usuario pidió evaluar Featherless para extracción de datos clínicos y propuso Qwen3.6-35B-A3B. La revisión de arquitectura y catálogo de modelos confirma que ese modelo no es la variante correcta para lectura visual de imágenes o PDFs.

La decisión aprobada es:

1. reemplazar Gemini por Featherless en todo el frente extractivo
2. usar Qwen/Qwen3-VL-30B-A3B-Instruct como modelo visual inicial
3. mover clasificación documental y extracción estructurada al mismo proveedor
4. no tocar la capa clínica en este corte

## Fuente de verdad

- context/SPECs/SPEC_ARCH-20260519-13-EXTRACCION-MULTIMODAL-FEATHERLESS-QWEN-VL.md

## Objetivo

Implementar la sustitución del frente extractivo para que clasificación y extracción usen Featherless + Qwen-VL y Gemini deje de participar en ese runtime.

## Alcance mínimo

1. agregar FEATHERLESS_EXTRACTION_MODEL separado de FEATHERLESS_MODEL clínico
2. cablear clasificador y extractor para que usen Featherless + Qwen-VL
3. retirar Gemini del runtime extractivo
4. exponer en /api/v2/ai/status el proveedor y modelo extractivos activos
5. trazar extraction_provider y extraction_model_used en el resultado o snapshot del análisis
6. cubrir pruebas del camino Featherless mockeado para clasificación y extracción

## Restricciones

1. no cambies la política de extracción sin fallback de prompt
2. sí sustituye el clasificador por Featherless en este corte; no dejes doble ruta activa sin necesidad
3. no mezcles FEATHERLESS_EXTRACTION_MODEL con FEATHERLESS_MODEL clínico
4. no cablees Qwen/Qwen3.6-35B-A3B como extractor visual
5. no alteres el contrato del frontend más allá de nueva trazabilidad si ya existe superficie para ella

## Superficie esperada

1. backend/app/services/ai/extractor.py
2. backend/app/main.py
3. backend/app/schemas/medical.py
4. backend/tests/test_ai_pipeline.py

## Validación pedida

1. clasificación y extracción usan FEATHERLESS_EXTRACTION_MODEL y no el modelo clínico
2. /api/v2/ai/status reporta extraction_provider_active=featherless y extraction_model_active
3. el camino clínico sigue reportando clinical_provider_active sin cambios de semántica
4. el nuevo camino de extracción devuelve salida parseable y trazable
5. Gemini deja de figurar como proveedor extractivo activo

## Nota de producto

La instrucción del usuario es explícita: no continuar con Gemini Flash para extracción. Si después se quiere evaluar Qwen/Qwen3.6-35B-A3B, debe abrirse como corte aparte para texto estructurado o razonamiento posterior, no como OCR o visión primaria.