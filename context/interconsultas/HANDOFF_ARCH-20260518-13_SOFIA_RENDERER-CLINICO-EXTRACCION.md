# HANDOFF ARCH-20260518-13 a SOFIA - Renderer Clínico de Extracción

## Objetivo

Implementar la SPEC `context/SPECs/SPEC_ARCH-20260518-13-RENDERER-CLINICO-GENERAL-EXTRACCION.md` para reemplazar el panel azul `Valores capturados` por una representación clínica estructurada y legible para médicos.

## Alcance Inicial

- construir un renderer general configurable por `studyType`
- implementar primera configuración para `Espirometria`
- dejar el raw técnico como panel secundario

## Punto de partida confirmado

- componente actual: `CapturedValuesPanel` en `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- el problema no está en el JSON, sino en su representación vertical genérica
- la tabla `parametros` de Espirometría ya contiene suficiente información para un render clínico útil

## Requisitos clave

1. No cambiar el contrato backend del payload extractivo.
2. No renderizar `parametros` como lista vertical de claves.
3. Renderizar una tabla real con columnas clínicas.
4. Mantener compatibilidad con móvil usando scroll horizontal controlado.
5. Preparar la base para `Audiometria` después, sin reescribir la arquitectura visual.

## Archivos probables

- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`
- `frontend/src/components/clinical/extraction-presentation-schemas.ts`

## Entregable mínimo esperado

- Espirometría deja de verse como lista azul vertical
- aparece una representación clínica estructurada con secciones y tabla principal
- el raw técnico sigue existiendo solo como soporte DEV/QA