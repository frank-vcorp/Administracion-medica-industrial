# SPEC ARCH-20260507-06 — Muestra Compartida por Tipo en Papeleta

- ID: ARCH-20260507-06
- Fecha: 2026-05-07
- Agente: INTEGRA - Arquitecto
- Estado: Planificado para implementación

## Objetivo

Evitar que el capturista tenga que marcar varias veces “Muestra tomada” cuando varios estudios del mismo evento comparten el mismo tipo de muestra.

## Problema actual

Hoy el estado `SAMPLE_TAKEN` se gestiona por `EventTest` individual. Si un evento contiene varios estudios de laboratorio que parten de una sola muestra de sangre, orina u otro espécimen, el usuario debe marcar “Muestra tomada” en cada estudio por separado.

## Regla de negocio

Si dos o más estudios del mismo evento corresponden al mismo tipo de muestra, registrar `SAMPLE_TAKEN` en uno debe reflejarse automáticamente en los demás estudios hermanos de ese mismo grupo.

## Alcance funcional

1. La propagación aplica solo dentro del mismo `MedicalEvent`.
2. La propagación aplica solo al estado `SAMPLE_TAKEN`.
3. No debe propagar `RESULT_REGISTERED` ni `COMPLETED`.
4. La UI debe mostrar “Muestra tomada” como estado compartido por grupo, no solo por estudio individual.
5. Si ya existe un estudio del mismo grupo con estado `SAMPLE_TAKEN`, `RESULT_REGISTERED` o `COMPLETED`, los demás estudios del grupo deben considerarse con muestra ya tomada.

## Regla de agrupación inicial

El grupo de muestra debe resolverse así:

1. Si `MedicalTest.options.sampleType` existe, usarlo como fuente principal.
2. Si no existe, derivar heurísticamente desde `testNameSnapshot` y/o categoría.
3. Heurística mínima inicial:
   - sangre
   - orina
   - heces
   - otro / sin grupo

## Diseño técnico mínimo

1. Extender la serialización de `eventTests` hacia `PapeletaWorkspace` para incluir `test.options` si existe.
2. Crear helper local para resolver `sampleGroup` por estudio.
3. Ajustar el cálculo de `sampleTracked` para que consulte estudios hermanos del mismo grupo.
4. Ajustar la acción de cambio de estado para que `SAMPLE_TAKEN` se aplique a todos los `EventTest` hermanos del mismo grupo dentro del evento.
5. Mantener `RESULT_REGISTERED` y `COMPLETED` como estados individuales por estudio.

## Archivos probables

- frontend/src/app/events/[id]/page.tsx
- frontend/src/components/clinical/PapeletaWorkspace.tsx
- frontend/src/actions/event-test.actions.ts

## Criterios de aceptación

1. Si existen dos estudios de sangre en la misma papeleta, al marcar “Muestra tomada” en uno, el otro debe mostrarse inmediatamente como muestra tomada.
2. Si existen dos estudios de orina, el comportamiento debe ser equivalente.
3. Un estudio de sangre no debe marcar automáticamente uno de orina.
4. El usuario no debe perder la capacidad de registrar resultados por estudio individual.
5. La solución no debe requerir migración Prisma.

## Riesgos controlados

1. Heurísticas por nombre pueden agrupar incorrectamente algunos estudios si no existe `options.sampleType`.
2. La implementación debe favorecer extensibilidad futura hacia catálogo explícito de tipos de muestra.
