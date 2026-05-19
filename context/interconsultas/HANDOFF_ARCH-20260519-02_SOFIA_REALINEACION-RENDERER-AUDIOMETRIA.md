# HANDOFF ARCH-20260519-02 a SOFIA - Realineación Renderer Audiometría

## Objetivo

Corregir el renderer de Audiometría para que vuelva a mostrar las tablas comparativas acordadas, usando el payload real vigente.

## Hipótesis local ya validada

El bloque de tablas bilaterales existe, pero el schema de presentación sigue apuntando a rutas legacy (`via_aerea`, `via_osea`, `resumen_oidos`) y por eso no encuentra los datos.

## Payload real vigente

El estudio real ya entrega:

- `paciente_detalle`
- `estudio`
- `oido_derecho.va`
- `oido_derecho.vo`
- `oido_derecho.pta_visible`
- `oido_izquierdo.va`
- `oido_izquierdo.vo`
- `oido_izquierdo.pta_visible`
- `notas_calidad.descripcion`
- `campos_fuente`

## Requisitos

1. Restaurar tablas comparativas de Audiometría.
2. Mapear `va/vo` en lugar de `via_aerea/via_osea`.
3. Mapear PTA desde `pta_visible`.
4. Usar `paciente_detalle` en lugar de `paciente`.
5. Mostrar `notas_calidad.descripcion` de forma legible, no serializada como JSON completo.
6. No tocar backend en este corte.

## Archivos probables

- `frontend/src/components/clinical/extraction-presentation-schemas.ts`
- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` solo si hace falta un ajuste mínimo para leer `notas_calidad.descripcion`

## Validación esperada

- check enfocado del frontend tocado
- `tsc --noEmit` o equivalente del slice

## Referencias

- `context/SPECs/SPEC_ARCH-20260518-14-RENDERER-CLINICO-AUDIOMETRIA.md`
- `context/SPECs/SPEC_ARCH-20260519-02-REALINEACION-RENDERER-AUDIOMETRIA-PAYLOAD-REAL.md`