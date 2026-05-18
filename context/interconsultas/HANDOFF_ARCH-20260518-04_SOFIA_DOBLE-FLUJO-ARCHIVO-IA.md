# HANDOFF ARCH-20260518-04 -> SOFIA

## Contexto

Se aprueba un doble flujo explícito para estudios IA dentro de la papeleta clínica.

El usuario validó la necesidad de separar:

1. reemplazar archivo conservando historial
2. eliminar archivo y limpiar análisis vigentes para recapturar desde cero

La condición no negociable es no romper auditoría ni trazabilidad clínica/técnica.

## Objetivo

Implementar el doble flujo operativo en la UI y runtime del estudio:

1. `Reemplazar archivo`
2. `Eliminar archivo y limpiar análisis`

## Fuente de Verdad

- context/SPECs/SPEC_ARCH-20260518-04-DOBLE-FLUJO-REEMPLAZAR-O-LIMPIAR-ARCHIVO-IA.md
- context/interconsultas/DICTAMEN_FIX-20260518-01.md

## Alcance mínimo

1. Mantener el flujo de reemplazo como acción no destructiva.
2. Agregar acción explícita para limpiar archivo y análisis vigentes con confirmación.
3. Introducir semántica clara de snapshot vigente vs snapshot histórico/no vigente.
4. Corregir la actualización del cliente para que el snapshot nuevo no dependa únicamente de `router.refresh()`.
5. Hacer legible el panel de valores capturados para arreglos/objetos complejos como `parametros`.

## Restricciones

1. No hacer hard delete silencioso de snapshots históricos por defecto.
2. No perder revisiones médicas ni trazabilidad previa.
3. No presentar la acción destructiva como si fuera un simple reemplazo.
4. Si se limpia el estudio, la UI debe quedar realmente sin archivo ni snapshots vigentes.

## Validación pedida

1. Reemplazo exitoso con archivo nuevo: el panel muestra el snapshot nuevo sin recarga dura manual.
2. Limpieza exitosa: desaparecen archivo, valores capturados, raw extractivo y prediagnóstico vigente del estudio.
3. Historial previo queda trazable como superseded/no vigente.
4. El panel de valores capturados ya no muestra textos tipo `[object Object]` para `parametros`.

## Entrega esperada

1. Código implementado.
2. Validación ejecutable o verificación mínima acotada al slice.
3. Checkpoint técnico de cierre del corte.
