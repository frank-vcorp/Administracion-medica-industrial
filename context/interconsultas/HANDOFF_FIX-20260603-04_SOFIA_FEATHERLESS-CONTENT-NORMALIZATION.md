# HANDOFF FIX-20260603-04 a SOFIA — Normalización robusta de contenido Featherless

- ID: FIX-20260603-04
- Fecha: 2026-06-03
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementación
- SPEC fuente: context/SPECs/SPEC_FIX-20260603-04-FEATHERLESS-CONTENT-NORMALIZATION.md

## Objetivo

Corregir el caso real donde Audiometría extrae bien con Gemini, pero el prediagnóstico clínico cae porque Featherless llega con `message.content` vacío o no plano y el adaptador actual pierde el texto.

## Hipótesis ya resuelta

1. el fallo no está en el prompt extractivo ni en `extracted_data`
2. el punto dueño es la lectura de `response.choices[0].message.content`
3. el hotfix anterior cubrió `<pad>`, pero no cubre respuesta vacía o contenido segmentado

## Punto de entrada real

1. [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L866)

## Cambio mínimo obligatorio

1. normalizar robustamente el contenido de respuesta Featherless antes del saneamiento y parseo
2. endurecer el mismo punto en [backend/app/services/ai/base.py](backend/app/services/ai/base.py)
3. agregar pruebas de regresión para contenido segmentado y vacío

## Restricciones

1. no tocar extractor Gemini de Audiometría
2. no cambiar proveedor clínico
3. no recalibrar prompts
4. mantener alcance máximo de 3 archivos

## Validación obligatoria

```bash
cd /workspaces/Administracion-medica-industrial/backend && pytest tests/test_ai_pipeline.py
```

## Entregable esperado

1. hotfix localizado en adaptadores Featherless
2. pruebas backend en verde
3. reporte breve del shape soportado y del caso vacío/no recuperable