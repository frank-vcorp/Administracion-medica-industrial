# HANDOFF FIX-20260516-01 a SOFIA — Manejo y logging de `ERR_NETWORK_CHANGED` en upload IA

- ID: FIX-20260516-01
- Fecha: 2026-05-16
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementación
- SPEC fuente: context/SPECs/SPEC_FIX-20260516-01-INSTRUMENTACION-UPLOAD-NETWORK-CHANGED.md

## Objetivo

Corregir el comportamiento del cliente cuando la server action de upload/procesamiento IA falla con errores de red tipo `ERR_NETWORK_CHANGED` o `Failed to fetch`.

## Hipótesis ya resuelta

La falla local está en `frontend/src/components/clinical/PapeletaWorkspace.tsx`:

1. `handleFileUpload()` no tiene `try/catch`
2. `handleRegenerateAI()` no tiene `try/catch`
3. si falla la promesa, la UI puede quedar en estado ambiguo y el navegador muestra `Uncaught (in promise)`

## Punto de entrada real

1. `frontend/src/components/clinical/PapeletaWorkspace.tsx`

## Cambio mínimo obligatorio

1. envolver upload y regeneración en `try/catch/finally`
2. limpiar todos los timers incluso ante excepción
3. resetear `isUploading`/`isRegenerating` y `uploadStage`/`regenStage`
4. registrar log estructurado en cliente con contexto suficiente
5. mostrar error útil al usuario para fallos de red

## Restricciones

1. no cambies el backend para este corte
2. no metas retry automático todavía
3. no ensanches el alcance más allá del slice local

## Criterios de aceptación mínimos

1. no hay `Uncaught (in promise)` por este flujo en cliente
2. la UI no se queda colgada si la red cambia
3. el usuario ve mensaje útil
4. el log deja contexto accionable

## Entregable esperado

1. fix localizado en la papeleta
2. validación enfocada
3. checkpoint técnico breve con causa y remediación