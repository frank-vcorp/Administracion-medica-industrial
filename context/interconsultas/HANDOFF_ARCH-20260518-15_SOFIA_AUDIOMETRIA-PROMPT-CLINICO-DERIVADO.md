# HANDOFF ARCH-20260518-15 a SOFIA - Audiometría Clínica Derivada por MedGemma

## Estado

Este handoff queda como referencia secundaria para una implementación posterior del runtime o de la UI.

La definición del prompt clínico final de Audiometría para este corte vive primero en la capa de configuración y quedó consolidada en `context/interconsultas/PROMPTS_DOC-20260518-02-AUDIOMETRIA.md`.

## Objetivo

Implementar, si más adelante se requiere en runtime o schema, el ajuste del prompt clínico de Audiometría para que MedGemma produzca una síntesis clínica derivada del estudio, separada de la extracción documental.

## Contexto

- La extracción documental de Audiometría ya debe mantenerse separada de la narrativa diagnóstica del formato.
- El usuario pide que el equivalente a “diagnóstico audiométrico” salga de la capa clínica, no de la UI.
- El prompt clínico actual de `Audiometria` vive en `backend/app/services/ai/prediagnostic.py`, pero la versión objetivo para calibración/configuración ya quedó definida por arquitectura.

## Requisitos

1. Endurecer el prompt clínico general backend de `Audiometria`.
2. Exigir bloques estructurados para:
   - `resumen_por_oido`
   - `resumen_bilateral`
   - `clasificacion_hipoacusia`
3. Mantener `summary`, `confidence`, `justification`, `clinical_basis`, `citations`, `limitations`, `recommendation` y `non_conclusive_reason`.
4. No copiar la descripción audiométrica del documento como salida clínica.
5. Degradar a no concluyente cuando falten datos suficientes para clasificación etiológica.
6. Si se requiere ampliar schema de salida clínica, hacerlo de forma compatible y validar el slice tocado.

## Referencias

- `backend/app/services/ai/prediagnostic.py`
- `context/SPECs/SPEC_ARCH-20260518-15-AUDIOMETRIA-PROMPT-CLINICO-DERIVADO.md`
- `context/interconsultas/PROMPTS_DOC-20260518-02-AUDIOMETRIA.md`
- `context/SPECs/SPEC_ARCH-20260516-07-AUDIOMETRIA-EXTRACCION-CAMPOS-FUENTE-DIAGNOSTICOS.md`
- `context/SPECs/SPEC_ARCH-20260513-01-CALIBRACION-V1-AUDIOMETRIA-ESPIROMETRIA.md`

## Entregable mínimo

- Prompt clínico de Audiometría actualizado
- contrato/salida clínica compatible y explícita para bloques derivados
- validación enfocada del backend/schemas tocados