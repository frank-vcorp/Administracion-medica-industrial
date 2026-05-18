# HANDOFF ARCH-20260518-14 a SOFIA - Renderer Clínico de Audiometría

## Objetivo

Extender el renderer clínico general para soportar `Audiometria` como segundo estudio real sobre la misma infraestructura visual.

## Contexto confirmado

- Espirometría ya tiene schema y render dedicado
- Audiometría sigue cayendo al fallback genérico
- el contrato backend de `AudiometriaData` ya existe y no debe cambiar

## Requisitos

1. Agregar schema `Audiometria` al registro del renderer.
2. Mostrar tabla principal comparativa por frecuencia:
   - Frecuencia
   - Oído derecho
   - Oído izquierdo
3. Mostrar metadata y calidad cuando existan.
4. Mostrar campos fuente `faringe`, `cad`, `cai`, `mtd`, `mti` si existen.
5. Mantener panel raw técnico sin cambios funcionales.
6. Ejecutar validación enfocada inmediatamente después del primer edit.

## Restricciones

- no tocar backend
- no inventar campos fuera del contrato real
- no romper el fallback genérico para otros estudios

## Referencias

- `frontend/src/components/clinical/extraction-presentation-schemas.ts`
- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`
- `backend/app/schemas/medical.py`
- `context/SPECs/SPEC_ARCH-20260516-07-AUDIOMETRIA-EXTRACCION-CAMPOS-FUENTE-DIAGNOSTICOS.md`
- `context/SPECs/SPEC_ARCH-20260518-14-RENDERER-CLINICO-AUDIOMETRIA.md`

## Entregable mínimo

- Audiometría visible en renderer clínico legible
- tabla comparativa por frecuencia y oído
- campos fuente documentales visibles cuando existan
- compilación TypeScript limpia