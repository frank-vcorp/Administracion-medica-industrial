# HANDOFF FIX-20260603-01 a SOFIA — Hotfix de parseo clínico Featherless en Audiometría

- ID: FIX-20260603-01
- Fecha: 2026-06-03
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementación
- SPEC fuente: context/SPECs/SPEC_FIX-20260603-01-AUDIOMETRIA-FEATHERLESS-PAD-JSON.md
- Dictamen fuente: context/interconsultas/DICTAMEN_FIX-20260603-01.md

## Objetivo

Corregir el prediagnóstico clínico de Audiometría cuando Featherless/MedGemma devuelve texto con prefijo `<pad>` u otra basura recuperable antes del JSON, sin tocar la extracción documental.

## Hipótesis ya resuelta

1. La extracción documental sí funciona con Gemini.
2. El defecto vive en [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L799-L869).
3. El mensaje de parseo compartido en [backend/app/services/ai/base.py](backend/app/services/ai/base.py#L25-L54) hoy menciona Gemini aunque el proveedor que falla sea Featherless.

## Punto de entrada real

1. [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L799)

## Cambio mínimo obligatorio

1. sanear `raw_text` en `_call_featherless_text_only()` antes del parseo
2. neutralizar el mensaje del parser compartido para no mencionar Gemini
3. cubrir con pruebas el caso `<pad>` y el caso no JSON

## Restricciones

1. no toques [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py)
2. no recalibres prompts de Audiometría en este corte
3. no cambies proveedor clínico ni flags de entorno
4. mantén el alcance en máximo 3 archivos

## Criterios de aceptación mínimos

1. el caso `<pad>` seguido de JSON válido se recupera
2. el caso no JSON sigue degradando a `AI_NON_CONCLUSIVE`
3. el motivo final ya no culpa a Gemini cuando el fallo es clínico/Featherless

## Validación obligatoria

```bash
cd /workspaces/Administracion-medica-industrial/backend && pytest tests/test_ai_pipeline.py
```

## Entregable esperado

1. hotfix localizado en backend clínico
2. pruebas en verde
3. checkpoint técnico breve con causa, remediación y validación